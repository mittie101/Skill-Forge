'use strict';
// Guard test: verifies the fast models we will hardcode are present in VALID_MODELS.
// This catches typos in model names before they reach the API.
const { VALID_MODELS } = require('../../main/config');

const FAST_MODELS = {
    anthropic: 'claude-haiku-4-5-20251001',
    openai:    'gpt-4o-mini',
};

describe('suggestion fast models are valid', () => {
    it('haiku model name is in VALID_MODELS.anthropic', () => {
        expect(VALID_MODELS.anthropic).toContain(FAST_MODELS.anthropic);
    });

    it('gpt-4o-mini model name is in VALID_MODELS.openai', () => {
        expect(VALID_MODELS.openai).toContain(FAST_MODELS.openai);
    });
});
