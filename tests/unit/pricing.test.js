'use strict';

const { calculateCost, PRICING } = require('../../main/pricing');

describe('calculateCost', () => {
    it('calculates anthropic claude-sonnet-4 cost correctly', () => {
        // 1M input @ $3.00 + 1M output @ $15.00 = $18.00
        const cost = calculateCost('anthropic', 'claude-sonnet-4-20250514', 1_000_000, 1_000_000);
        expect(cost).toBeCloseTo(18.0, 5);
    });

    it('calculates anthropic claude-opus-4 cost correctly', () => {
        // 1M input @ $15.00 + 1M output @ $75.00 = $90.00
        const cost = calculateCost('anthropic', 'claude-opus-4-20250514', 1_000_000, 1_000_000);
        expect(cost).toBeCloseTo(90.0, 5);
    });

    it('calculates anthropic claude-haiku cost correctly', () => {
        // 1M input @ $0.80 + 1M output @ $4.00 = $4.80
        const cost = calculateCost('anthropic', 'claude-haiku-4-5-20251001', 1_000_000, 1_000_000);
        expect(cost).toBeCloseTo(4.8, 5);
    });

    it('calculates openai gpt-4o cost correctly', () => {
        // 1M input @ $2.50 + 1M output @ $10.00 = $12.50
        const cost = calculateCost('openai', 'gpt-4o', 1_000_000, 1_000_000);
        expect(cost).toBeCloseTo(12.5, 5);
    });

    it('calculates openai gpt-4o-mini cost correctly', () => {
        // 1M input @ $0.15 + 1M output @ $0.60 = $0.75
        const cost = calculateCost('openai', 'gpt-4o-mini', 1_000_000, 1_000_000);
        expect(cost).toBeCloseTo(0.75, 5);
    });

    it('calculates openai gpt-4.1 cost correctly', () => {
        const cost = calculateCost('openai', 'gpt-4.1', 1_000_000, 1_000_000);
        expect(cost).toBeCloseTo(10.0, 5);
    });

    it('calculates openai gpt-4.1-mini cost correctly', () => {
        const cost = calculateCost('openai', 'gpt-4.1-mini', 1_000_000, 1_000_000);
        expect(cost).toBeCloseTo(2.0, 5);
    });

    it('returns 0 for unknown model', () => {
        const cost = calculateCost('anthropic', 'claude-unknown-999', 100_000, 50_000);
        expect(cost).toBe(0);
    });

    it('returns 0 for unknown provider', () => {
        const cost = calculateCost('google', 'gemini-pro', 100_000, 50_000);
        expect(cost).toBe(0);
    });

    it('returns 0 when both token counts are 0', () => {
        const cost = calculateCost('anthropic', 'claude-sonnet-4-20250514', 0, 0);
        expect(cost).toBe(0);
    });

    it('calculates cost for fractional token counts', () => {
        // 1000 input @ $3.00/M + 500 output @ $15.00/M = 0.003 + 0.0075 = 0.0105
        const cost = calculateCost('anthropic', 'claude-sonnet-4-20250514', 1000, 500);
        expect(cost).toBeCloseTo(0.0105, 6);
    });

    it('only charges for input when output is 0', () => {
        const cost = calculateCost('openai', 'gpt-4o', 1_000_000, 0);
        expect(cost).toBeCloseTo(2.5, 5);
    });

    it('only charges for output when input is 0', () => {
        const cost = calculateCost('openai', 'gpt-4o', 0, 1_000_000);
        expect(cost).toBeCloseTo(10.0, 5);
    });

    it('PRICING table contains all expected anthropic models', () => {
        expect(PRICING.anthropic).toHaveProperty('claude-sonnet-4-20250514');
        expect(PRICING.anthropic).toHaveProperty('claude-opus-4-20250514');
        expect(PRICING.anthropic).toHaveProperty('claude-haiku-4-5-20251001');
    });

    it('PRICING table contains all expected openai models', () => {
        expect(PRICING.openai).toHaveProperty('gpt-4o');
        expect(PRICING.openai).toHaveProperty('gpt-4o-mini');
        // Use bracket access for keys containing dots (jest toHaveProperty treats dots as path separators)
        expect(PRICING.openai['gpt-4.1']).toBeDefined();
        expect(PRICING.openai['gpt-4.1-mini']).toBeDefined();
    });

    it('all pricing entries have input and output rates', () => {
        for (const [provider, models] of Object.entries(PRICING)) {
            for (const [model, rates] of Object.entries(models)) {
                expect(typeof rates.input).toBe('number');
                expect(typeof rates.output).toBe('number');
                expect(rates.input).toBeGreaterThan(0);
                expect(rates.output).toBeGreaterThan(0);
            }
        }
    });
});
