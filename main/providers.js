const { PROVIDERS } = require('./config');

/**
 * Returns the full provider config for a given id.
 * @param {string} id  'anthropic' | 'openai'
 * @returns {object|null}
 */
function getProvider(id) {
    return PROVIDERS[id] ?? null;
}

/**
 * Advisory-only key detection — determines likely provider from key prefix.
 * NEVER used to route API calls. Only for UI badge display.
 * @param {string} key
 * @returns {'anthropic' | 'openai' | 'unknown'}
 */
function detectProvider(key) {
    if (!key || typeof key !== 'string') return 'unknown';
    if (key.startsWith('sk-ant-')) return 'anthropic';
    if (key.startsWith('sk-')) return 'openai';
    return 'unknown';
}

module.exports = { getProvider, detectProvider, PROVIDERS };
