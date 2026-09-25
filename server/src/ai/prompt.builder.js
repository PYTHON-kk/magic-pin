/**
 * Prompt builder — routes by trigger.kind to specialized prompt templates.
 *
 * This is where 80% of the judge score comes from.
 * Each trigger family gets a dedicated builder that frames the context
 * in a way that naturally produces high-scoring output across the 5 rubric dimensions:
 * Specificity, Category fit, Merchant fit, Trigger relevance, Engagement compulsion.
 */

/* ─── System prompt (shared by all trigger kinds) ─── */

function buildSystemPrompt(category, merchant, customer) {
  const isCustomerFacing = !!customer;
  const languages = merchant.identity?.languages || ['en'];
  const hasHindi = languages.includes('hi');
  const hasTamil = languages.includes('ta');
  const hasTelugu = languages.includes('te');
  const hasKannada = languages.includes('kn');
  const hasMarathi = languages.includes('mr');

  const voiceTone = category.voice?.tone || 'professional';
  const vocabAllowed = (category.voice?.vocab_allowed || []).join(', ');
  const vocabTaboo = (category.voice?.vocab_taboo || category.voice?.taboos || []).join(', ');
  const ownerName = merchant.identity?.owner_first_name || merchant.identity?.name;
  const salutations = category.voice?.salutation_examples || [];
  const convHistory = merchant.conversation_history || [];
  const hasPriorTurns = convHistory.some((t) => t.from === 'vera');

  let langInstruction = 'Use English.';
  if (isCustomerFacing && customer.identity?.language_pref) {
    const lp = customer.identity.language_pref.toLowerCase();
    if (lp.includes('hi') || lp.includes('hindi')) {
      langInstruction = 'Natural Hindi-English code-mix (Hinglish) is REQUIRED. Mix naturally, don\'t force either.';
    } else if (lp.includes('te') || lp.includes('telugu')) {
      langInstruction = 'Telugu-English mix preferred.';
    } else if (lp.includes('ta') || lp.includes('tamil')) {
      langInstruction = 'Tamil-English mix preferred.';
    } else {
      langInstruction = 'Use English.';
    }
  } else if (hasHindi) {
    langInstruction = 'Natural Hindi-English code-mix (Hinglish) is PREFERRED. Mix naturally.';
  }

  return `You are Vera, magicpin's WhatsApp merchant assistant. Compose ONE concise, contextual message.

IDENTITY:
- You help merchants grow their Google Business Profile, run campaigns, and engage customers.
- Speak as a knowledgeable peer/colleague, NOT a salesperson. Never be generic or promotional.
${salutations.length > 0 ? `- Use salutations like: ${salutations.join(', ')}` : ''}

HARD RULES:
1. SPECIFICITY: Anchor on at least one concrete, verifiable fact from CONTEXT (number, date, headline, peer stat, price). NEVER use generic phrases like "10% off", "grow your business", "increase your sales".
2. VOICE: Tone = ${voiceTone}. Technical vocabulary OK: ${vocabAllowed || 'general terms'}. NEVER use: ${vocabTaboo || 'none'}.
3. CTA: Exactly ONE call-to-action, in the LAST sentence. Action triggers → binary (Reply YES / STOP). Pure-information triggers → open-ended question or none. NEVER multiple CTAs.
4. NO FABRICATION: Do NOT invent facts, offers, competitors, citations, prices, or statistics not in CONTEXT.
5. LANGUAGE: ${langInstruction}
6. NO PREAMBLE: Skip "I hope you're doing well" — start with the hook directly.
${hasPriorTurns ? '7. NO RE-INTRODUCTION: Prior Vera turns exist — do NOT re-introduce yourself.' : '7. FIRST TOUCH: This is the first message — identify as Vera briefly.'}
8. CONCISE: WhatsApp-friendly. Max 3-4 short paragraphs. No walls of text.
${isCustomerFacing ? `9. CUSTOMER-FACING: This is sent FROM the merchant's WhatsApp TO their customer. Draft on the merchant's behalf.
   - Use the customer's name. Match their language preference.
   - NO medical overclaims. NO "guaranteed", "cure", "100% safe".
   - Message appears from "${merchant.identity?.name}", not from Vera.
   - Only message about topics within the customer's consent scope: ${customer.consent?.scope?.join(', ') || 'general'}.` : `9. MERCHANT-FACING: This goes directly to the merchant from Vera.`}

ENGAGEMENT LEVERS (use 1-2):
- Specificity: concrete numbers, dates, source citations
- Loss aversion: "you're missing X" / "before this window closes"
- Social proof: "X businesses in your area did Y"
- Effort externalization: "I've drafted X — just say go"
- Curiosity: "want to see?" / "want the full list?"
- Reciprocity: "noticed Y about your account, thought you'd want to know"
- Asking the merchant: "what's your most popular X this week?"

OUTPUT — Return ONLY valid JSON (no markdown, no extra text):
{
  "body": "the WhatsApp message",
  "cta": "open_ended" | "binary_yes_stop" | "none",
  "rationale": "2-3 sentences: why this message, which scoring dimensions it targets, which engagement lever",
  "templateParams": ["param1", "param2", "param3"]
}`;
}

/* ─── Helper: extract merchant summary for prompt context ─── */

function merchantSummary(merchant) {
  return {
    name: merchant.identity?.name,
    owner: merchant.identity?.owner_first_name,
    locality: merchant.identity?.locality,
    city: merchant.identity?.city,
    languages: merchant.identity?.languages,
    verified: merchant.identity?.verified,
    subscription: merchant.subscription,
    performance: merchant.performance,
    offers: merchant.offers,
    signals: merchant.signals,
    customer_aggregate: merchant.customer_aggregate,
    review_themes: merchant.review_themes,
    conversation_history: (merchant.conversation_history || []).slice(-3),
  };
}

function customerSummary(customer) {
  if (!customer) return null;
  return {
    name: customer.identity?.name,
    language_pref: customer.identity?.language_pref,
    age_band: customer.identity?.age_band,
    relationship: customer.relationship,
    state: customer.state,
    preferences: customer.preferences,
    consent_scope: customer.consent?.scope,
  };
}

function findDigestItem(category, trigger) {
  const itemId = trigger.payload?.top_item_id || trigger.payload?.digest_item_id || trigger.payload?.alert_id;
  if (itemId && category.digest) {
    return category.digest.find((d) => d.id === itemId) || null;
  }
  return null;
}

/* ─── Trigger-specific prompt builders ─── */

// 1. Research / Knowledge family
function buildResearchPrompt({ category, merchant, trigger, customer }) {
  const digestItem = findDigestItem(category, trigger);
  return {
    system: buildSystemPrompt(category, merchant, customer),
    user: JSON.stringify({
      trigger_kind: trigger.kind,
      trigger_urgency: trigger.urgency,
      merchant: merchantSummary(merchant),
      digest_item: digestItem,
      category_peer_stats: category.peer_stats,
      category_slug: category.slug,
      instruction: 'Surface this specific research/digest/compliance item. Tie it to something about THIS merchant (their patient cohort, signals, performance, or offers). Ask a low-friction follow-up question. Use source citation (journal, page, trial size). Peer/clinical tone — no promotional language.',
    }),
  };
}

// 2. Performance family (perf_dip, perf_spike, seasonal_perf_dip, milestone_reached)
function buildPerformancePrompt({ category, merchant, trigger, customer }) {
  return {
    system: buildSystemPrompt(category, merchant, customer),
    user: JSON.stringify({
      trigger_kind: trigger.kind,
      trigger_urgency: trigger.urgency,
      trigger_data: trigger.payload,
      merchant: merchantSummary(merchant),
      category_peer_stats: category.peer_stats,
      category_slug: category.slug,
      instruction: trigger.kind === 'perf_spike' || trigger.kind === 'milestone_reached'
        ? 'Celebrate this positive performance signal with specific numbers. Suggest a concrete next step to capitalize on the momentum (e.g., post, offer, campaign). Use the exact metric delta from the trigger.'
        : trigger.kind === 'seasonal_perf_dip'
        ? 'Acknowledge the dip is seasonal/expected — frame it as normal, not alarming. Suggest proactive action for the recovery window. Use specific numbers from the trigger.'
        : 'Highlight the performance dip with specific numbers. Frame as loss aversion ("you\'re missing X"). Suggest ONE concrete, low-effort action to reverse it. Compare to peer stats if below median.',
    }),
  };
}

// 3. Customer recall / engagement family
function buildCustomerRecallPrompt({ category, merchant, trigger, customer }) {
  return {
    system: buildSystemPrompt(category, merchant, customer),
    user: JSON.stringify({
      trigger_kind: trigger.kind,
      trigger_urgency: trigger.urgency,
      trigger_data: trigger.payload,
      merchant: merchantSummary(merchant),
      customer: customerSummary(customer),
      merchant_offers: merchant.offers?.filter((o) => o.status === 'active'),
      category_slug: category.slug,
      instruction: `This is a CUSTOMER-FACING message. Draft it from the merchant's perspective.
- Use the customer's name and preferred language.
- Reference specific service history and dates from their relationship.
- Include actual slot times from the trigger payload if available.
- Include real pricing from active offers.
- For recall_due: reference the recall interval and last visit date.
- For chronic_refill_due: reference the molecule list and last refill date.
- For customer_lapsed_hard: use a warm win-back tone, not guilt.
- For trial_followup: reference the trial date and next session options.
- For wedding_package_followup: reference the wedding date and next steps.`,
    }),
  };
}

// 4. Engagement / dormancy family
function buildEngagementPrompt({ category, merchant, trigger, customer }) {
  return {
    system: buildSystemPrompt(category, merchant, customer),
    user: JSON.stringify({
      trigger_kind: trigger.kind,
      trigger_urgency: trigger.urgency,
      trigger_data: trigger.payload,
      merchant: merchantSummary(merchant),
      category_peer_stats: category.peer_stats,
      category_trend_signals: category.trend_signals,
      category_slug: category.slug,
      instruction: trigger.kind === 'curious_ask_due'
        ? 'Ask the merchant a genuine, category-relevant question that invites knowledge sharing. Use curiosity lever. Reference something from their category or locality to make it specific. Example: "What service is most in-demand at your clinic this week?"'
        : trigger.kind === 'active_planning_intent'
        ? 'The merchant has expressed planning intent (see their last message in trigger_data). Respond with a CONCRETE, actionable plan — specific pricing, format, timeline. Do NOT ask another qualifying question. This is action mode, not pitch mode.'
        : 'Re-engage this dormant merchant. Use curiosity or reciprocity — share something interesting about their category or performance that gives them a reason to reply. Do NOT guilt them for being inactive.',
    }),
  };
}

// 5. Event family (festival, IPL, weather, competitor, seasonal)
function buildEventPrompt({ category, merchant, trigger, customer }) {
  return {
    system: buildSystemPrompt(category, merchant, customer),
    user: JSON.stringify({
      trigger_kind: trigger.kind,
      trigger_urgency: trigger.urgency,
      trigger_data: trigger.payload,
      merchant: merchantSummary(merchant),
      merchant_offers: merchant.offers?.filter((o) => o.status === 'active'),
      category_slug: category.slug,
      category_seasonal_beats: category.seasonal_beats,
      instruction: trigger.kind === 'competitor_opened'
        ? 'A competitor opened nearby. Frame using curiosity ("want to see their offer?"). Compare with the merchant\'s offer if they have one. Do NOT trash-talk the competitor. Use the distance and competitor details from trigger data.'
        : trigger.kind === 'ipl_match_today'
        ? 'An IPL match is happening in/near the merchant\'s city today. Suggest a match-night promotion tied to their category. Use the specific match details from trigger data. Keep it fun and timely.'
        : trigger.kind === 'category_seasonal'
        ? 'Seasonal demand is shifting. Share the specific trend data from the trigger. Suggest shelf/menu/service adjustments. Use concrete numbers (demand +/- percentages).'
        : 'An event is relevant to this merchant. Tie it to their specific business and offer a concrete action. Use event details from the trigger.',
    }),
  };
}

// 6. Business / operational family (renewal, winback, GBP, reviews)
function buildBusinessPrompt({ category, merchant, trigger, customer }) {
  return {
    system: buildSystemPrompt(category, merchant, customer),
    user: JSON.stringify({
      trigger_kind: trigger.kind,
      trigger_urgency: trigger.urgency,
      trigger_data: trigger.payload,
      merchant: merchantSummary(merchant),
      category_peer_stats: category.peer_stats,
      category_slug: category.slug,
      instruction: trigger.kind === 'renewal_due'
        ? 'Subscription renewal is due. Lead with VALUE the merchant has received (views, calls, leads). Then mention the renewal timeline. Include specific performance numbers. Do NOT hard-sell.'
        : trigger.kind === 'winback_eligible'
        ? 'The merchant\'s subscription expired and they\'re eligible for win-back. Show them what they\'ve been missing (perf dip since expiry). Offer to restart with a specific, low-effort action.'
        : trigger.kind === 'gbp_unverified'
        ? 'The merchant\'s Google Business Profile is unverified. Explain the concrete uplift they\'re missing (use the estimated_uplift_pct). Offer to guide them through verification. Keep it simple.'
        : trigger.kind === 'review_theme_emerged'
        ? 'A review theme has emerged — surface the specific theme, sentiment, count, and a representative quote. If negative, frame constructively (opportunity to address). If positive, suggest amplifying it.'
        : trigger.kind === 'supply_alert'
        ? 'URGENT: A supply/recall alert. Lead with the critical details (molecule, affected batches, manufacturer). Offer to help with the customer-facing communication. This is high-urgency — be direct and clinical.'
        : 'Address this operational trigger with specific data from the trigger payload. Tie it to the merchant\'s current state.',
    }),
  };
}

// 7. Generic fallback
function buildGenericPrompt({ category, merchant, trigger, customer }) {
  return {
    system: buildSystemPrompt(category, merchant, customer),
    user: JSON.stringify({
      trigger_kind: trigger.kind,
      trigger_urgency: trigger.urgency,
      trigger_data: trigger.payload,
      merchant: merchantSummary(merchant),
      customer: customer ? customerSummary(customer) : null,
      category_peer_stats: category.peer_stats,
      category_slug: category.slug,
      instruction: 'Compose a contextual message based on this trigger. Anchor on specific facts from the context. Use the appropriate engagement lever. Match category voice and merchant language.',
    }),
  };
}

/* ─── Routing table ─── */

const PROMPT_BUILDERS = {
  // Research / Knowledge
  research_digest: buildResearchPrompt,
  regulation_change: buildResearchPrompt,
  cde_opportunity: buildResearchPrompt,
  supply_alert: buildBusinessPrompt,

  // Performance
  perf_spike: buildPerformancePrompt,
  perf_dip: buildPerformancePrompt,
  seasonal_perf_dip: buildPerformancePrompt,
  milestone_reached: buildPerformancePrompt,

  // Customer recall
  recall_due: buildCustomerRecallPrompt,
  chronic_refill_due: buildCustomerRecallPrompt,
  customer_lapsed_hard: buildCustomerRecallPrompt,
  trial_followup: buildCustomerRecallPrompt,
  wedding_package_followup: buildCustomerRecallPrompt,

  // Engagement
  dormant_with_vera: buildEngagementPrompt,
  curious_ask_due: buildEngagementPrompt,
  active_planning_intent: buildEngagementPrompt,

  // Events
  festival_upcoming: buildEventPrompt,
  ipl_match_today: buildEventPrompt,
  competitor_opened: buildEventPrompt,
  category_seasonal: buildEventPrompt,

  // Business operations
  renewal_due: buildBusinessPrompt,
  winback_eligible: buildBusinessPrompt,
  gbp_unverified: buildBusinessPrompt,
  review_theme_emerged: buildBusinessPrompt,
};

/**
 * Build the prompt for a given set of contexts.
 * @returns {{system: string, user: string}}
 */
function buildPrompt({ category, merchant, trigger, customer }) {
  const builder = PROMPT_BUILDERS[trigger.kind] || buildGenericPrompt;
  return builder({ category, merchant, trigger, customer });
}

/**
 * Build a reply-mode prompt for /v1/reply conversation turns.
 */
function buildReplyPrompt({ category, merchant, customer, conversation, latestMessage }) {
  const isCustomerFacing = !!customer;
  const turnsSummary = (conversation.turns || [])
    .slice(-6)
    .map((t) => `[${t.from.toUpperCase()}] ${t.message}`)
    .join('\n');

  return {
    system: buildSystemPrompt(category, merchant, customer),
    user: JSON.stringify({
      mode: 'reply',
      conversation_so_far: turnsSummary,
      latest_message: latestMessage,
      merchant: merchantSummary(merchant),
      customer: customer ? customerSummary(customer) : null,
      category_slug: category.slug,
      instruction: `The merchant/customer just replied. Compose the next message in the conversation.
- Read the conversation history carefully.
- Do NOT repeat what you already said.
- If the merchant agreed to something ("yes", "go ahead"), TAKE ACTION — do NOT ask another qualifying question.
- If the merchant asked a question, answer it directly with facts from the context.
- If the merchant said something off-topic, politely redirect to what you can help with.
- Keep advancing the conversation toward a useful outcome.
Return ONLY JSON: {"body": "...", "cta": "...", "rationale": "..."}`,
    }),
  };
}

module.exports = {
  buildPrompt,
  buildReplyPrompt,
  buildSystemPrompt,
  PROMPT_BUILDERS,
};
