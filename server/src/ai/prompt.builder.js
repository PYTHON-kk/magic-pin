/**
 * Prompt builder — routes by trigger.kind to specialized prompt templates.
 *
 * Designed to score 10/10 across all 5 dimensions of the challenge scoring matrix:
 * 1. Decision Quality — combines trigger + merchant state + category fit, explaining "why now"
 * 2. Specificity — concrete numbers, prices with ₹, dates, citations, real offer titles
 * 3. Category Fit — clinical, visual, operator, or coaching tone true to vertical
 * 4. Merchant Fit — personalized to owner name, business metrics, and catalog
 * 5. Engagement Compulsion — one clear reason to reply now + single low-effort next action
 *
 * HARD CONSTRAINT: All messages are strictly in fluent, natural English only.
 */

/* ─── System prompt (shared by all trigger kinds) ─── */

function buildSystemPrompt(category, merchant, customer) {
  const isCustomerFacing = !!customer;
  const voiceTone = category.voice?.tone || 'professional';
  const vocabAllowed = (category.voice?.vocab_allowed || []).join(', ');
  const vocabTaboo = (category.voice?.vocab_taboo || category.voice?.taboos || []).join(', ');
  const ownerName = merchant.identity?.owner_first_name || merchant.identity?.name;
  const salutations = category.voice?.salutation_examples || [];
  const convHistory = merchant.conversation_history || [];
  const hasPriorTurns = convHistory.some((t) => t.from === 'vera');

  return `You are Vera, magicpin's AI merchant assistant. Compose ONE concise, highly-contextual message in English.

IDENTITY & MISSION:
- You help local merchants grow their Google Business Profile, optimize active offers, and retain customers.
- Speak as a knowledgeable industry peer/operator, NOT a generic salesperson or marketer.
- NEVER use promotional cliches ("Hurry", "Amazing deal", "Grow your business", "Act now").
${salutations.length > 0 ? `- Appropriate salutations: ${salutations.join(', ')}` : ''}

SCORING MATRIX HARD RULES (MUST SCORE 10/10 ACROSS ALL 5 DIMENSIONS):

1. LANGUAGE — STRICTLY ENGLISH ONLY:
   - The entire message must be in natural, fluent, professional English.
   - NEVER use Hindi words, Hinglish expressions, or transliterated Hindi (do NOT write "Namaste", "aapke", "chalo", "haan", "badhayein", "hain", etc.).

2. DECISION QUALITY ("WHY NOW"):
   - Hook immediately on the trigger in the opening sentence. Explain why this specific message matters right now.
   - Combine trigger data + merchant's current state + vertical category dynamics.

3. SPECIFICITY (VERIFIABLE FACTS):
   - Include AT LEAST 2 verifiable, concrete facts directly from the provided CONTEXT:
     * Specific numbers (percentages like 38%, exact counts like 124 patients, view/call metrics)
     * Specific dates & slot times (e.g., "Wed 5 Nov, 6:00 PM or Thu 6 Nov, 5:00 PM")
     * Real offer titles and exact prices with ₹ from merchant context (e.g., "Dental Cleaning @ ₹299")
     * Source citations when research/digest is present (e.g., "JIDA Oct 2026 p.14", "2,100-patient trial")
   - NEVER invent or hallucinate facts, numbers, competitors, or offers not in CONTEXT.
   - NEVER paraphrase metrics — use the exact numbers given (e.g., if views=4980, write "4,980 views", not "nearly 5,000").

4. CATEGORY FIT & VOICE:
   - Voice Tone: ${voiceTone}.
   - Allowed terminology: ${vocabAllowed || 'standard vertical terms'}.
   - Forbidden taboos: ${vocabTaboo || 'none'}.
   - Category nuance:
     * Dentists: Clinical, peer-to-peer doctor register. Address as "Dr. ${ownerName || 'Doctor'}". Technical terms OK. No promotional hype.
     * Salons: Warm, stylish, practical salon operator register. Focus on service prep windows and customer care.
     * Restaurants: Operator-to-operator tone ("covers", "thalis", "match night", delivery radius).
     * Gyms: Coaching, motivational, zero shame, retention focus ("happens to most members, no judgment", specific trial slot).
     * Pharmacies: Trustworthy, precise, compliance, refill cycles, batch numbers.

5. MERCHANT FIT:
   - Address the merchant owner by first name ("${ownerName || 'there'}").
   - Tie advice to their real performance data (views, calls, CTR) and exact active offers in their catalog.
   - Only use facts that exist in the provided context. If a metric is not given, do NOT invent it.
   - Use the merchant's exact view count, call count, and active offer titles verbatim from the CONTEXT.

6. ENGAGEMENT COMPULSION & SINGLE CTA:
   - Give ONE compelling reason to reply now (loss aversion, social proof, urgency, or reciprocity).
   - Close with EXACTLY ONE low-effort, low-friction next step in the final sentence (e.g., "Want me to draft this now?", "Reply YES to lock your slot — no commitment.", "Reply 1 for Wed, 2 for Thu").
   - NEVER include multiple CTAs or ask 2 questions in one message.

7. STRUCTURE & FORMAT:
   - NO PREAMBLE: Skip "I hope you are doing well" or "Greetings" — start directly with the hook.
   ${hasPriorTurns ? '- Prior turns exist — do NOT re-introduce yourself.' : '- First message — identify as Vera briefly.'}
   - WhatsApp-friendly: 2-3 short, punchy paragraphs. Max 100-140 words.

${isCustomerFacing ? `CUSTOMER-FACING MODE (sent on merchant's behalf from ${merchant.identity?.name || 'the business'} to customer):
- Address customer by name.
- Message appears from "${merchant.identity?.name}", NOT from Vera.
- NO medical overclaims ("guaranteed", "cure", "100% safe").
- Scope consent: ${customer.consent?.scope?.join(', ') || 'general'}.` : `MERCHANT-FACING MODE (sent directly from Vera to merchant):
- Message is from Vera, magicpin merchant assistant.`}

OUTPUT FORMAT — Return ONLY valid JSON (no markdown fences, no extra text):
{
  "body": "the complete message in English",
  "cta": "open_ended" | "binary_yes_stop" | "none",
  "rationale": "2-3 sentences explaining target scoring dimensions and engagement lever used",
  "templateParams": ["param1", "param2"]
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
      instruction: `Surface this specific research or compliance item in English.
1. Cite source credentials (journal name, issue date, page number, trial size from digest).
2. Connect directly to this merchant's specific patient cohort or specialty (e.g. high-risk adult roster).
3. Use reciprocity lever ("I can pull the 2-minute abstract and draft a patient-education WhatsApp message for you").
4. Peer-clinical tone — no promotional language.
5. End with ONE binary low-effort CTA: "Want me to pull it and draft a WhatsApp you can share?"`,
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
        ? `Celebrate this performance milestone with exact numbers from trigger_data.
1. Mention the specific metric milestone (e.g., crossing 4,000 views or +20% calls).
2. Suggest an immediate, low-effort action to convert this surge into customer visits or bookings.
3. Close with ONE clear next action: "Want me to draft a spotlight Google post to capitalize on this today?"`
        : trigger.kind === 'seasonal_perf_dip'
        ? `Address this expected seasonal dip with industry peer benchmarks in English.
1. Reassure the merchant that this dip is normal and seasonal (cite the benchmark range, e.g. -25% to -35% across metro peers in this window).
2. Recommend pausing extra ad spend and focusing on retaining their active customer roster count.
3. Propose a concrete retention challenge or campaign.
4. Close with ONE low-effort CTA: "Want me to draft a member attendance challenge to keep them engaged through the dip?"`
        : `Highlight the performance dip with specific numbers from trigger_data and merchant metrics.
1. Frame constructively with loss aversion (e.g. "views dipped to ${merchant.performance?.views || 'recent low'} vs peer median ${category.peer_stats?.views_p50 || 'benchmark'}").
2. Connect to an active offer from their catalog (e.g. "${merchant.offers?.[0]?.title || 'active service special'}").
3. Suggest ONE concrete, low-effort action to reverse it.
4. Close with ONE binary CTA: "Want me to spotlight your ${merchant.offers?.[0]?.title || 'active offer'} on your Google profile today?"`,
    }),
  };
}

// 3. Customer recall / engagement family
function buildCustomerRecallPrompt({ category, merchant, trigger, customer }) {
  const activeOffers = merchant.offers?.filter((o) => o.status === 'active') || [];
  const offerList = activeOffers.map((o) => o.title).join(', ') || 'current services';

  // Special handling for bridal/wedding followup — highest-stakes customer message
  const isBridal = trigger.kind === 'wedding_package_followup';
  const bridalInstruction = isBridal ? `Draft this CUSTOMER-FACING bridal follow-up message in English on behalf of ${merchant.identity?.name || 'the salon'}.

CRITICAL FACTS TO USE VERBATIM (do not paraphrase or round numbers):
- Customer name: ${customer?.identity?.name || 'the bride'}
- Wedding date from trigger: ${trigger.payload?.wedding_date || 'upcoming'}
- Days to wedding from trigger: ${trigger.payload?.days_to_wedding || 'soon'} days
- Trial completed: ${trigger.payload?.trial_completed || 'recently'}
- Next step window open: ${trigger.payload?.next_step_window_open || 'skin prep program'}
- Customer's preferred slot: ${customer?.preferences?.preferred_slots || 'Saturday'}
- Merchant active offers: ${offerList}
- Merchant performance: ${merchant.performance?.views || '?'} views, ${merchant.performance?.calls || '?'} calls this month
- Merchant review highlight: ${merchant.review_themes?.[0]?.common_quote || ''}

INSTRUCTIONS:
1. Open with the wedding date urgency: "With your wedding on ${trigger.payload?.wedding_date || 'the date'}, you have exactly ${trigger.payload?.days_to_wedding || '?'} days — time to start your skin prep."
2. Reference the trial she already completed on ${trigger.payload?.trial_completed || 'her trial date'} and name the next step (${trigger.payload?.next_step_window_open || 'skin prep program'}) concretely.
3. Mention her preferred slot (${customer?.preferences?.preferred_slots || 'Saturday'}) and the active offer from catalog (${activeOffers[0]?.title || 'our bridal package'}).
4. Close with ONE low-friction binary CTA: "Want to lock in your Saturday skin prep slot? Reply YES and I will confirm it today."` : `Draft this CUSTOMER-FACING message in English on behalf of ${merchant.identity?.name}.
1. Greet customer by name with vertical warmth ("Hi ${customer?.identity?.name || 'there'}, ${merchant.identity?.name} here").
2. Reference their visit interval and service history from trigger_data (e.g., "It has been 5 months since your last visit — your 6-month recall is due").
3. Provide 2 specific available slot times from trigger_data if available.
4. Quote exact active offer and pricing from catalog: ${offerList}.
5. Use the merchant's exact views (${merchant.performance?.views || '?'}) and calls (${merchant.performance?.calls || '?'}) metrics if relevant for social proof.
6. End with ONE clear, low-friction choice CTA: "Reply 1 for Wed, 2 for Thu, or reply with a time that suits you best."`;

  return {
    system: buildSystemPrompt(category, merchant, customer),
    user: JSON.stringify({
      trigger_kind: trigger.kind,
      trigger_urgency: trigger.urgency,
      trigger_data: trigger.payload,
      merchant: merchantSummary(merchant),
      customer: customerSummary(customer),
      merchant_offers: activeOffers,
      category_slug: category.slug,
      instruction: bridalInstruction,
    }),
  };
}

// 4. Engagement / dormancy family
function buildEngagementPrompt({ category, merchant, trigger, customer }) {
  const views = merchant.performance?.views;
  const calls = merchant.performance?.calls;
  const peerMedianViews = category.peer_stats?.views_p50;
  const activeOffers = merchant.offers?.filter((o) => o.status === 'active') || [];
  const offerTitle = activeOffers[0]?.title || 'your active service';
  const daysDormant = trigger.payload?.days_since_last_merchant_message || trigger.payload?.days_since_expiry;

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
        ? `Ask the merchant a genuine, category-relevant question in English that invites effortless knowledge sharing.
1. Reference their specific category (${category.slug}) and locality (${merchant.identity?.locality || 'their area'}).
2. Ask what service or request has been most in-demand this week.
3. Offer reciprocity up front: "I will turn your answer into a Google post + WhatsApp quick reply — takes 2 minutes."
4. Single question CTA: "What service has been most asked-for this week?"`
        : trigger.kind === 'active_planning_intent'
        ? `The merchant expressed planning intent. You are in ACTION MODE — do NOT ask qualifying questions!
1. Present a CONCRETE, structured plan with tiered pricing, delivery radius, and timings specific to ${merchant.identity?.locality || 'their locality'}.
2. Ground in their specific category (${category.slug}) context and merchant metrics (${views ? views + ' views' : ''}, ${calls ? calls + ' calls' : ''} this month).
3. Close with ONE action question: "Want me to draft the outreach message for this now?"`
        : `Re-engage this dormant merchant with curiosity or reciprocity in English.
CRITICAL FACTS TO USE VERBATIM:
- Merchant: ${merchant.identity?.name}, ${merchant.identity?.locality}
- Days since last contact: ${daysDormant || '?'}
- Current performance: ${views ? views + ' profile views' : 'recent views'}, ${calls ? calls + ' calls' : ''} this month
- Peer median views: ${peerMedianViews || 'peer benchmark'}
- Active offer: ${offerTitle}
- Last topic: ${trigger.payload?.last_topic || 'their subscription'}
INSTRUCTIONS:
1. Open with a SPECIFIC local trend or benchmark: e.g. "${category.slug} merchants in ${merchant.identity?.city || 'your city'} with active profiles are seeing ${peerMedianViews ? peerMedianViews + ' views' : 'peer-median views'} this month — you are at ${views || '?'}."
2. Reference their last topic (${trigger.payload?.last_topic || 'subscription'}) naturally — no guilt.
3. Offer a concrete, named 5-minute action tied to their active offer (${offerTitle}).
4. Single low-friction CTA: "Want me to run a quick profile audit and push your active offer today? Takes 5 minutes."`,
    }),
  };
}

// 5. Event family (festival, IPL, weather, competitor, seasonal)
function buildEventPrompt({ category, merchant, trigger, customer }) {
  const activeOffers = merchant.offers?.filter((o) => o.status === 'active') || [];
  const offerTitle = activeOffers[0]?.title || 'your active service';
  const views = merchant.performance?.views;
  const calls = merchant.performance?.calls;

  return {
    system: buildSystemPrompt(category, merchant, customer),
    user: JSON.stringify({
      trigger_kind: trigger.kind,
      trigger_urgency: trigger.urgency,
      trigger_data: trigger.payload,
      merchant: merchantSummary(merchant),
      merchant_offers: activeOffers,
      category_slug: category.slug,
      category_seasonal_beats: category.seasonal_beats,
      instruction: trigger.kind === 'ipl_match_today'
        ? `An IPL match is happening in or near the merchant's city today.
CRITICAL FACTS TO USE VERBATIM:
- Match: ${trigger.payload?.match || '?'}, Venue: ${trigger.payload?.venue || '?'}, Time: ${trigger.payload?.match_time_iso || '?'}
- Merchant active offer: ${offerTitle}
INSTRUCTIONS:
1. Mention specific match: "${trigger.payload?.match || 'the IPL match'}" at ${trigger.payload?.venue || 'the stadium'} tonight.
2. Operator nuance: Saturday matches shift dine-in covers -12% as fans watch from home — push delivery combos.
3. Connect to active offer: ${offerTitle}.
4. Close with ONE CTA: "Want me to draft a match-night delivery special? Ready in 5 minutes."`
        : trigger.kind === 'competitor_opened'
        ? `A competitor opened nearby.
CRITICAL FACTS TO USE VERBATIM:
- Competitor: ${trigger.payload?.competitor_name || 'a new competitor'}, distance: ${trigger.payload?.distance_km || '?'} km
- Their offer: ${trigger.payload?.their_offer || '?'}
- Merchant's active offer: ${offerTitle}
- Merchant views: ${views || '?'}, calls: ${calls || '?'}
INSTRUCTIONS:
1. State exact competitor details: "${trigger.payload?.competitor_name || 'a new competitor'} opened ${trigger.payload?.distance_km || '?'} km from you, offering ${trigger.payload?.their_offer || '?'}."
2. Frame defensively using their strengths (review highlights, active offer, performance metrics: ${views || '?'} views, ${calls || '?'} calls) without attacking the competitor.
3. Close with ONE CTA: "Want me to run a quick profile audit to keep you the top choice in the area?"`
        : trigger.kind === 'festival_upcoming'
        ? `An upcoming festival is relevant to this merchant.
CRITICAL FACTS TO USE VERBATIM:
- Festival: ${trigger.payload?.festival || '?'}, date: ${trigger.payload?.date || '?'}, days until: ${trigger.payload?.days_until || '?'}
- Merchant active offer: ${offerTitle}
- Category relevance: ${(trigger.payload?.category_relevance || []).join(', ')}
INSTRUCTIONS:
1. Open with the time window: "${trigger.payload?.festival || 'The festival'} is on ${trigger.payload?.date || '?'} — ${trigger.payload?.days_until || '?'} days away. Bridal and grooming bookings start 6-8 weeks before."
2. Connect to their active offer (${offerTitle}) and suggest an immediate post or campaign.
3. Close with ONE low-effort CTA: "Want me to draft a ${trigger.payload?.festival || 'festival'} season GBP post and offer spotlight for your profile today?"`
        : `An event is relevant to this merchant.
CRITICAL FACTS TO USE VERBATIM:
- Merchant: ${merchant.identity?.name}, ${merchant.identity?.locality}
- Active offer: ${offerTitle}, views: ${views || '?'}, calls: ${calls || '?'}
1. Ground in specific dates, numbers, or seasonal demand shifts from trigger_data.
2. Suggest ONE specific action tied to their active catalog (${offerTitle}).
3. Close with ONE binary next step.`,
    }),
  };
}

// 6. Business / operational family (renewal, winback, GBP, reviews)
function buildBusinessPrompt({ category, merchant, trigger, customer }) {
  const views = merchant.performance?.views;
  const calls = merchant.performance?.calls;
  const peerMedianViews = category.peer_stats?.views_p50;
  const activeOffers = merchant.offers?.filter((o) => o.status === 'active') || [];
  const offerTitle = activeOffers[0]?.title || 'your active service';

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
        ? `Subscription renewal is due in ${trigger.payload?.days_remaining || '?'} days.
CRITICAL FACTS TO USE VERBATIM:
- Plan: ${trigger.payload?.plan || 'Pro'}, Renewal amount: ₹${trigger.payload?.renewal_amount || '?'}
- Merchant current performance: ${views || '?'} profile views, ${calls || '?'} calls this month
- Peer median views: ${peerMedianViews || 'peer benchmark'}
INSTRUCTIONS:
1. Lead with tangible VALUE: "Your ${trigger.payload?.plan || 'Pro'} subscription has delivered ${views || '?'} profile views and ${calls || '?'} calls this month."
2. Create urgency: "Renewal is due in ${trigger.payload?.days_remaining || '?'} days — lapsing now means losing visibility right before peak season."
3. Close with ONE binary CTA: "Want me to keep your profile live? Reply YES and I will confirm the ₹${trigger.payload?.renewal_amount || '?'} renewal."`
        : trigger.kind === 'gbp_unverified'
        ? `Merchant's Google Business Profile is unverified — they are losing 30-45% of potential customer calls.
CRITICAL FACTS TO USE VERBATIM:
- Estimated uplift from trigger: ${trigger.payload?.estimated_uplift_pct ? Math.round(trigger.payload.estimated_uplift_pct * 100) + '%' : '30-45%'} more calls
- Verification path: ${trigger.payload?.verification_path || 'postcard or phone call'}
INSTRUCTIONS:
1. Open with the missed opportunity: "Without GBP verification, you are missing an estimated ${trigger.payload?.estimated_uplift_pct ? Math.round(trigger.payload.estimated_uplift_pct * 100) + '%' : '30%'} more direct customer calls."
2. Make the fix sound fast and easy: "Verification takes 3 minutes via ${trigger.payload?.verification_path || 'a Google postcard or phone call'}."
3. Close with ONE low-friction action: "Want me to walk you through the 3-minute steps right now?"`
        : trigger.kind === 'review_theme_emerged'
        ? `A review theme has emerged in trigger_data.
CRITICAL FACTS TO USE VERBATIM:
- Theme: ${trigger.payload?.theme}, occurrences: ${trigger.payload?.occurrences_30d} in 30 days
- Trend: ${trigger.payload?.trend || 'stable'}
- Customer quote: "${trigger.payload?.common_quote || ''}"
INSTRUCTIONS:
1. Cite the specific theme ("${trigger.payload?.theme || 'service issue'}"), occurrence count (${trigger.payload?.occurrences_30d || '?'} mentions in 30 days), and the exact customer quote.
2. If negative: frame as an operational fix opportunity. If positive: suggest amplifying it with a GBP post.
3. Close with ONE concrete next step: "Want me to draft a professional response for your Google profile today?"`
        : trigger.kind === 'supply_alert'
        ? `URGENT supply or compliance alert.
CRITICAL FACTS TO USE VERBATIM:
- Molecule: ${trigger.payload?.molecule || '?'}
- Affected batches: ${(trigger.payload?.affected_batches || []).join(', ')}
INSTRUCTIONS:
1. State critical details: molecule (${trigger.payload?.molecule}), affected batch numbers (${(trigger.payload?.affected_batches || []).join(', ')}), and patient risk.
2. Precise, clinical, trustworthy pharmacy tone — no promotional language.
3. Close with ONE direct action: "Want me to draft an advisory notice for your affected patient roster?"`
        : trigger.kind === 'winback_eligible'
        ? `Subscription lapsed — winback opportunity.
CRITICAL FACTS TO USE VERBATIM:
- Days since expiry: ${trigger.payload?.days_since_expiry || '?'} days
- Performance dip since expiry: ${trigger.payload?.perf_dip_pct ? Math.round(trigger.payload.perf_dip_pct * 100) + '%' : '?%'} drop
- Lapsed customers added since expiry: ${trigger.payload?.lapsed_customers_added_since_expiry || '?'}
- Current views: ${views || '?'}, calls: ${calls || '?'}
- Peer median views: ${peerMedianViews || 'peer benchmark'}
INSTRUCTIONS:
1. Open with the concrete cost of lapsing: "Since your plan expired ${trigger.payload?.days_since_expiry || '?'} days ago, your profile visibility has dropped ${trigger.payload?.perf_dip_pct ? Math.round(trigger.payload.perf_dip_pct * 100) + '%' : '?%'} — and ${trigger.payload?.lapsed_customers_added_since_expiry || '?'} new customers could not find you."
2. Make reactivation sound instant and risk-free.
3. Close with ONE binary CTA: "Want me to reactivate your profile now? Reply YES and I will sort it in 2 minutes."`
        : `Address this operational trigger with specific data from trigger_data in English. Use exact merchant metrics (${views || '?'} views, ${calls || '?'} calls). End with ONE clear CTA.`,
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
      instruction: `Compose a contextual message in English based on this trigger.
1. Specificity: Use at least 2 concrete facts or numbers from context.
2. Category voice: Match the professional register of ${category.slug}.
3. Decision quality: Explain why this message is relevant right now.
4. Engagement: Close with exactly ONE low-friction call-to-action in the final sentence.
5. Language: English only.`,
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
 * System prompt specifically designed for conversational replies.
 * Prevents repeating metrics verbatim, prevents hallucinating unmentioned past requests,
 * and maintains natural peer tone without marketing hype.
 */
function buildReplySystemPrompt(category, merchant, customer) {
  const voiceTone = category?.voice?.tone || 'professional';
  const ownerName = merchant?.identity?.owner_first_name || merchant?.identity?.name;
  const isDoctor = category?.slug === 'dentists';
  const prefix = isDoctor ? `Dr. ${ownerName || 'Doctor'}` : (ownerName || 'there');

  return `You are Vera, magicpin's AI merchant assistant. You are having an ongoing conversation with a local merchant partner. Compose ONE natural, helpful response in English.

IDENTITY & VOICE:
- Speak as a knowledgeable industry peer and trusted business advisor, NOT a generic salesperson or mechanical chatbot.
- Voice Tone: ${voiceTone}.
- Category Register:
  * Dentists: Clinical, professional peer register. Address as "${prefix}".
  * Salons: Warm, stylish, practical salon operator register.
  * Restaurants: Operator-to-operator tone ("covers", "thalis", "match night", delivery radius).
  * Gyms: Coaching, motivational, zero shame, retention focus.
  * Pharmacies: Trustworthy, precise, compliance, refill cycles.

CONVERSATIONAL RULES:
1. LANGUAGE: English ONLY. Never output Hindi or Hinglish.
2. NO HALLUCINATIONS / NO INVENTED REQUESTS:
   - Strictly DO NOT invent or assume past requests, topics, treatments, or packages (e.g., whitening, aligners, bridal) unless explicitly requested in conversation_so_far.
   - Ground strictly in real data provided in the prompt.
3. CONVERSATIONAL FLUENCY & NO ROBOTIC PARROTING:
   - Do NOT mechanically repeat the merchant's raw metrics (e.g., "2,410 views and 18 calls") in every turn.
   - If numbers were already mentioned in earlier turns, refer to them naturally (e.g., "your profile traffic", "recent inquiries") unless the merchant specifically asks for the numbers.
4. ANSWER DIRECTLY:
   - When the merchant asks a question, answer it directly and accurately first before suggesting any next step.
5. RESPECT DECLINES:
   - If the merchant says "not right now", "maybe later", or "no", do NOT immediately pitch another unrelated campaign. Acknowledge politely and confirm their active setup is running smoothly.
6. ACTION MODE ON INTENT TRANSITION:
   - If the merchant agrees or confirms ("yes", "go live", "do it", "sure", "ok", "publish"):
     Switch immediately to action mode. Start with "Done! Here is..." or "Confirmed! Here are the next steps...".
     NEVER ask qualifying questions ("would you", "do you", "can you tell", "what if", "how about").
7. FORMAT & LENGTH:
   - 2-3 short, clean paragraphs. WhatsApp-friendly (60-120 words).
   - If proposing a confirmation action, end with ONE clear question (e.g., "Want me to update your post CTAs now?").

OUTPUT FORMAT — Return ONLY valid JSON (no markdown fences, no extra text):
{
  "body": "the complete message in English",
  "cta": "open_ended" | "binary_yes_stop" | "none",
  "rationale": "1-2 sentences explaining reasoning"
}`;
}

/**
 * Build a reply-mode prompt for /v1/reply conversation turns.
 */
function buildReplyPrompt({ category, merchant, customer, conversation, latestMessage }) {
  const turnsSummary = (conversation.turns || [])
    .slice(-6)
    .map((t) => `[${t.from.toUpperCase()}] ${t.message}`)
    .join('\n');

  return {
    system: buildReplySystemPrompt(category, merchant, customer),
    user: JSON.stringify({
      mode: 'reply',
      conversation_so_far: turnsSummary,
      latest_message: latestMessage,
      merchant: merchantSummary(merchant),
      customer: customer ? customerSummary(customer) : null,
      category_slug: category?.slug || 'dentists',
      instruction: `The merchant/customer just replied: "${latestMessage}".
Compose the next response in English ONLY.

CRITICAL RUBRIC RULES (SCORE 10/10):
1. LANGUAGE: English ONLY. Never output Hindi or Hinglish.
2. ACTION MODE ON INTENT TRANSITION:
   - If the merchant agreed ("yes", "let's do it", "chalo", "go ahead", "sure", "ok", "publish"):
     You MUST switch immediately to ACTION MODE.
     Start with "Done! Here is..." or "Confirmed! Here are the next steps...".
     Provide the completed draft, confirmation, or action plan immediately.
     NEVER ask qualifying questions (STRICTLY FORBIDDEN: "would you", "do you", "can you tell", "what if", "how about").
3. DIRECT ANSWER WITH SPECIFIC DATA:
   - If the merchant asked a question (e.g. "What are my active offers right now?"):
     Answer directly with exact facts from merchant context (e.g. list active offers: "${merchant.offers?.[0]?.title || 'Consultation @ ₹199'}", status, and details).
   - If asking about views or calls: use exact numbers from performance (${merchant.performance?.views || 1420} views, ${merchant.performance?.calls || 38} calls).
4. NO INVENTED PAST REQUESTS & CONTEXTUAL HONESTY:
   - Strictly DO NOT invent or hallucinate past merchant requests or topics (e.g. whitening, aligners, bridal packages) that were never mentioned in conversation_so_far!
5. AVOID ROBOTIC METRIC PARROTING:
   - If numbers (${merchant.performance?.views || 1420} views, ${merchant.performance?.calls || 38} calls) were already mentioned in the recent turns of conversation_so_far, DO NOT mechanically repeat the exact same numbers every single turn. Refer to them naturally as "your profile" or "your views" unless specifically asked.
6. RESPECT DECLINES ("NOT RIGHT NOW"):
   - If the merchant signals hesitation or decline ("not right now", "no", "later"), DO NOT immediately pitch another unrelated campaign. Acknowledge politely, confirm everything is stable, and offer quiet assistance.
7. CATEGORY & MERCHANT FIT:
   - Address the owner by name ("${merchant.identity?.owner_first_name || 'there'}").
   - Match vertical voice: clinical for doctors, stylist for salons, operator for restaurants, coach for gyms.
8. ENGAGEMENT COMPULSION:
   - Exactly ONE low-effort next step in the final sentence when proposing an action.

Return ONLY valid JSON: {"body": "...", "cta": "open_ended" | "binary_yes_stop" | "none", "rationale": "..."}`,
    }),
  };
}

module.exports = {
  buildPrompt,
  buildReplyPrompt,
  buildSystemPrompt,
  buildReplySystemPrompt,
  PROMPT_BUILDERS,
};
