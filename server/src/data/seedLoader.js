/**
 * Fallback seed data loader.
 * Ensures the bot always has rich merchant and category context even when
 * the in-memory store hasn't been pre-populated by an automated test harness.
 */
let seedBundle = null;

try {
  seedBundle = require('./seedData.json');
} catch (_e) {
  seedBundle = { categories: {}, merchants: {}, customers: {}, triggers: {} };
}

/**
 * Retrieve fallback context for a given scope and id.
 * @param {'category'|'merchant'|'customer'|'trigger'} scope
 * @param {string} id
 * @returns {object|null}
 */
function getFallbackContext(scope, id) {
  if (!seedBundle || !id) return null;
  switch (scope) {
    case 'category':
      return seedBundle.categories[id] || null;
    case 'merchant':
      return seedBundle.merchants[id] || null;
    case 'customer':
      return seedBundle.customers[id] || null;
    case 'trigger':
      return seedBundle.triggers[id] || null;
    default:
      return null;
  }
}

/**
 * Get all seed items for a given scope.
 * @param {'category'|'merchant'|'customer'|'trigger'} scope
 * @returns {Array<{id: string, payload: object}>}
 */
function getAllFallbackContexts(scope) {
  if (!seedBundle) return [];
  const map = {
    category: seedBundle.categories,
    merchant: seedBundle.merchants,
    customer: seedBundle.customers,
    trigger: seedBundle.triggers,
  }[scope];

  if (!map) return [];
  return Object.entries(map).map(([id, payload]) => ({ id, payload }));
}

module.exports = {
  getFallbackContext,
  getAllFallbackContexts,
};
