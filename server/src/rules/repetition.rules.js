/**
 * Anti-repetition rules — prevents verbatim message repeats.
 * Testing brief §10: verbatim repeats = -2 penalty each.
 */

const store = require('../services/context.service');

/**
 * Check if this exact body was already sent in this conversation.
 */
function isDuplicateBody(conversationId, body) {
  if (!conversationId || !body) return false;
  return store.wasSentBefore(conversationId, body.trim());
}

/**
 * Record a sent body for future duplicate detection.
 */
function recordSent(conversationId, body) {
  if (!conversationId || !body) return;
  store.recordSentBody(conversationId, body.trim());
}

module.exports = { isDuplicateBody, recordSent };
