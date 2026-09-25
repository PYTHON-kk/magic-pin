/**
 * LLM client — wraps all providers behind a single callLLM(messages, options) interface.
 *
 * Token budget controls (all set in .env, never hardcoded):
 *   LLM_MAX_TOKENS          — max response tokens per call (default 600)
 *   LLM_MAX_TOKENS_REPLY    — max response tokens for reply calls (default 400)
 *   LLM_CALLS_PER_MINUTE    — hard cap on calls/min across the bot (default 30)
 *   LLM_TIMEOUT_MS          — abort timeout per call (default 20000ms)
 *
 * Double-timeout safety: AbortController (cuts the fetch) + Promise.race (guard in callLLMSafe).
 */
const config = require('../config/env');
const { getProviderConfig } = require('./model.config');
const logger = require('../utils/logger');

/* ─── Per-minute rate limiter ─── */

const _callTimestamps = [];          // rolling window of call timestamps

function _checkRateLimit() {
  const now = Date.now();
  const windowMs = 60_000;           // 1 minute window
  // Remove timestamps older than 1 minute
  while (_callTimestamps.length && now - _callTimestamps[0] > windowMs) {
    _callTimestamps.shift();
  }
  if (_callTimestamps.length >= config.LLM_CALLS_PER_MINUTE) {
    const oldestMs = _callTimestamps[0];
    const waitMs = windowMs - (now - oldestMs) + 100;
    throw Object.assign(
      new Error(`LLM rate limit: ${config.LLM_CALLS_PER_MINUTE} calls/min exceeded. Retry in ${Math.ceil(waitMs / 1000)}s.`),
      { code: 'RATE_LIMIT', retryAfterMs: waitMs }
    );
  }
  _callTimestamps.push(now);
}

/* ─── Core caller ─── */

/**
 * Call the configured LLM provider.
 * @param {Array<{role: string, content: string}>} messages
 * @param {object} [options] - {temperature, maxTokens, timeoutMs, isReply}
 * @returns {Promise<string>} Raw LLM text output
 */
async function callLLM(messages, options = {}) {
  // 1. Rate limit check (before spending any network time)
  _checkRateLimit();

  const prov = getProviderConfig();
  const timeoutMs = options.timeoutMs || config.LLM_TIMEOUT_MS;

  // Respect token budget from config; caller can lower but not raise above config cap
  const maxTokensCap = options.isReply ? config.LLM_MAX_TOKENS_REPLY : config.LLM_MAX_TOKENS;
  const maxTokens = Math.min(options.maxTokens ?? maxTokensCap, maxTokensCap);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let url, headers, body;

    if (prov.provider === 'gemini') {
      url = `${prov.baseUrl}/models/${prov.model}:generateContent?key=${prov.apiKey}`;
      headers = { 'Content-Type': 'application/json' };
      body = prov.buildBody(prov.model, messages, { ...options, maxTokens });
    } else {
      url = `${prov.baseUrl}${prov.chatPath}`;
      headers = {
        'Content-Type': 'application/json',
        ...prov.authHeader(prov.apiKey),
      };
      body = prov.buildBody(prov.model, messages, { ...options, maxTokens });
    }

    logger.debug('llm_request', {
      provider: prov.provider,
      model: prov.model,
      maxTokens,
      callsThisMinute: _callTimestamps.length,
    });

    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '');
      // 429 = provider rate limit (different from our own rate limit)
      if (resp.status === 429) {
        logger.warn('llm_provider_rate_limit', { provider: prov.provider, status: resp.status });
        throw Object.assign(new Error(`Provider rate limited (429)`), { code: 'PROVIDER_RATE_LIMIT' });
      }
      throw new Error(`LLM API ${resp.status}: ${errBody.substring(0, 300)}`);
    }

    const data = await resp.json();
    const content = prov.extractContent(data);

    if (!content) {
      throw new Error('LLM returned empty content');
    }

    logger.debug('llm_response', {
      provider: prov.provider,
      chars: content.length,
      callsThisMinute: _callTimestamps.length,
    });
    return content;

  } catch (err) {
    if (err.name === 'AbortError') {
      logger.error('llm_timeout', { timeoutMs, provider: prov.provider });
      throw new Error(`LLM timed out after ${timeoutMs}ms`);
    }
    logger.error('llm_error', { error: err.message, provider: prov.provider, code: err.code });
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Safe wrapper — adds a hard outer timeout beyond AbortController, and converts
 * rate limit / timeout errors into graceful nulls so callers can fall back cleanly.
 * Use this from composition code instead of callLLM directly.
 *
 * @returns {Promise<string|null>} Content string, or null on any failure.
 */
async function callLLMSafe(messages, options = {}) {
  const timeoutMs = options.timeoutMs || config.LLM_TIMEOUT_MS;

  try {
    return await Promise.race([
      callLLM(messages, options),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`LLM hard timeout at ${timeoutMs + 2000}ms`)),
          timeoutMs + 2000
        )
      ),
    ]);
  } catch (err) {
    const isRateLimit = err.code === 'RATE_LIMIT' || err.code === 'PROVIDER_RATE_LIMIT';
    logger.warn('llm_safe_fallback', { error: err.message, isRateLimit });
    return null;       // caller handles null → skip send / return wait
  }
}

/**
 * Returns current rate-limit status — useful for healthz or debugging.
 */
function getRateLimitStatus() {
  const now = Date.now();
  while (_callTimestamps.length && now - _callTimestamps[0] > 60_000) {
    _callTimestamps.shift();
  }
  return {
    callsThisMinute: _callTimestamps.length,
    limitPerMinute: config.LLM_CALLS_PER_MINUTE,
    headroom: config.LLM_CALLS_PER_MINUTE - _callTimestamps.length,
  };
}

module.exports = { callLLM, callLLMSafe, getRateLimitStatus };
