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

  // Sort triggers by urgency (higher first) for prioritization
  const triggersWithData = [];
  for (const trgId of availableTriggerIds) {
    const trigger = store.getContext('trigger', trgId);
    if (!trigger) {
      logger.debug('tick_trigger_not_found', { triggerId: trgId });
      continue;
    }
    triggersWithData.push({ id: trgId, trigger });
  }

  // Sort by urgency descending
  triggersWithData.sort((a, b) => (b.trigger.urgency || 0) - (a.trigger.urgency || 0));

  // Process up to MAX_ACTIONS_PER_TICK
  for (const { id: trgId, trigger } of triggersWithData.slice(0, MAX_ACTIONS_PER_TICK)) {
    try {
      const action = await evaluateAndCompose(trigger, trgId, nowDate);
      if (action) {
        actions.push(action);
      }
    } catch (err) {
      logger.error('tick_trigger_error', { triggerId: trgId, error: err.message });
    }
  }

  return actions;
}

/**
 * Evaluate a single trigger through the decision pipeline.
 */
async function evaluateAndCompose(trigger, triggerId, nowDate) {
  // ── Step 1: Eligibility ──
  // Check trigger has required merchant reference
  const merchantId = trigger.merchant_id;
  if (!merchantId) {
    logger.debug('trigger_no_merchant', { triggerId });
    return null;
  }

  // ── Step 2: Get associated contexts ──
  const merchant = store.getContext('merchant', merchantId);
  if (!merchant) {
    logger.debug('merchant_not_found', { triggerId, merchantId });
    return null;
  }

  const categorySlug = merchant.category_slug;
  const category = categorySlug ? store.getContext('category', categorySlug) : null;
  if (!category) {
    logger.debug('category_not_found', { triggerId, categorySlug });
    return null;
  }

  const customerId = trigger.customer_id || null;
  const customer = customerId ? store.getContext('customer', customerId) : null;

  // ── Step 3: Suppression check ──
  if (isSuppressed(trigger.suppression_key)) {
    logger.debug('trigger_suppressed', { triggerId, key: trigger.suppression_key });
    return null;
  }

  // ── Step 4: Expiration check ──
  if (trigger.expires_at) {
    const expiresAt = new Date(trigger.expires_at);
    if (nowDate > expiresAt) {
      logger.debug('trigger_expired', { triggerId, expiresAt: trigger.expires_at });
      return null;
    }
  }

  // ── Step 5: Consent check (customer-facing) ──
  if (customer && trigger.scope === 'customer') {
    if (customer.preferences?.reminder_opt_in === false) {
      logger.debug('customer_opted_out', { triggerId, customerId });
      return null;
    }
  }

  // ── Step 6: Compose message ──
  const conversationId = `conv_${merchantId}_${triggerId}`;

  const draft = await composeMessage({
    category,
    merchant,
    trigger,
    customer,
    conversationId,
  });

  if (!draft) {
    logger.debug('composition_returned_null', { triggerId });
    return null;
  }

  // ── Step 7: Mark suppression ──
  markSuppressed(trigger.suppression_key);

  // ── Step 8: Build action ──
  const isCustomerFacing = !!customer && trigger.scope === 'customer';

  // Create the conversation in store for future /v1/reply handling
  store.createConversation(conversationId, {
    merchantId,
    customerId,
    triggerId,
  });

  // Record bot's opening message as first turn
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
    trigger_id: triggerId,
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
