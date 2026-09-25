# Vera AI — Merchant Assistant Bot

> magicpin AI Challenge submission: An AI chatbot that engages and assists merchants on WhatsApp using a 4-context composition framework.

## Approach

**Architecture**: Express.js server with trigger-routed LLM composition + deterministic rule engine.

**Core principle**: _Rules decide what Vera should do. AI decides how Vera should say it._

The system separates the decision pipeline (eligibility → suppression → expiration → consent → priority) from the composition layer (prompt building → LLM call → output validation). This keeps the bot predictable, testable, and safe while letting the LLM handle natural language generation.

### What makes this different from today's Vera

1. **Trigger-specific prompt routing** — Each trigger family (research_digest, perf_dip, recall_due, etc.) gets a specialized prompt builder that frames context for maximum scoring across all 5 rubric dimensions. No single mega-prompt.

2. **Real conversation state machine** — `/v1/reply` uses deterministic rule checks _before_ the LLM: auto-reply detection (Pattern B), intent transition (avoiding Pattern D), hostile de-escalation, and STOP handling.

3. **Post-LLM validator** — Every composed message passes through taboo word detection, CTA validation, promotional tone guards for clinical categories, and anti-repetition checks. One retry on failure, then skip.

4. **Always-fresh context** — The composer reads from the live in-memory store on every call, never from a cached prompt. Mid-test context injections are immediately reflected.

### Tradeoffs

- **In-memory storage over MongoDB** — The 60-min test window with no expected restarts makes database overhead unnecessary. Context counts are fast and reliable.
- **Single LLM call per message** — No retrieval/embedding step. The prompt builder pre-selects relevant context (digest items, peer stats, customer data) and passes it directly. Faster, more predictable.
- **Conservative sending** — Empty `actions: []` is always preferred over a low-quality message. Restraint is rewarded, spam is penalized.

### What additional context would have helped

- Real conversation transcripts beyond the 4 anonymized patterns — particularly around what Indian merchants actually respond to in different categories.
- Actual Kaleyra template structures — to test template parameter formatting.
- Per-category peer stat distributions (not just averages) — to make social proof comparisons more nuanced.

## Quick Start

```bash
cd server
npm install

# Copy and edit environment
cp ../.env.example ../.env
# Edit ../.env with your LLM API key

# Start dev server
npm run dev
```

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | /v1/healthz | Liveness probe |
| GET | /v1/metadata | Bot identity |
| POST | /v1/context | Receive context push |
| POST | /v1/tick | Periodic wake-up / proactive sends |
| POST | /v1/reply | Handle merchant/customer replies |
| POST | /v1/teardown | Wipe state (optional) |

## Testing & Evaluation

### 1. Challenge Test Harness
Run the automated test suite matching the judge's exact test harness:
```bash
export BOT_URL=https://vera-bot-r8yd.onrender.com
python test_vera_bot.py
```
This generates `vera_test_report.json` covering context pushes, `/v1/tick` actions, and all 4 behavioral probes.

### 2. Interactive Merchant Chat
Converse directly with Vera as a merchant in real time:
```bash
python chat_cli.py https://vera-bot-r8yd.onrender.com
```

### 3. Local Judge Simulator
```bash
python judge_simulator.py
```

## Live Deployment

- **Public HTTPS URL**: `https://vera-bot-r8yd.onrender.com`
- **Health check**: `https://vera-bot-r8yd.onrender.com/v1/healthz`
- **Metadata**: `https://vera-bot-r8yd.onrender.com/v1/metadata`
- **Host**: Render (Docker container, Node 20 alpine, always-on)

To run locally with Docker:
```bash
docker compose up --build
```
