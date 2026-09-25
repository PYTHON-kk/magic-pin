/**
 * Vera Bot — Express server entry point.
 *
 * Exposes the 5 challenge-facing endpoints under /v1/*.
 * No external dependencies beyond the LLM provider.
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config/env');
const logger = require('./utils/logger');
const challengeRoutes = require('./routes/challenge.routes');

const app = express();

/* ─── Middleware ─── */
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '600kb' })); // Context payload cap is 500KB, give headroom

// Request logging (lightweight)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    // Only log non-healthz requests to keep logs clean
    if (req.path !== '/v1/healthz') {
      logger.info('request', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ms,
      });
    }
  });
  next();
});

/* ─── Routes ─── */
app.get('/', (req, res) => {
  res.json({
    bot: 'Vera AI — magicpin Assistant',
    status: 'online',
    endpoints: [
      'GET  /v1/healthz',
      'GET  /v1/metadata',
      'POST /v1/context',
      'POST /v1/tick',
      'POST /v1/reply',
    ],
  });
});

app.use(challengeRoutes);

/* ─── Global error handler ─── */
// Never expose stack traces to the judge (constraint #25)
app.use((err, req, res, _next) => {
  logger.error('unhandled_error', { error: err.message, path: req.path });
  res.status(500).json({
    error: 'internal_error',
    message: 'Unable to process request',
  });
});

/* ─── 404 handler ─── */
app.use((req, res) => {
  res.status(404).json({ error: 'not_found', path: req.path });
});

/* ─── Start ─── */
const PORT = config.PORT;
app.listen(PORT, () => {
  logger.info('server_started', {
    port: PORT,
    env: config.NODE_ENV,
    provider: config.LLM_PROVIDER,
    model: config.LLM_MODEL || 'default',
  });
  console.log(`\n🤖 Vera Bot running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/v1/healthz`);
  console.log(`   LLM:    ${config.LLM_PROVIDER} (${config.LLM_MODEL || 'default model'})\n`);
});

module.exports = app;
