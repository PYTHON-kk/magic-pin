const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

module.exports = {
  PORT: parseInt(process.env.PORT || '8080', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',

  // LLM
  LLM_PROVIDER: (process.env.LLM_PROVIDER || 'openai').trim().replace(/^['"]|['"]$/g, '').toLowerCase(),
  LLM_API_KEY: (process.env.LLM_API_KEY || '').trim().replace(/^['"]|['"]$/g, ''),
  LLM_MODEL: (process.env.LLM_MODEL || '').trim().replace(/^['"]|['"]$/g, ''),
  LLM_TIMEOUT_MS: parseInt(process.env.LLM_TIMEOUT_MS || '20000', 10),

  // Token budget — prevents API exhaustion during the 60-min test window
  // Max tokens per single LLM response (lower = cheaper, faster)
  LLM_MAX_TOKENS: parseInt(process.env.LLM_MAX_TOKENS || '600', 10),
  // Max LLM calls per minute across the whole bot (hard cap)
  LLM_CALLS_PER_MINUTE: parseInt(process.env.LLM_CALLS_PER_MINUTE || '30', 10),
  // Max tokens per reply composition (shorter than tick compositions)
  LLM_MAX_TOKENS_REPLY: parseInt(process.env.LLM_MAX_TOKENS_REPLY || '400', 10),

  // Team
  TEAM_NAME: process.env.TEAM_NAME || 'Team Vera',
  TEAM_MEMBERS: (process.env.TEAM_MEMBERS || 'Kartik').split(',').map(s => s.trim()),
  CONTACT_EMAIL: process.env.CONTACT_EMAIL || 'kartik@example.com',

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
};
