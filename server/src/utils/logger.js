const config = require('../config/env');

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LEVELS[config.LOG_LEVEL] ?? LEVELS.info;

/**
 * Structured JSON logger — safe for production (no PII/secrets in output).
 */
function log(level, event, data = {}) {
  if (LEVELS[level] > currentLevel) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
  };

  // Merge data, but strip sensitive fields
  for (const [k, v] of Object.entries(data)) {
    if (['api_key', 'apiKey', 'password', 'secret', 'token'].includes(k)) continue;
    entry[k] = v;
  }

  const writer = level === 'error' ? console.error : console.log;
  writer(JSON.stringify(entry));
}

module.exports = {
  error: (event, data) => log('error', event, data),
  warn: (event, data) => log('warn', event, data),
  info: (event, data) => log('info', event, data),
  debug: (event, data) => log('debug', event, data),
};
