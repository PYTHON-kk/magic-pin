/**
 * Suppression rules — prevents re-sending the same trigger/topic.
 * Uses suppression keys with TTL expiry.
 */

const logger = require('../utils/logger');

// suppression_key → expiry timestamp (ms)
const suppressedUntil = new Map();

const DEFAULT_TTL_MS = 7 * 24 * 3600 * 1000; // 7 days

/**
 * Check if a suppression key is currently active.
 */
function isSuppressed(key) {
  if (!key) return false;
  const exp = suppressedUntil.get(key);
  if (!exp) return false;
  if (exp > Date.now()) return true;
  // Expired — clean up
  suppressedUntil.delete(key);
  return false;
}

/**
 * Mark a suppression key as sent.
 */
function markSuppressed(key, ttlMs = DEFAULT_TTL_MS) {
  if (!key) return;
  suppressedUntil.set(key, Date.now() + ttlMs);
  logger.debug('suppression_set', { key, ttlMs });
}

/**
 * Clear all suppression state.
 */
function clearSuppression() {
  suppressedUntil.clear();
}

module.exports = { isSuppressed, markSuppressed, clearSuppression };
