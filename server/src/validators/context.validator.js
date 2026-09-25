/**
 * Validates incoming context payloads before storage.
 */

const VALID_SCOPES = ['category', 'merchant', 'customer', 'trigger'];

function validateContextPush(body) {
  const errors = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body must be a JSON object'] };
  }

  const { scope, context_id, version, payload } = body;

  if (!scope || !VALID_SCOPES.includes(scope)) {
    errors.push(`Invalid scope: "${scope}". Must be one of: ${VALID_SCOPES.join(', ')}`);
  }

  if (!context_id || typeof context_id !== 'string') {
    errors.push('context_id is required and must be a string');
  }

  if (version === undefined || version === null || typeof version !== 'number' || !Number.isInteger(version)) {
    errors.push('version is required and must be an integer');
  }

  if (!payload || typeof payload !== 'object') {
    errors.push('payload is required and must be an object');
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validateContextPush, VALID_SCOPES };
