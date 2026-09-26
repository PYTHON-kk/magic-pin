/**
 * Decision service — the "/v1/tick" brain.
 *
 * Pipeline per the project constraint:
 *   Trigger → Eligibility → Suppression → Relevance → Priority → Action → Composition
 *
 * Rules decide WHAT to do. AI decides HOW to say it.
 */

const store = require('./context.service');
const { composeMessage } = require('./composition.service');
const { isSuppressed, markSuppressed } = require('../rules/suppression.rules');
const logger = require('../utils/logger');

const MAX_ACTIONS_PER_TICK = 20;

/**
 * Process a tick: evaluate available triggers, compose messages for eligible ones.
 * @param {string[]} availableTriggerIds
 * @param {string} now - ISO timestamp of simulated time
 * @returns {Promise<Array>} Array of action objects
 */
async function processTickActions(availableTriggerIds, now) {
  const actions = [];
  const nowDate = now ? new Date(now) : new Date();

  // 1. Gather all triggers in memory
  const triggersWithData = [];
  for (const trgId of availableTriggerIds) {
    const trigger = store.getContext('trigger', trgId);
    if (!trigger) {
      logger.debug('tick_trigger_not_found', { triggerId: trgId });
      continue;
    }
    triggersWithData.push({ id: trgId, trigger });
  }

  // 2. Sort by urgency descending
  triggersWithData.sort((a, b) => (b.trigger.urgency || 0) - (a.trigger.urgency || 0));

  // 3. Pre-filter eligible triggers synchronously (0ms)
  const eligible = [];
  for (const { id: trgId, trigger } of triggersWithData) {
    const merchantId = trigger.merchant_id;
    if (!merchantId) continue;

    const merchant = store.getContext('merchant', merchantId);
    if (!merchant) continue;

    const categorySlug = merchant.category_slug;
    const category = categorySlug ? store.getContext('category', categorySlug) : null;
    if (!category) continue;

    if (isSuppressed(trigger.suppression_key)) continue;

    if (trigger.expires_at && nowDate > new Date(trigger.expires_at)) continue;

    const customerId = trigger.customer_id || null;
    const customer = customerId ? store.getContext('customer', customerId) : null;
    if (customer && trigger.scope === 'customer' && customer.preferences?.reminder_opt_in === false) continue;

    eligible.push({ trgId, trigger, merchant, category, customer });
  }

  // 4. Process up to 6 highest-urgency triggers in parallel to avoid Render gateway timeout
  const batch = eligible.slice(0, 6);
  const results = await Promise.allSettled(
    batch.map(({ trgId, trigger, merchant, category, customer }) =>
      composeActionForTrigger({ trgId, trigger, merchant, category, customer, nowDate })
    )
  );

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) {
      actions.push(r.value);
    }
  }

  return actions;
}

/**
 * Compose message and build action object for an eligible trigger.
 */
async function composeActionForTrigger({ trgId, trigger, merchant, category, customer, nowDate }) {
  const merchantId = trigger.merchant_id;
  const customerId = trigger.customer_id || null;
  const conversationId = `conv_${merchantId}_${trgId}`;

  const draft = await composeMessage({
    category,
    merchant,
    trigger,
    customer,
    conversationId,
  });

  if (!draft) {
    logger.debug('composition_returned_null', { triggerId: trgId });
    return null;
  }

  // Mark suppression
  markSuppressed(trigger.suppression_key);

  const isCustomerFacing = !!customer && trigger.scope === 'customer';

  // Create or update conversation
  store.createConversation(conversationId, {
    merchantId,
    customerId,
    triggerId: trgId,
  });

  const conv = store.getConversation(conversationId);
  if (conv) {
    conv.turns.push({ from: 'vera', message: draft.body, turn: 1 });
    store.upsertConversation(conversationId, conv);
  }

  return {
    conversation_id: conversationId,
    merchant_id: merchantId,
    customer_id: customerId,
    send_as: isCustomerFacing ? 'merchant_on_behalf' : 'vera',
    trigger_id: trgId,
    template_name: templateNameFor(trigger.kind),
    template_params: draft.templateParams || [],
    body: draft.body,
    cta: draft.cta,
    suppression_key: trigger.suppression_key || '',
    rationale: draft.rationale || '',
  };
}

/**
 * Map trigger kind to a WhatsApp template name.
 */
function templateNameFor(kind) {
  const templates = {
    research_digest: 'vera_research_digest_v1',
    regulation_change: 'vera_compliance_alert_v1',
    perf_spike: 'vera_perf_update_v1',
    perf_dip: 'vera_perf_update_v1',
    seasonal_perf_dip: 'vera_perf_update_v1',
    milestone_reached: 'vera_milestone_v1',
    recall_due: 'merchant_recall_reminder_v1',
    chronic_refill_due: 'merchant_refill_reminder_v1',
    customer_lapsed_hard: 'merchant_winback_v1',
    trial_followup: 'merchant_trial_followup_v1',
    wedding_package_followup: 'merchant_bridal_followup_v1',
    festival_upcoming: 'vera_festival_v1',
    ipl_match_today: 'vera_event_v1',
    competitor_opened: 'vera_competitor_alert_v1',
    category_seasonal: 'vera_seasonal_v1',
    dormant_with_vera: 'vera_reengagement_v1',
    curious_ask_due: 'vera_curious_ask_v1',
    active_planning_intent: 'vera_planning_v1',
    renewal_due: 'vera_renewal_v1',
    winback_eligible: 'vera_winback_v1',
    gbp_unverified: 'vera_gbp_setup_v1',
    review_theme_emerged: 'vera_review_insight_v1',
    supply_alert: 'vera_supply_alert_v1',
    cde_opportunity: 'vera_cde_v1',
  };
  return templates[kind] || 'vera_generic_v1';
}

module.exports = { processTickActions };
