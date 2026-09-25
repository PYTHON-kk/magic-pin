/**
 * Post-LLM message validator — the safety net before any send.
 * Validates against rubric anti-patterns and hard constraints.
 * Fail closed: invalid → retry once → skip.
 */

const logger = require('../utils/logger');

/**
 * @param {object} draft - {body, cta, rationale, templateParams}
 * @param {object} ctx   - {category, merchant, trigger, customer}
 * @returns {{ok: boolean, reason?: string}}
 */
function validateMessage(draft, ctx) {
  const { category, merchant, trigger, customer } = ctx;

  // 1. Non-empty body
  if (!draft || !draft.body || draft.body.trim().length === 0) {
    return fail('empty_body');
  }

  // 2. Body too short to be meaningful
  if (draft.body.trim().length < 15) {
    return fail('body_too_short');
  }

  // 3. Valid CTA value
  const validCtas = ['open_ended', 'binary_yes_stop', 'none'];
  if (!validCtas.includes(draft.cta)) {
    return fail(`invalid_cta: ${draft.cta}`);
  }

  // 4. Multiple CTAs in body (anti-pattern)
  const ctaPatterns = (draft.body.match(/reply\s+(yes|stop|go|no|\d)/gi) || []).length;
  if (ctaPatterns > 2) {
    return fail('multiple_ctas_in_body');
  }

  // 5. Category voice taboos
  const taboos = category.voice?.vocab_taboo || category.voice?.taboos || [];
  for (const taboo of taboos) {
    // Skip taboos with parenthetical notes like "FDA-approved (use only when...)"
    const cleanTaboo = taboo.split('(')[0].trim();
    if (cleanTaboo.length < 3) continue;
    if (new RegExp(`\\b${escapeRegex(cleanTaboo)}\\b`, 'i').test(draft.body)) {
      return fail(`taboo_word: "${cleanTaboo}"`);
    }
  }

  // 6. Promotional tone in clinical categories
  if (['dentists', 'pharmacies'].includes(category.slug)) {
    const promoPatterns = /\b(AMAZING|INCREDIBLE|BEST DEAL|HURRY|LIMITED TIME|ACT NOW|DON'?T MISS)\b/i;
    if (promoPatterns.test(draft.body)) {
      return fail('promotional_tone_in_clinical_category');
    }
  }

  // 7. Customer-facing scope check
  if (customer && trigger.scope === 'customer') {
    const merchantName = merchant.identity?.name || '';
    // Customer-facing messages should reference the merchant, not Vera
    if (/\bVera\b/i.test(draft.body) && !/\bvia Vera\b/i.test(draft.body)) {
      // Mild warning, don't fail — some contexts are OK
      logger.warn('vera_mention_in_customer_msg', { body: draft.body.substring(0, 100) });
    }
  }

  // 8. Long preamble detection
  const preambles = /^(I hope you'?re doing well|I'?m reaching out|Greetings|Dear Sir)/i;
  if (preambles.test(draft.body.trim())) {
    return fail('long_preamble');
  }

  return { ok: true };
}

function fail(reason) {
  logger.debug('validation_failed', { reason });
  return { ok: false, reason };
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { validateMessage };
