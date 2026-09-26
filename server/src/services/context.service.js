/**
 * In-memory context store — the single source of truth for all pushed contexts.
 *
 * Per testing brief: "Storing in memory is fine; just don't restart between calls."
 * No database required — a 60-min test with no expected restarts means Maps suffice.
 */
const logger = require('../utils/logger');
const seedLoader = require('../data/seedLoader');

// Key: `${scope}:${context_id}` → {version, payload}
const contexts = new Map();

// Key: conversation_id → {merchantId, customerId, triggerId, turns:[], state, autoReplyStreak, ...}
const conversations = new Map();

// Key: conversation_id → Set<bodyString> (for anti-repetition)
const sentBodies = new Map();

/* ─── Context CRUD ─── */

function upsertContext(scope, contextId, version, payload) {
  const key = `${scope}:${contextId}`;
  const cur = contexts.get(key);

  if (cur) {
    if (cur.version > version) {
      return { accepted: false, reason: 'stale_version', current_version: cur.version };
    }
    // Same version = idempotent no-op (per spec: "re-posting same version is a no-op")
    if (cur.version === version) {
      return { accepted: true, idempotent: true };
    }
  }

  contexts.set(key, { version, payload });
  logger.debug('context_stored', { scope, contextId, version });
  return { accepted: true };
}

function getContext(scope, contextId) {
  const cur = contexts.get(`${scope}:${contextId}`);
  if (cur && cur.payload) {
    return cur.payload;
  }
  return seedLoader.getFallbackContext(scope, contextId);
}

function getContextVersion(scope, contextId) {
  return contexts.get(`${scope}:${contextId}`)?.version ?? null;
}

function getContextCounts() {
  const counts = { category: 0, merchant: 0, customer: 0, trigger: 0 };
  for (const key of contexts.keys()) {
    const scope = key.split(':')[0];
    if (scope in counts) counts[scope]++;
  }
  return counts;
}

/**
 * Get all contexts of a given scope.
 * @returns {Array<{contextId: string, version: number, payload: object}>}
 */
function getAllContextsByScope(scope) {
  const result = [];
  for (const [key, val] of contexts.entries()) {
    if (key.startsWith(`${scope}:`)) {
      const contextId = key.substring(scope.length + 1);
      result.push({ contextId, version: val.version, payload: val.payload });
    }
  }
  return result;
}

/* ─── Conversation CRUD ─── */

function getConversation(conversationId) {
  return conversations.get(conversationId) || null;
}

function upsertConversation(conversationId, data) {
  conversations.set(conversationId, data);
}

function createConversation(conversationId, { merchantId, customerId, triggerId }) {
  const conv = {
    conversationId,
    merchantId,
    customerId: customerId || null,
    triggerId: triggerId || null,
    turns: [],
    state: 'ACTIVE',    // ACTIVE | WAITING | COMPLETED | SUPPRESSED
    autoReplyStreak: 0,
    unansweredNudges: 0,
    createdAt: new Date().toISOString(),
  };
  conversations.set(conversationId, conv);
  return conv;
}

/* ─── Anti-Repetition ─── */

function wasSentBefore(conversationId, body) {
  const set = sentBodies.get(conversationId);
  return set ? set.has(body) : false;
}

function recordSentBody(conversationId, body) {
  if (!sentBodies.has(conversationId)) {
    sentBodies.set(conversationId, new Set());
  }
  sentBodies.get(conversationId).add(body);
}

/* ─── Teardown ─── */

function clearAll() {
  contexts.clear();
  conversations.clear();
  sentBodies.clear();
  logger.info('store_cleared');
}

module.exports = {
  // Context
  upsertContext,
  getContext,
  getContextVersion,
  getContextCounts,
  getAllContextsByScope,

  // Conversation
  getConversation,
  upsertConversation,
  createConversation,

  // Anti-repetition
  wasSentBefore,
  recordSentBody,

  // Teardown
  clearAll,
};
