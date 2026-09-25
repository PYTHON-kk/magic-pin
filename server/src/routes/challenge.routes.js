/**
 * Challenge routes — the 5 mandatory judge-facing endpoints + teardown.
 * These follow the exact contract from challenge-testing-brief.md §2.
 *
 * Response schemas are validated by the judge — shapes must match exactly.
 */

const express = require('express');
const router = express.Router();

const store = require('../services/context.service');
const { processTickActions } = require('../services/decision.service');
const { handleReply } = require('../services/conversation.service');
const { validateContextPush } = require('../validators/context.validator');
const config = require('../config/env');
const logger = require('../utils/logger');

const START = Date.now();

/* ─── GET /v1/healthz ─── */
// Must NOT depend on LLM provider. Must respond fast.
// 3 consecutive failures = disqualified.
router.get('/v1/healthz', (req, res) => {
  res.json({
    status: 'ok',
    uptime_seconds: Math.floor((Date.now() - START) / 1000),
    contexts_loaded: store.getContextCounts(),
  });
});

/* ─── GET /v1/metadata ─── */
router.get('/v1/metadata', (req, res) => {
  res.json({
    team_name: config.TEAM_NAME,
    team_members: config.TEAM_MEMBERS,
    model: config.LLM_MODEL || `${config.LLM_PROVIDER} default`,
    approach: 'Trigger-routed prompt templates + post-LLM validator + suppression/anti-repeat rules + conversation state machine',
    contact_email: config.CONTACT_EMAIL,
    version: '1.0.0',
    submitted_at: new Date().toISOString(),
  });
});

/* ─── POST /v1/context ─── */
// Idempotent by (scope, context_id, version).
router.post('/v1/context', (req, res) => {
  const validation = validateContextPush(req.body);
  if (!validation.valid) {
    return res.status(400).json({
      accepted: false,
      reason: 'invalid_payload',
      details: validation.errors.join('; '),
    });
  }

  const { scope, context_id, version, payload } = req.body;
  const result = store.upsertContext(scope, context_id, version, payload);

  if (!result.accepted) {
    return res.status(409).json(result);
  }

  res.json({
    accepted: true,
    ack_id: `ack_${context_id}_v${version}`,
    stored_at: new Date().toISOString(),
  });
});

/* ─── POST /v1/tick ─── */
// Hard 30s budget. Always returns 200 with valid shape.
// Empty actions is a valid (and rewarded) response.
router.post('/v1/tick', async (req, res) => {
  const { now, available_triggers = [] } = req.body;

  try {
    // Race against a 25s timeout — leave 5s headroom for HTTP overhead
    const actions = await Promise.race([
      processTickActions(available_triggers, now),
      new Promise((resolve) => setTimeout(() => {
        logger.warn('tick_timeout_fallback');
        resolve([]);
      }, 25000)),
    ]);

    res.json({ actions: actions || [] });
  } catch (err) {
    logger.error('tick_error', { error: err.message });
    // NEVER throw 5xx — empty actions is always valid and better than a timeout
    res.json({ actions: [] });
  }
});

/* ─── POST /v1/reply ─── */
// 30s budget. Always returns 200 with valid shape.
router.post('/v1/reply', async (req, res) => {
  try {
    const result = await Promise.race([
      handleReply(req.body),
      new Promise((resolve) => setTimeout(() => {
        logger.warn('reply_timeout_fallback');
        resolve({ action: 'wait', wait_seconds: 300, rationale: 'Processing timed out. Backing off.' });
      }, 25000)),
    ]);

    res.json(result);
  } catch (err) {
    logger.error('reply_error', { error: err.message });
    res.json({
      action: 'wait',
      wait_seconds: 300,
      rationale: 'Internal error. Backing off gracefully.',
    });
  }
});

/* ─── POST /v1/teardown (optional but recommended) ─── */
// Per testing brief §11: wipe state after test ends.
router.post('/v1/teardown', (req, res) => {
  store.clearAll();
  const { clearSuppression } = require('../rules/suppression.rules');
  clearSuppression();
  logger.info('teardown_complete');
  res.json({ ok: true });
});

module.exports = router;
