/**
 * Composition service — orchestrates the prompt → LLM → validate → message pipeline.
 * This is the single composition module referenced in the engagement design.
 *
 * Architecture principle: "Rules decide what Vera should do. AI decides how Vera should say it."
 */

const { callLLMSafe } = require('../ai/llm.client');
const { buildPrompt, buildReplyPrompt } = require('../ai/prompt.builder');
const { parseComposedMessage, parseReplyMessage } = require('../ai/output.parser');
const { validateMessage } = require('../validators/message.validator');
const { isDuplicateBody, recordSent } = require('../rules/repetition.rules');
const logger = require('../utils/logger');

const MAX_RETRIES = 0;

/**
 * Compose a proactive message for a trigger (used by /v1/tick).
 * @returns {object|null} {body, cta, rationale, templateParams} or null if composition fails
 */
async function composeMessage({ category, merchant, trigger, customer, conversationId }) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { system, user } = buildPrompt({ category, merchant, trigger, customer });

      const messages = [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ];

      if (attempt > 0) {
        messages.push({
          role: 'user',
          content: 'The previous message failed validation. Please try again, strictly following the HARD RULES. Return ONLY valid JSON.',
        });
      }

      const raw = await callLLMSafe(messages, { temperature: 0, isReply: false });
      if (!raw) {
        logger.warn('compose_llm_null', { attempt, triggerId: trigger.id });
        continue;
      }
      const draft = parseComposedMessage(raw);

      if (!draft) {
        logger.warn('compose_parse_failed', { attempt, triggerId: trigger.id });
        continue;
      }

      // Validate
      const validation = validateMessage(draft, { category, merchant, trigger, customer });
      if (!validation.ok) {
        logger.warn('compose_validation_failed', { attempt, reason: validation.reason, triggerId: trigger.id });
        continue;
      }

      // Anti-repetition check
      if (conversationId && isDuplicateBody(conversationId, draft.body)) {
        logger.warn('compose_duplicate_body', { conversationId });
        continue;
      }

      // Success — record and return
      if (conversationId) {
        recordSent(conversationId, draft.body);
      }

      return draft;
    } catch (err) {
      logger.error('compose_error', { attempt, error: err.message, triggerId: trigger.id });
    }
  }

  // All attempts exhausted — fail closed (no send)
  logger.warn('compose_exhausted', { triggerId: trigger.id });
  return null;
}

/**
 * Compose a reply in an ongoing conversation (used by /v1/reply).
 * @returns {object|null} {body, cta, rationale} or null
 */
async function composeReply({ category, merchant, customer, conversation, latestMessage, conversationId }) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { system, user } = buildReplyPrompt({
        category,
        merchant,
        customer,
        conversation,
        latestMessage,
      });

      const messages = [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ];

      const raw = await callLLMSafe(messages, { temperature: 0, isReply: true });
      if (!raw) {
        logger.warn('reply_llm_null', { attempt, conversationId });
        continue;
      }
      const draft = parseReplyMessage(raw);

      if (!draft || !draft.body) {
        logger.warn('reply_parse_failed', { attempt, conversationId });
        continue;
      }

      // Anti-repetition
      if (conversationId && isDuplicateBody(conversationId, draft.body)) {
        logger.warn('reply_duplicate_body', { conversationId });
        continue;
      }

      if (conversationId) {
        recordSent(conversationId, draft.body);
      }

      return draft;
    } catch (err) {
      logger.error('reply_compose_error', { attempt, error: err.message, conversationId });
    }
  }

  return null;
}

module.exports = { composeMessage, composeReply };
