'use strict';

const { detectProvider, getProvider } = require('../../main/providers');

describe('detectProvider', () => {
    test('sk-ant- prefix → anthropic', () => {
        expect(detectProvider('sk-ant-api01-abc123')).toBe('anthropic');
    });

    test('sk-ant- prefix with minimal key → anthropic', () => {
        expect(detectProvider('sk-ant-x')).toBe('anthropic');
    });

    test('sk- prefix (non-anthropic) → openai', () => {
        expect(detectProvider('sk-proj-abc123')).toBe('openai');
    });

    test('sk- prefix minimal → openai', () => {
        expect(detectProvider('sk-x')).toBe('openai');
    });

    test('unknown prefix → unknown', () => {
        expect(detectProvider('gsk_somekey')).toBe('unknown');
    });

    test('empty string → unknown', () => {
        expect(detectProvider('')).toBe('unknown');
    });

    test('null → unknown', () => {
        expect(detectProvider(null)).toBe('unknown');
    });

    test('undefined → unknown', () => {
        expect(detectProvider(undefined)).toBe('unknown');
    });

    test('number → unknown', () => {
        expect(detectProvider(12345)).toBe('unknown');
    });

    test('sk-ant- is case-sensitive (uppercase does not match anthropic)', () => {
        // Detection is advisory only; uppercase key prefix is unknown
        const result = detectProvider('SK-ANT-api01-abc');
        expect(result).toBe('unknown');
    });
});

describe('getProvider', () => {
    test('anthropic returns config with correct id', () => {
        const p = getProvider('anthropic');
        expect(p).not.toBeNull();
        expect(p.id).toBe('anthropic');
        expect(p.model).toBeDefined();
        expect(p.endpoint).toMatch(/anthropic\.com/);
    });

    test('openai returns config with correct id', () => {
        const p = getProvider('openai');
        expect(p).not.toBeNull();
        expect(p.id).toBe('openai');
        expect(p.model).toBeDefined();
        expect(p.endpoint).toMatch(/openai\.com/);
    });

    test('unknown id returns null', () => {
        expect(getProvider('llama')).toBeNull();
        expect(getProvider('')).toBeNull();
        expect(getProvider(null)).toBeNull();
    });
});
