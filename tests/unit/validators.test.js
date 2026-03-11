'use strict';

const { validateForm, validateJson } = require('../../main/validators/common');

// ── validateForm (Layer 1) ──────────────────────────────────────────────────

describe('validateForm', () => {
    function validForm(overrides = {}) {
        return {
            skillName:       'My Skill',
            whenToUse:       'Use this when you need to do something useful.',
            exampleRequests: ['Example one', 'Example two'],
            expectedInputs:  'User text',
            expectedOutputs: 'Processed result',
            constraints:     '',
            framework:       'claude',
            ...overrides,
        };
    }

    test('valid form passes', () => {
        expect(validateForm(validForm()).valid).toBe(true);
    });

    test('missing skill name fails', () => {
        const { valid, errors } = validateForm(validForm({ skillName: '' }));
        expect(valid).toBe(false);
        expect(errors.some(e => /skill name/i.test(e))).toBe(true);
    });

    test('missing whenToUse fails', () => {
        const { valid, errors } = validateForm(validForm({ whenToUse: '' }));
        expect(valid).toBe(false);
        expect(errors.some(e => /when to use/i.test(e))).toBe(true);
    });

    test('empty exampleRequests fails', () => {
        const { valid, errors } = validateForm(validForm({ exampleRequests: [] }));
        expect(valid).toBe(false);
        expect(errors.some(e => /example/i.test(e))).toBe(true);
    });

    test('non-array exampleRequests fails', () => {
        const { valid, errors } = validateForm(validForm({ exampleRequests: null }));
        expect(valid).toBe(false);
        expect(errors.some(e => /example/i.test(e))).toBe(true);
    });

    test('invalid framework fails', () => {
        const { valid, errors } = validateForm(validForm({ framework: 'gpt5' }));
        expect(valid).toBe(false);
        expect(errors.some(e => /framework/i.test(e))).toBe(true);
    });

    test('valid frameworks accepted', () => {
        for (const fw of ['claude', 'chatgpt', 'langchain']) {
            expect(validateForm(validForm({ framework: fw })).valid).toBe(true);
        }
    });

    test('skillName exceeding cap fails', () => {
        const { valid, errors } = validateForm(validForm({ skillName: 'a'.repeat(81) }));
        expect(valid).toBe(false);
        expect(errors.some(e => /skill name/i.test(e))).toBe(true);
    });

    test('exactly 10 example requests is valid', () => {
        const examples = Array.from({ length: 10 }, (_, i) => `example ${i + 1}`);
        expect(validateForm(validForm({ exampleRequests: examples })).valid).toBe(true);
    });

    test('11 example requests fails', () => {
        const examples = Array.from({ length: 11 }, (_, i) => `example ${i + 1}`);
        const { valid, errors } = validateForm(validForm({ exampleRequests: examples }));
        expect(valid).toBe(false);
        expect(errors.some(e => /too many/i.test(e))).toBe(true);
    });

    test('example request exceeding per-item cap fails', () => {
        const longExample = 'x'.repeat(201);
        const { valid, errors } = validateForm(validForm({ exampleRequests: [longExample] }));
        expect(valid).toBe(false);
        expect(errors.some(e => /example request 1/i.test(e))).toBe(true);
    });

    test('constraints exceeding cap fails', () => {
        const { valid, errors } = validateForm(validForm({ constraints: 'x'.repeat(1501) }));
        expect(valid).toBe(false);
        expect(errors.some(e => /constraints/i.test(e))).toBe(true);
    });

    test('multiple errors are all reported', () => {
        const { errors } = validateForm({
            skillName: '',
            whenToUse: '',
            exampleRequests: [],
            framework: 'bad',
        });
        expect(errors.length).toBeGreaterThanOrEqual(3);
    });
});

// ── validateJson (Layer 2) ──────────────────────────────────────────────────

describe('validateJson', () => {
    function validJson(overrides = {}) {
        return {
            name:            'My Skill',
            description:     'Does something useful',
            when_to_use:     'Use this when you need to process text input automatically',
            example_requests: ['Do task one', 'Do task two'],
            expected_inputs:  'Text string',
            expected_outputs: 'Transformed string',
            instructions:    ['Step one: do this', 'Step two: do that'],
            hard_rules:       [],
            edge_cases:       [],
            metadata: {
                framework:  'claude',
                provider:   'anthropic',
                model:      'claude-sonnet-4-20250514',
                created_at: '2025-01-01T00:00:00.000Z',
            },
            ...overrides,
        };
    }

    test('valid JSON passes', () => {
        expect(validateJson(validJson()).valid).toBe(true);
    });

    test('null input fails', () => {
        expect(validateJson(null).valid).toBe(false);
    });

    test('non-object input fails', () => {
        expect(validateJson('string').valid).toBe(false);
    });

    test('missing name fails', () => {
        const j = validJson();
        delete j.name;
        const { valid, errors } = validateJson(j);
        expect(valid).toBe(false);
        expect(errors.some(e => /name/i.test(e))).toBe(true);
    });

    test('missing instructions fails', () => {
        const j = validJson();
        delete j.instructions;
        const { valid, errors } = validateJson(j);
        expect(valid).toBe(false);
        expect(errors.some(e => /instructions/i.test(e))).toBe(true);
    });

    test('short when_to_use fails', () => {
        const { valid, errors } = validateJson(validJson({ when_to_use: 'Short' }));
        expect(valid).toBe(false);
        expect(errors.some(e => /when_to_use/i.test(e))).toBe(true);
    });

    test('when_to_use exactly 30 chars passes', () => {
        const exactly30 = 'x'.repeat(30);
        expect(validateJson(validJson({ when_to_use: exactly30 })).valid).toBe(true);
    });

    test('instructions with only 1 item fails', () => {
        const { valid, errors } = validateJson(validJson({ instructions: ['only one'] }));
        expect(valid).toBe(false);
        expect(errors.some(e => /instructions/i.test(e))).toBe(true);
    });

    test('instructions with 2 items passes', () => {
        expect(validateJson(validJson({ instructions: ['one', 'two'] })).valid).toBe(true);
    });

    test('empty example_requests fails', () => {
        const { valid, errors } = validateJson(validJson({ example_requests: [] }));
        expect(valid).toBe(false);
        expect(errors.some(e => /example_requests/i.test(e))).toBe(true);
    });

    test('missing metadata fails', () => {
        const j = validJson();
        delete j.metadata;
        const { valid, errors } = validateJson(j);
        expect(valid).toBe(false);
        expect(errors.some(e => /metadata/i.test(e))).toBe(true);
    });

    test('invalid metadata.framework fails', () => {
        const { valid, errors } = validateJson(validJson({
            metadata: { framework: 'llama', provider: 'anthropic', model: 'x', created_at: 'y' },
        }));
        expect(valid).toBe(false);
        expect(errors.some(e => /framework/i.test(e))).toBe(true);
    });

    test('all three valid frameworks pass metadata check', () => {
        for (const fw of ['claude', 'chatgpt', 'langchain']) {
            const j = validJson();
            j.metadata.framework = fw;
            expect(validateJson(j).valid).toBe(true);
        }
    });
});
