/**
 * Parses the raw LLM output into a structured ComposedMessage.
 * The LLM is instructed to return JSON; this module handles edge cases
 * (markdown fences, partial JSON, missing fields).
 */

const logger = require('../utils/logger');

/**
 * @param {string} raw - Raw LLM output string
 * @returns {object|null} Parsed message object or null
 */
function parseComposedMessage(raw) {
  if (!raw || typeof raw !== 'string') return null;

  try {
    // Strip markdown code fences if present
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    }

    const parsed = JSON.parse(cleaned);

    // Normalize fields
    return {
      body: (parsed.body || '').trim(),
      cta: normalizeCta(parsed.cta),
      rationale: (parsed.rationale || '').trim(),
      templateParams: Array.isArray(parsed.templateParams) ? parsed.templateParams : [],
    };
  } catch (err) {
    logger.warn('parse_failed', { error: err.message, raw: raw.substring(0, 200) });

    // Last-resort: try to extract body from the raw text
    const bodyMatch = raw.match(/"body"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (bodyMatch) {
      return {
        body: bodyMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').trim(),
        cta: 'open_ended',
        rationale: 'Extracted from partial JSON',
        templateParams: [],
      };
    }

    return null;
  }
}

function normalizeCta(cta) {
  if (!cta) return 'open_ended';
  const lower = String(cta).toLowerCase().replace(/[^a-z_]/g, '');
  if (['binary_yes_stop', 'binary', 'yes_stop'].includes(lower)) return 'binary_yes_stop';
  if (['none', 'no_cta'].includes(lower)) return 'none';
  return 'open_ended';
}

/**
 * Parse a reply-mode LLM output (for /v1/reply conversation turns).
 */
function parseReplyMessage(raw) {
  if (!raw || typeof raw !== 'string') return null;

  try {
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    }

    const parsed = JSON.parse(cleaned);
    return {
      body: (parsed.body || '').trim(),
      cta: normalizeCta(parsed.cta),
      rationale: (parsed.rationale || '').trim(),
    };
  } catch {
    // If JSON parse fails, use raw text as body
    const text = raw.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
    if (text.length > 0 && text.length < 2000) {
      return { body: text, cta: 'open_ended', rationale: 'Raw text fallback' };
    }
    return null;
  }
}

module.exports = { parseComposedMessage, parseReplyMessage, normalizeCta };
