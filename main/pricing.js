'use strict';

// Per-million token prices (USD). Update when provider pricing changes.
// Anthropic: https://www.anthropic.com/pricing
// OpenAI:    https://openai.com/pricing
const PRICING = {
    anthropic: {
        'claude-sonnet-4-20250514':  { input: 3.00,  output: 15.00 },
        'claude-opus-4-20250514':    { input: 15.00, output: 75.00 },
        'claude-haiku-4-5-20251001': { input: 0.80,  output: 4.00  },
    },
    openai: {
        'gpt-4o':      { input: 2.50,  output: 10.00 },
        'gpt-4o-mini': { input: 0.15,  output: 0.60  },
        'gpt-4-turbo': { input: 10.00, output: 30.00 },
    },
};

/**
 * Calculate cost in USD from exact token counts.
 * Returns 0 if the model is unknown (logs a warning).
 *
 * @param {string} provider  'anthropic' | 'openai'
 * @param {string} model
 * @param {number} inputTokens
 * @param {number} outputTokens
 * @returns {number} cost in USD
 */
function calculateCost(provider, model, inputTokens, outputTokens) {
    const rates = PRICING[provider]?.[model];
    if (!rates) {
        console.warn(`[pricing] Unknown model ${provider}/${model} — cost not tracked`);
        return 0;
    }
    return (inputTokens / 1_000_000 * rates.input) +
           (outputTokens / 1_000_000 * rates.output);
}

module.exports = { PRICING, calculateCost };
