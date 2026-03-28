'use strict';

const { validateForm, validateJson } = require('../../main/validators/common');

// ── validateForm ──────────────────────────────────────────────────────────────

const VALID_FORM = {
    skillName:       'My Skill',
    whenToUse:       'Use when you need to do something specific and useful.',
    exampleRequests: ['Do the thing', 'Help me with the thing'],
    expectedInputs:  '',
    expectedOutputs: '',
    constraints:     '',
    framework:       'claude',
};

describe('validateForm', () => {
    it('accepts a fully valid payload', () => {
        const r = validateForm(VALID_FORM);
        expect(r.valid).toBe(true);
        expect(r.errors).toHaveLength(0);
    });

    it('rejects missing skillName', () => {
        const r = validateForm({ ...VALID_FORM, skillName: '' });
        expect(r.valid).toBe(false);
        expect(r.errors.some(e => /skill name/i.test(e))).toBe(true);
    });

    it('rejects skillName over 80 chars', () => {
        const r = validateForm({ ...VALID_FORM, skillName: 'a'.repeat(81) });
        expect(r.valid).toBe(false);
        expect(r.errors.some(e => /skill name/i.test(e))).toBe(true);
    });

    it('rejects missing whenToUse', () => {
        const r = validateForm({ ...VALID_FORM, whenToUse: '   ' });
        expect(r.valid).toBe(false);
        expect(r.errors.some(e => /when to use/i.test(e))).toBe(true);
    });

    it('rejects whenToUse over 1000 chars', () => {
        const r = validateForm({ ...VALID_FORM, whenToUse: 'x'.repeat(1001) });
        expect(r.valid).toBe(false);
    });

    it('rejects empty exampleRequests array', () => {
        const r = validateForm({ ...VALID_FORM, exampleRequests: [] });
        expect(r.valid).toBe(false);
        expect(r.errors.some(e => /example/i.test(e))).toBe(true);
    });

    it('rejects more than 10 example requests', () => {
        const r = validateForm({ ...VALID_FORM, exampleRequests: new Array(11).fill('ex') });
        expect(r.valid).toBe(false);
    });

    it('rejects individual example request over 200 chars', () => {
        const r = validateForm({ ...VALID_FORM, exampleRequests: ['x'.repeat(201)] });
        expect(r.valid).toBe(false);
    });

    it('rejects invalid framework', () => {
        const r = validateForm({ ...VALID_FORM, framework: 'gemini' });
        expect(r.valid).toBe(false);
        expect(r.errors.some(e => /framework/i.test(e))).toBe(true);
    });

    it('accepts all valid frameworks', () => {
        for (const fw of ['claude', 'chatgpt', 'langchain']) {
            const r = validateForm({ ...VALID_FORM, framework: fw });
            expect(r.valid).toBe(true);
        }
    });

    it('rejects expectedInputs over 3000 chars', () => {
        const r = validateForm({ ...VALID_FORM, expectedInputs: 'x'.repeat(3001) });
        expect(r.valid).toBe(false);
    });

    it('rejects expectedOutputs over 3000 chars', () => {
        const r = validateForm({ ...VALID_FORM, expectedOutputs: 'x'.repeat(3001) });
        expect(r.valid).toBe(false);
    });

    it('rejects constraints over 3000 chars', () => {
        const r = validateForm({ ...VALID_FORM, constraints: 'x'.repeat(3001) });
        expect(r.valid).toBe(false);
    });

    it('collects multiple errors at once', () => {
        const r = validateForm({ skillName: '', whenToUse: '', exampleRequests: [], framework: 'bad' });
        expect(r.valid).toBe(false);
        expect(r.errors.length).toBeGreaterThanOrEqual(3);
    });
});

// ── validateJson ──────────────────────────────────────────────────────────────

const VALID_JSON = {
    name:             'my-skill',
    description:      'Does something useful.',
    when_to_use:      'Use when you need to accomplish a specific, well-defined task.',
    example_requests: ['Do the thing'],
    expected_inputs:  'A description',
    expected_outputs: 'A result',
    instructions:     ['Step one', 'Step two'],
    hard_rules:       [],
    edge_cases:       [],
    metadata:         { framework: 'claude', provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
};

describe('validateJson', () => {
    it('accepts a fully valid JSON intermediate', () => {
        const r = validateJson(VALID_JSON);
        expect(r.valid).toBe(true);
        expect(r.errors).toHaveLength(0);
    });

    it('rejects null', () => {
        const r = validateJson(null);
        expect(r.valid).toBe(false);
    });

    it('rejects non-object', () => {
        const r = validateJson('string');
        expect(r.valid).toBe(false);
    });

    it('rejects missing required fields', () => {
        const { name, ...rest } = VALID_JSON;
        const r = validateJson(rest);
        expect(r.valid).toBe(false);
        expect(r.errors.some(e => /name/i.test(e))).toBe(true);
    });

    it('rejects when_to_use under 30 chars', () => {
        const r = validateJson({ ...VALID_JSON, when_to_use: 'Too short.' });
        expect(r.valid).toBe(false);
        expect(r.errors.some(e => /when_to_use/i.test(e))).toBe(true);
    });

    it('rejects instructions with fewer than 2 items', () => {
        const r = validateJson({ ...VALID_JSON, instructions: ['Only one'] });
        expect(r.valid).toBe(false);
        expect(r.errors.some(e => /instructions/i.test(e))).toBe(true);
    });

    it('rejects empty example_requests', () => {
        const r = validateJson({ ...VALID_JSON, example_requests: [] });
        expect(r.valid).toBe(false);
    });

    it('rejects missing metadata', () => {
        const { metadata, ...rest } = VALID_JSON;
        const r = validateJson(rest);
        expect(r.valid).toBe(false);
        expect(r.errors.some(e => /metadata/i.test(e))).toBe(true);
    });

    it('rejects invalid metadata.framework', () => {
        const r = validateJson({ ...VALID_JSON, metadata: { ...VALID_JSON.metadata, framework: 'gemini' } });
        expect(r.valid).toBe(false);
        expect(r.errors.some(e => /framework/i.test(e))).toBe(true);
    });

    it('accepts all valid frameworks in metadata', () => {
        for (const fw of ['claude', 'chatgpt', 'langchain']) {
            const r = validateJson({ ...VALID_JSON, metadata: { ...VALID_JSON.metadata, framework: fw } });
            expect(r.valid).toBe(true);
        }
    });

    it('accepts a valid specialists array', () => {
        const r = validateJson({
            ...VALID_JSON,
            specialists: [{ name: 'Class Designer', when: 'routes here', inputs: 'code', outputs: 'refactored code', hard_rules: ['ALWAYS do x'] }],
        });
        expect(r.valid).toBe(true);
    });

    it('rejects specialists that is not an array', () => {
        const r = validateJson({ ...VALID_JSON, specialists: 'not an array' });
        expect(r.valid).toBe(false);
        expect(r.errors.some(e => /specialists/i.test(e))).toBe(true);
    });

    it('rejects specialist missing name', () => {
        const r = validateJson({ ...VALID_JSON, specialists: [{ hard_rules: ['ALWAYS x'] }] });
        expect(r.valid).toBe(false);
        expect(r.errors.some(e => /specialists\[0\]\.name/i.test(e))).toBe(true);
    });

    it('rejects specialist with empty hard_rules', () => {
        const r = validateJson({ ...VALID_JSON, specialists: [{ name: 'Test', hard_rules: [] }] });
        expect(r.valid).toBe(false);
        expect(r.errors.some(e => /hard_rules/i.test(e))).toBe(true);
    });

    it('accepts decision_points as array of strings', () => {
        const r = validateJson({ ...VALID_JSON, decision_points: ['Thread safety → Concurrency Helper'] });
        expect(r.valid).toBe(true);
    });

    it('rejects decision_points that is not an array', () => {
        const r = validateJson({ ...VALID_JSON, decision_points: 'not array' });
        expect(r.valid).toBe(false);
    });

    it('accepts constraints as array of strings', () => {
        const r = validateJson({ ...VALID_JSON, constraints: ['No database schema design'] });
        expect(r.valid).toBe(true);
    });

    it('accepts valid json without instructions field (specialist-format skills)', () => {
        const { instructions, ...noInstructions } = VALID_JSON;
        const r = validateJson({
            ...noInstructions,
            specialists: [{ name: 'Test Spec', hard_rules: ['ALWAYS do x'] }],
        });
        expect(r.valid).toBe(true);
    });
});
