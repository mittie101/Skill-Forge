'use strict';
const {
    INPUT_CAPS,
    HISTORY_CAP, HISTORY_WARN_AT, IMPORT_MAX_BYTES,
    DEFAULT_WINDOW,
    GENERATE_TIMEOUT_MS, SUGGEST_TIMEOUT_MS,
    DEFAULT_SECTION_COUNT, MAX_TOKENS_DEFAULT,
    VALID_PROVIDERS, VALID_MODELS, PROVIDERS,
    WINDOWS_RESERVED,
} = require('../../main/config');

describe('config constants', () => {

    describe('INPUT_CAPS', () => {
        it('defines all required keys', () => {
            const keys = [
                'SKILL_NAME', 'WHEN_TO_USE', 'EXAMPLE_REQUEST', 'EXAMPLE_MAX',
                'EXPECTED_INPUTS', 'EXPECTED_OUTPUTS', 'CONSTRAINTS',
                'KEYWORD', 'DESCRIPTION', 'SECTION_NAME',
            ];
            for (const k of keys) expect(INPUT_CAPS).toHaveProperty(k);
        });

        it('SKILL_NAME cap is 80', () => expect(INPUT_CAPS.SKILL_NAME).toBe(80));
        it('KEYWORD cap is 500',    () => expect(INPUT_CAPS.KEYWORD).toBe(500));
        it('DESCRIPTION cap is 2000', () => expect(INPUT_CAPS.DESCRIPTION).toBe(2000));
        it('SECTION_NAME cap is 100', () => expect(INPUT_CAPS.SECTION_NAME).toBe(100));
    });

    describe('numeric limits', () => {
        it('HISTORY_CAP is 100',       () => expect(HISTORY_CAP).toBe(100));
        it('HISTORY_WARN_AT is 80',    () => expect(HISTORY_WARN_AT).toBe(80));
        it('IMPORT_MAX_BYTES is 50KB', () => expect(IMPORT_MAX_BYTES).toBe(50 * 1024));
        it('GENERATE_TIMEOUT_MS is 120s', () => expect(GENERATE_TIMEOUT_MS).toBe(120_000));
        it('SUGGEST_TIMEOUT_MS is 8s',    () => expect(SUGGEST_TIMEOUT_MS).toBe(8_000));
        it('DEFAULT_SECTION_COUNT is 5',  () => expect(DEFAULT_SECTION_COUNT).toBe(5));
        it('MAX_TOKENS_DEFAULT is 8192',  () => expect(MAX_TOKENS_DEFAULT).toBe(8192));
    });

    describe('DEFAULT_WINDOW', () => {
        it('has width 1280',  () => expect(DEFAULT_WINDOW.width).toBe(1280));
        it('has height 800',  () => expect(DEFAULT_WINDOW.height).toBe(800));
    });

    describe('VALID_PROVIDERS', () => {
        it('contains anthropic and openai', () => {
            expect(VALID_PROVIDERS).toContain('anthropic');
            expect(VALID_PROVIDERS).toContain('openai');
        });
        it('has exactly 2 providers', () => expect(VALID_PROVIDERS).toHaveLength(2));
    });

    describe('VALID_MODELS', () => {
        it('has anthropic models', () => {
            expect(Array.isArray(VALID_MODELS.anthropic)).toBe(true);
            expect(VALID_MODELS.anthropic.length).toBeGreaterThan(0);
        });
        it('has openai models', () => {
            expect(Array.isArray(VALID_MODELS.openai)).toBe(true);
            expect(VALID_MODELS.openai.length).toBeGreaterThan(0);
        });
        it('anthropic includes claude-sonnet-4', () => {
            expect(VALID_MODELS.anthropic).toContain('claude-sonnet-4-20250514');
        });
        it('openai includes gpt-4o', () => {
            expect(VALID_MODELS.openai).toContain('gpt-4o');
        });
    });

    describe('PROVIDERS', () => {
        it('anthropic has correct endpoint', () => {
            expect(PROVIDERS.anthropic.endpoint).toBe('https://api.anthropic.com/v1/messages');
        });
        it('openai has correct endpoint', () => {
            expect(PROVIDERS.openai.endpoint).toBe('https://api.openai.com/v1/chat/completions');
        });
        it('each provider has id, label, endpoint, model', () => {
            for (const p of Object.values(PROVIDERS)) {
                expect(p).toHaveProperty('id');
                expect(p).toHaveProperty('label');
                expect(p).toHaveProperty('endpoint');
                expect(p).toHaveProperty('model');
            }
        });
    });

    describe('WINDOWS_RESERVED', () => {
        it('is a Set', () => expect(WINDOWS_RESERVED).toBeInstanceOf(Set));
        it('contains NUL',  () => expect(WINDOWS_RESERVED.has('NUL')).toBe(true));
        it('contains CON',  () => expect(WINDOWS_RESERVED.has('CON')).toBe(true));
        it('contains COM1', () => expect(WINDOWS_RESERVED.has('COM1')).toBe(true));
        it('contains LPT9', () => expect(WINDOWS_RESERVED.has('LPT9')).toBe(true));
        it('does NOT contain normal names', () => {
            expect(WINDOWS_RESERVED.has('SKILL')).toBe(false);
            expect(WINDOWS_RESERVED.has('README')).toBe(false);
        });
    });
});
