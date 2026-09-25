# Vera AI Challenge — Production Build Guide

This corrects and re-sequences your original plan against what's actually in `challenge-brief.md` and `challenge-testing-brief.md`. Two things changed vs your draft:

1. **The judge never touches your database directly.** It only speaks to 5 HTTP endpoints. All data — the 5 categories, 50 merchants, 200 customers, plus mid-test updates — arrives via `POST /v1/context`. Loading `merchants_seed.json` into Mongo yourself is only for *your own local testing*; the judge re-sends everything fresh at test time, including things you've never seen.
2. **`/v1/reply` is not optional.** Multi-turn is called a "tiebreaker" in the brief's §7.4, but the testing brief makes Phase 4 replay (auto-reply hell, intent transition, hostile) worth up to **+30 points** for top-10 bots, and it's driven entirely by `/v1/reply`. Skipping it caps your score hard.

Everything else in your instinct (Node/Express, staged build order, keep an LLM prompt layer separate from business rules) is right. Below is the corrected build order.

---

## 0. What actually gets scored (keep this pinned above your editor)

| Source | What it means for your code |
|---|---|
| **5 rubric dimensions** (Specificity, Category fit, Merchant fit, Trigger relevance, Engagement compulsion) — score every `send` | Your **prompt**, not your infra, is 80% of your score. Budget time accordingly. |
| **Phase 3 adaptive injection** (new digest items, updated performance, new triggers pushed mid-test) | Your composer must always read from *current* context state, never cache a prompt. Bonus for adapting, penalty for hallucinating unpushed data. |
| **Phase 4 replay** (top 10 only) — auto-reply hell, intent transition, hostile/off-topic | `/v1/reply` needs real state-machine logic, not just "call the LLM again." |
| **Operational penalties** (`/v1/healthz` failures ×3 = disqualified, timeouts, malformed JSON, empty `send` body, verbatim repeats) | These are cheap to avoid and expensive to lose. Build the harness bulletproof before touching prompt quality. |

Full failure-mode table is in `challenge-testing-brief.md` §10 — read it once, literally, before you write a line of code.

---

## Phase 1 — Skeleton harness (get this bulletproof first, ~day 1)

Goal: pass `judge_simulator.py --scenario warmup` before you write any LLM code.

### 1.1 Project setup

```bash
mkdir vera-bot && cd vera-bot
npm init -y
npm install express dotenv
npm install -D nodemon
mkdir src
```

Keep it flatter than your original plan — you don't need `controllers/`, `middleware/`, a separate `client/` yet. This is a stateless-looking-stateful HTTP service, not a CRUD app.

```
vera-bot/
├── src/
│   ├── server.js          # the 5 endpoints, nothing else
│   ├── store.js           # in-memory context + conversation state
│   ├── composer.js        # trigger → prompt → LLM → validated message
│   ├── conversation.js    # /v1/reply state machine
│   └── rules.js           # suppression, dedup, auto-reply detection, anti-repeat
├── judge_simulator.py     # from the challenge zip
├── dataset/                # from the challenge zip (for local warmup only)
├── .env
└── package.json
```

### 1.2 In-memory store — no MongoDB required

Per the testing brief: *"Storing in memory is fine; just don't restart between calls."* A 60-minute test window with no expected restarts means Mongo buys you nothing but latency and a new failure mode. Use plain `Map`s keyed the way the judge keys things:

```js
// src/store.js
const contexts = new Map();       // key: `${scope}:${context_id}` -> {version, payload}
const conversations = new Map();  // key: conversation_id -> {merchantId, customerId, turns:[], state}
const sentBodies = new Map();     // key: conversation_id -> Set<string>  (anti-repetition)

function upsertContext(scope, contextId, version, payload) {
  const key = `${scope}:${contextId}`;
  const cur = contexts.get(key);
  if (cur && cur.version >= version) {
    return { accepted: false, reason: "stale_version", current_version: cur.version };
  }
  contexts.set(key, { version, payload });
  return { accepted: true };
}

function getContext(scope, contextId) {
  return contexts.get(`${scope}:${contextId}`)?.payload ?? null;
}

module.exports = { contexts, conversations, sentBodies, upsertContext, getContext };
```

If you want durability across your own restarts during dev (not required for the judge, useful for you), swap the `Map` for a thin SQLite/Mongo wrapper behind the same 4 functions later — don't build that abstraction now.

### 1.3 The 5 endpoints — exact contracts

Copy these shapes verbatim from `challenge-testing-brief.md` §2 — the judge validates response schemas, not just status codes.

```js
// src/server.js
const express = require("express");
const { contexts, conversations, upsertContext, getContext } = require("./store");
const { composeForTrigger } = require("./composer");
const { handleReply } = require("./conversation");

const app = express();
app.use(express.json({ limit: "600kb" })); // context payload cap is 500KB, give headroom

const START = Date.now();

app.get("/v1/healthz", (req, res) => {
  const counts = { category: 0, merchant: 0, customer: 0, trigger: 0 };
  for (const key of contexts.keys()) {
    const scope = key.split(":")[0];
    if (scope in counts) counts[scope]++;
  }
  res.json({
    status: "ok",
    uptime_seconds: Math.floor((Date.now() - START) / 1000),
    contexts_loaded: counts,
  });
});

app.get("/v1/metadata", (req, res) => {
  res.json({
    team_name: "YOUR_TEAM",
    team_members: ["YOUR_NAME"],
    model: "claude-sonnet-4-6", // whatever you actually call
    approach: "trigger-routed prompt templates + post-LLM validator + suppression/anti-repeat rules",
    contact_email: "you@example.com",
    version: "0.1.0",
    submitted_at: new Date().toISOString(),
  });
});

app.post("/v1/context", (req, res) => {
  const { scope, context_id, version, payload } = req.body;
  if (!["category", "merchant", "customer", "trigger"].includes(scope)) {
    return res.status(400).json({ accepted: false, reason: "invalid_scope" });
  }
  const result = upsertContext(scope, context_id, version, payload);
  if (!result.accepted) return res.status(409).json(result);
  res.json({ accepted: true, ack_id: `ack_${context_id}_v${version}`, stored_at: new Date().toISOString() });
});

app.post("/v1/tick", async (req, res) => {
  // HARD 30s budget. If composition might run long, bail to actions: [] rather than risk a timeout.
  const { available_triggers = [] } = req.body;
  try {
    const actions = await composeTickActions(available_triggers); // must internally race against a ~20s timeout
    res.json({ actions });
  } catch (e) {
    res.json({ actions: [] }); // never throw 5xx here — empty is always valid and better than a timeout
  }
});

app.post("/v1/reply", async (req, res) => {
  try {
    const result = await handleReply(req.body);
    res.json(result);
  } catch (e) {
    res.json({ action: "wait", wait_seconds: 300, rationale: "internal error, backing off" });
  }
});

app.post("/v1/teardown", (req, res) => {
  contexts.clear();
  conversations.clear();
  res.json({ ok: true });
});

app.listen(process.env.PORT || 8080, () => console.log("vera-bot up"));
```

Notes that matter more than they look:
- **Idempotency is on `(scope, context_id, version)`**, not the whole payload — implement the `>=` check exactly, or you'll wrongly reject valid re-sends.
- **`/v1/tick` and `/v1/reply` must always return 200 with a valid shape.** A thrown error becomes a "malformed JSON" penalty; a slow LLM call becomes a timeout penalty. Wrap every LLM call in a timeout race (`Promise.race` against a 20–25s timer) and fall back to `actions: []` / `{action:"wait", wait_seconds:...}`.
- Add `POST /v1/teardown` even though it's optional — it's a one-line memory wipe and it's explicitly called out in the privacy section (§11 of testing brief: bots must not persist context after test end).

### 1.4 Deploy early, not last

Get this skeleton on a public URL **today**, before writing any prompt logic. Railway, Render, or Fly all give you HTTPS with near-zero config:

```bash
# Render/Railway: connect repo, set start command `node src/server.js`, set PORT env
# or, for quick iteration, ngrok your local box:
ngrok http 8080
```

Deploying the skeleton first means every subsequent change is tested against the real network path (latency, cold starts, timeouts) instead of `localhost`, which is what will actually bite you on judge day.

### 1.5 Validate against `judge_simulator.py`

```bash
export BOT_URL=https://your-deployed-url.example.com
# edit LLM_PROVIDER / LLM_API_KEY at top of judge_simulator.py — this is the *judge's* LLM, separate from your bot's
python judge_simulator.py
```

Note: `judge_simulator.py` itself needs an LLM key configured (OpenAI/Anthropic/Gemini/DeepSeek/Groq/Ollama/OpenRouter) — it's not just calling your bot, it's an actual LLM playing merchant + scorer. Available scenarios (from the script): `warmup`, `phase2_short`, `auto_reply_hell`, `intent_transition`, `hostile`, `all`, `full_evaluation`. Run `warmup` first — it only checks `healthz`, `metadata`, and that context pushes are accepted. Don't move to Phase 2 until `warmup` is clean.

---

## Phase 2 — The composer (this is where your score actually comes from)

### 2.1 Structure: routing layer + prompt templates + validator, exactly as the brief suggests (§13)

```js
// src/composer.js
const { getContext } = require("./store");
const { callLLM } = require("./llm");
const { validateMessage } = require("./validator");
const { isSuppressed, markSent } = require("./rules");

async function composeTickActions(availableTriggerIds) {
  const actions = [];
  for (const trgId of availableTriggerIds.slice(0, 20)) { // tick action cap is 20
    const trigger = getContext("trigger", trgId);
    if (!trigger) continue;

    const merchant = getContext("merchant", trigger.merchant_id);
    const category = merchant && getContext("category", merchant.category_slug);
    const customer = trigger.customer_id ? getContext("customer", trigger.customer_id) : null;
    if (!merchant || !category) continue;

    if (isSuppressed(trigger.suppression_key)) continue; // dedup — never resend the same suppression_key

    const draft = await composeOne({ category, merchant, trigger, customer });
    if (!draft) continue; // composer is allowed to decide "nothing worth sending" — restraint is rewarded

    const checked = validateMessage(draft, { category, merchant, trigger, customer });
    if (!checked.ok) continue; // fail closed: don't send something that fails validation

    markSent(trigger.suppression_key);
    actions.push({
      conversation_id: `conv_${merchant.merchant_id}_${trigger.id}`,
      merchant_id: merchant.merchant_id,
      customer_id: customer ? customer.customer_id : null,
      send_as: customer ? "merchant_on_behalf" : "vera",
      trigger_id: trigger.id,
      template_name: templateNameFor(trigger.kind),
      template_params: draft.templateParams || [],
      body: draft.body,
      cta: draft.cta,
      suppression_key: trigger.suppression_key,
      rationale: draft.rationale,
    });
  }
  return actions;
}

module.exports = { composeTickActions };
```

### 2.2 Route by `trigger.kind`, not one giant prompt

The brief explicitly suggests this (§13.2). Different trigger kinds need different framings — a `research_digest` needs a citation-led hook; a `perf_dip` needs a number-led loss-aversion hook; a `recall_due` (customer-facing) needs booking-slot specificity. One mega-prompt will regress to generic copy, which is the #1 anti-pattern the judge penalizes.

```js
// src/composer.js (cont.)
const PROMPT_BUILDERS = {
  research_digest: buildResearchDigestPrompt,
  perf_spike: buildPerfPrompt,
  perf_dip: buildPerfPrompt,
  recall_due: buildRecallPrompt,
  dormant_with_vera: buildDormantPrompt,
  milestone_reached: buildMilestonePrompt,
  // fallback for kinds you haven't special-cased yet
  default: buildGenericPrompt,
};

async function composeOne({ category, merchant, trigger, customer }) {
  const build = PROMPT_BUILDERS[trigger.kind] || PROMPT_BUILDERS.default;
  const prompt = build({ category, merchant, trigger, customer });
  const raw = await callLLM(prompt, { temperature: 0 }); // deterministic — the brief requires this
  return parseComposedMessage(raw);
}
```

### 2.3 Prompt design — bake the rubric in, don't hope the model infers it

This is the highest-leverage 30 minutes you'll spend. Build one **shared system prompt** encoding the hard constraints, then append trigger-specific framing:

```js
function systemPrompt(category, merchant, customer) {
  return `You are Vera, magicpin's WhatsApp assistant for merchants. You compose ONE message.

HARD RULES (violating any of these fails validation):
- Anchor on at least one concrete, verifiable fact from the CONTEXT below (a number, date, headline, or peer stat). Never say generic things like "10% off" or "grow your business" when a specific fact is available.
- Voice: ${category.voice.tone}. Allowed vocabulary: ${category.voice.vocab_allowed.join(", ")}. NEVER use: ${category.voice.taboos.join(", ")}.
- Exactly ONE call to action, in the last sentence. Binary (reply YES / STOP) for action triggers, none for pure-information triggers.
- Do not invent any fact, offer, competitor, or citation not present in the CONTEXT.
- Match language: merchant languages = ${merchant.identity.languages.join(",")}. If "hi" is present, natural Hindi-English code-mix is preferred over pure English.
- Never re-introduce yourself if conversation_history already has prior "vera" turns.
- ${customer ? "This message goes to the merchant's CUSTOMER, drafted on the merchant's behalf. No medical/overclaim language. Use their name and preferences." : "This message goes to the MERCHANT directly."}

Return ONLY JSON: {"body": string, "cta": "open_ended"|"binary_yes_stop"|"none", "rationale": string, "templateParams": string[]}
No markdown, no prose outside the JSON.`;
}
```

Then a trigger-specific user message that hands over the actual context as data (not prose you summarize — paste the real numbers):

```js
function buildResearchDigestPrompt({ category, merchant, trigger, customer }) {
  const item = category.digest.find(d => d.id === trigger.payload.top_item_id);
  return {
    system: systemPrompt(category, merchant, customer),
    user: JSON.stringify({
      merchant: { name: merchant.identity.name, locality: merchant.identity.locality,
                  ctr: merchant.performance.ctr, peer_ctr: category.peer_stats.avg_ctr,
                  signals: merchant.signals, high_risk_cohort: merchant.customer_aggregate?.high_risk_adult_count },
      digest_item: item,
      instruction: "Compose a message that surfaces this specific digest item, ties it to a signal about this merchant if relevant (e.g. their patient cohort), and asks a low-friction question about turning it into content."
    }),
  };
}
```

Build 5–6 of these (one per trigger family you'll actually see triggers for — check `dataset/triggers_seed.json` for the `kind` distribution). Don't hand-craft all ~15 kinds listed in the brief on day one; cover the ones with volume, route the rest through `default`.

### 2.4 Post-LLM validator — this is your safety net, not optional

```js
// src/validator.js
function validateMessage(draft, { category, merchant }) {
  if (!draft.body || draft.body.trim().length === 0) return { ok: false, reason: "empty_body" };
  const ctaCount = (draft.body.match(/reply\s+(yes|stop|\d)/gi) || []).length;
  if (ctaCount > 1) return { ok: false, reason: "multiple_ctas" };
  for (const taboo of category.voice.taboos) {
    if (new RegExp(taboo, "i").test(draft.body)) return { ok: false, reason: `taboo_word:${taboo}` };
  }
  return { ok: true };
}
module.exports = { validateMessage };
```

Wire a **re-prompt-once** loop on failure (brief §13.3 suggests this) before giving up and skipping the send — one retry, then skip.

### 2.5 Suppression, dedup, anti-repetition — cheap, high value

```js
// src/rules.js
const { conversations, sentBodies } = require("./store");
const suppressedUntil = new Map(); // suppression_key -> expiry

function isSuppressed(key) {
  const exp = suppressedUntil.get(key);
  return exp && exp > Date.now();
}
function markSent(key, ttlMs = 7 * 24 * 3600 * 1000) {
  suppressedUntil.set(key, Date.now() + ttlMs);
}
function wasBodySentBefore(conversationId, body) {
  const set = sentBodies.get(conversationId) || new Set();
  return set.has(body);
}
module.exports = { isSuppressed, markSent, wasBodySentBefore };
```

Every `send` action must check `wasBodySentBefore` — verbatim repeats are an explicit -2 penalty per repeat (testing brief §10).

---

## Phase 3 — `/v1/reply` conversation state machine (don't skip this)

This is what your original plan omitted entirely, and it's where Phase 4 replay lives (up to +30 for top 10).

```js
// src/conversation.js
const { conversations, getContext } = require("./store");
const { detectAutoReply, detectIntentTransition, detectHostile } = require("./detectors");
const { composeReply } = require("./composer");

async function handleReply({ conversation_id, merchant_id, customer_id, from_role, message, turn_number }) {
  const conv = conversations.get(conversation_id) || { turns: [], autoReplyStreak: 0, unansweredNudges: 0 };
  conv.turns.push({ from: from_role, message, turn: turn_number });

  // 1. Auto-reply detection: same message verbatim 3+ times in this conversation
  const merchantTurns = conv.turns.filter(t => t.from === "merchant").map(t => t.message);
  if (detectAutoReply(merchantTurns)) {
    conv.autoReplyStreak++;
    conversations.set(conversation_id, conv);
    if (conv.autoReplyStreak >= 2) {
      // tried once after detecting, now exit gracefully — matches Pattern B in the brief
      return { action: "end", rationale: "Detected canned auto-reply after repeat attempt; exiting to avoid wasting turns." };
    }
    return { action: "send", body: buildAutoReplyProbe(merchant_id),
              cta: "open_ended", rationale: "Auto-reply suspected; one direct probe before exiting." };
  }

  // 2. Intent transition: merchant said "yes/let's do it/go ahead" — skip straight to action, no more qualifying
  if (detectIntentTransition(message)) {
    conversations.set(conversation_id, conv);
    return { action: "send", body: await buildActionModeReply(conv, merchant_id),
              cta: "open_ended", rationale: "Explicit intent detected; routing directly to action, not another qualifying question." };
  }

  // 3. Hostile / off-topic — stay polite, stay on-mission
  if (detectHostile(message)) {
    return { action: "send", body: "No worries — happy to help whenever you're ready. On your Google profile / offers, want me to continue?",
              cta: "open_ended", rationale: "De-escalating hostile/off-topic input while staying on-mission." };
  }

  // 4. Hard "not interested" / STOP — graceful exit
  if (/\bstop\b|not interested/i.test(message)) {
    return { action: "end", rationale: "Merchant signaled not interested; exiting gracefully." };
  }

  // 5. Normal turn — compose contextual reply via LLM
  const body = await composeReply(conv, merchant_id, customer_id, message);
  conv.turns.push({ from: "vera", message: body });
  conversations.set(conversation_id, conv);
  return { action: "send", body, cta: "open_ended", rationale: "Continuing conversation based on merchant's latest message." };
}

module.exports = { handleReply };
```

```js
// src/detectors.js
function detectAutoReply(merchantTurns) {
  if (merchantTurns.length < 3) return false;
  const last3 = merchantTurns.slice(-3);
  return last3[0] === last3[1] && last3[1] === last3[2];
}
function detectIntentTransition(msg) {
  return /\b(yes|let'?s do it|go ahead|ok(ay)? let'?s|sure,? do it|haan (kar do|chalo))\b/i.test(msg);
}
function detectHostile(msg) {
  return /\b(fuck|useless|scam|spam|stupid)\b/i.test(msg); // extend with a small classifier if time allows
}
module.exports = { detectAutoReply, detectIntentTransition, detectHostile };
```

This directly targets the three named Phase 4 scenarios: **auto-reply hell** (repeat the same canned text 4×, bot must detect + exit), **intent transition** (merchant says "ok let's do it" mid-qualification, bot must not ask another qualifying question — this is called out by name as Pattern D, the thing *not* to do), and **hostile/off-topic** (stay on-mission politely).

---

## Phase 4 — Testing against `judge_simulator.py`

Run scenarios in this order as you build each phase, not all at the end:

```bash
python judge_simulator.py            # TEST_SCENARIO = "warmup" while building Phase 1
python judge_simulator.py            # switch to "phase2_short" once composer works
python judge_simulator.py            # switch to "auto_reply_hell" once /v1/reply exists
python judge_simulator.py            # switch to "intent_transition"
python judge_simulator.py            # switch to "hostile"
python judge_simulator.py            # switch to "full_evaluation" as a final dry run
```

(Edit `TEST_SCENARIO` and `BOT_URL`/`LLM_PROVIDER`/`LLM_API_KEY` at the top of the script.) Read the printed per-dimension score bars and judge rationale after each run — they tell you exactly which of the 5 rubric dimensions is weak, which is far more actionable than guessing.

Separately, write a few unit-style checks before relying on the simulator:
- `/v1/context` re-posting the same `(scope, context_id, version)` returns `accepted:false` with `stale_version`... no — actually returns a no-op per spec (idempotent), double check your implementation matches "re-posting same version is a no-op" (200, `accepted:true`) vs "lower version" (409, `stale_version`). Don't conflate the two.
- `/v1/tick` with `available_triggers: []` returns `{"actions": []}` in well under 30s.
- Sending the same trigger's tick twice does not double-send (suppression key working).

---

## Phase 5 — Deployment hardening for the real 60-minute window

- **Rate limits**: judge sends up to 10 req/sec. Make sure your LLM calls aren't serialized behind a single global mutex — use per-conversation locks only, not a global one.
- **LLM API budget**: set a hard per-minute call cap and fall back to `actions: []` / cached "wait" responses if you're about to exceed your provider's rate limit — better to skip a tick than to hang past 30s.
- **Timeout discipline**: wrap every LLM call: `Promise.race([callLLM(prompt), timeout(20000)])`. Prefer returning nothing over returning late (testing brief FAQ: late responses are dropped anyway).
- **`/v1/healthz` must stay green**: don't let it depend on the LLM provider being up — it should only report your own process state and context counts. Three consecutive failures = disqualified for the slot.
- **Env vars, not hardcoded keys**: `.env` with `LLM_API_KEY`, `PORT`; add `.env` to `.gitignore`.
- **No external calls with merchant/customer payload data** except to your LLM provider (§11 privacy rule) — don't log payloads to a third-party analytics service, etc.

Deploy target: anything with a public HTTPS URL and no cold-start >30s. Railway or Fly.io (always-on instance) are safer than serverless here — a cold Lambda/Vercel function eating into your 30s budget on the first request of a burst is a real risk during Phase 2/4 ticks.

---

## What to explicitly deprioritize (cut from your original plan)

- **React admin dashboard** — build only if you have spare time after Phase 3 passes `judge_simulator.py all`. It has zero judge-facing value; its only use is as your own debugging UI. If you want one, a single-page `VeraTest.jsx` that lets you manually POST to your own `/v1/tick` locally is enough — skip Merchants/Customers/Triggers CRUD pages entirely.
- **MongoDB/Mongoose** — optional, not required. In-memory state satisfies the spec (§"Bot must persist context until the test ends... storing in memory is fine").
- **Separate `/api/*` REST layer mirroring the challenge API** — there's no reason for it to exist; the challenge API *is* your API.

## Order of operations, corrected

1. Skeleton 5 endpoints, in-memory store, deployed publicly → `judge_simulator.py warmup` green.
2. Composer with 1 trigger kind (`research_digest`) hardcoded well, validator, suppression → `phase2_short` green, read the score breakdown.
3. Expand to 4–5 trigger kinds covering the bulk of `triggers_seed.json`.
4. `/v1/reply` state machine (auto-reply, intent transition, hostile, graceful exit) → `auto_reply_hell`, `intent_transition`, `hostile` green.
5. Customer-facing composition path (`send_as: "merchant_on_behalf"`) — needed for the 5 test pairs with populated `CustomerContext`.
6. Deployment hardening (timeouts, rate limits, healthz independence).
7. `full_evaluation` dry run, read judge feedback, iterate on prompt/validator only — infra should be frozen by this point.
8. Fill in `README.md` (approach, tradeoffs, what context would've helped) and `metadata` fields, submit URL.

Skip the giant React dashboard and the `/api/*` CRUD layer from your original draft until 1–7 above are done — they're not what's being scored, and steps 2–4 are where the rubric points actually live.
