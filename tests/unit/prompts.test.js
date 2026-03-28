'use strict';

const {
    fenceUserInput,
    parseSuggestions,
    buildSuggesterMessage,
    buildSuggesterSystem,
    buildBuilderSystem,
    buildBuilderMessage,
} = require('../../main/prompts');

// ── fenceUserInput ────────────────────────────────────────────────────────────

describe('fenceUserInput', () => {
    it('wraps content in user_input tags', () => {
        const result = fenceUserInput('hello world');
        expect(result).toBe('<user_input>\nhello world\n</user_input>');
    });

    it('escapes closing tag inside content to prevent injection breakout', () => {
        const result = fenceUserInput('try </user_input> injection');
        // The escaped form must appear in the body
        expect(result).toContain('<\\/user_input>');
        // The raw unescaped form must not appear inside the body (only the wrapper closing tag is allowed at the very end)
        const body = result.slice('<user_input>\n'.length, result.lastIndexOf('\n</user_input>'));
        expect(body).not.toContain('</user_input>');
    });

    it('handles empty string', () => {
        const result = fenceUserInput('');
        expect(result).toBe('<user_input>\n\n</user_input>');
    });

    it('coerces non-string to string', () => {
        expect(() => fenceUserInput(42)).not.toThrow();
        expect(fenceUserInput(42)).toContain('42');
    });

    it('handles multiline content', () => {
        const result = fenceUserInput('line1\nline2\nline3');
        expect(result).toContain('line1\nline2\nline3');
    });

    it('does not escape other HTML-like content', () => {
        const result = fenceUserInput('<b>bold</b>');
        expect(result).toContain('<b>bold</b>');
    });
});

// ── parseSuggestions ──────────────────────────────────────────────────────────

describe('parseSuggestions', () => {
    it('parses a valid JSON array of strings', () => {
        const raw = '["Class Designer", "Memory Debugger", "CMake Builder", "Template Advisor", "Concurrency Helper"]';
        const result = parseSuggestions(raw, 5);
        expect(result).toHaveLength(5);
        expect(result[0]).toBe('Class Designer');
    });

    it('returns fallback array for empty string', () => {
        const result = parseSuggestions('', 3);
        expect(result).toHaveLength(3);
        expect(result[0]).toBe('Section 1');
    });

    it('returns fallback array for invalid JSON', () => {
        const result = parseSuggestions('not json at all', 4);
        expect(result).toHaveLength(4);
    });

    it('strips markdown fences before parsing', () => {
        const raw = '```json\n["A", "B", "C"]\n```';
        const result = parseSuggestions(raw, 3);
        expect(result).toEqual(['A', 'B', 'C']);
    });

    it('pads short arrays with fallback entries', () => {
        const raw = '["Only One"]';
        const result = parseSuggestions(raw, 3);
        expect(result).toHaveLength(3);
        expect(result[0]).toBe('Only One');
        expect(result[1]).toBe('Section 2');
    });

    it('trims arrays longer than requested count', () => {
        const raw = '["A", "B", "C", "D", "E"]';
        const result = parseSuggestions(raw, 3);
        expect(result).toHaveLength(3);
    });

    it('filters out non-string entries', () => {
        const raw = '["Valid", 42, null, "Also Valid"]';
        const result = parseSuggestions(raw, 2);
        expect(result[0]).toBe('Valid');
        expect(result[1]).toBe('Also Valid');
    });

    it('truncates individual suggestions to 60 chars', () => {
        const long = 'A'.repeat(100);
        const raw = JSON.stringify([long, 'Short']);
        const result = parseSuggestions(raw, 2);
        expect(result[0]).toHaveLength(60);
    });

    it('clamps sectionCount to 2–10 range', () => {
        const raw = '["A", "B", "C"]';
        // 1 is below minimum — should be clamped to 2
        expect(parseSuggestions(raw, 1)).toHaveLength(2);
        // 20 is above maximum — should be clamped to 10
        expect(parseSuggestions(raw, 20)).toHaveLength(10);
    });

    it('returns fallback when parsed result is not an array', () => {
        const result = parseSuggestions('{"key": "value"}', 3);
        expect(result).toHaveLength(3);
        expect(result[0]).toBe('Section 1');
    });
});

// ── buildSuggesterSystem ──────────────────────────────────────────────────────

describe('buildSuggesterSystem', () => {
    it('includes the section count in output format', () => {
        const sys = buildSuggesterSystem(5);
        expect(sys).toContain('5');
    });

    it('instructs to return only JSON array', () => {
        const sys = buildSuggesterSystem(3);
        expect(sys.toLowerCase()).toMatch(/json/);
        expect(sys).toContain('no markdown');
    });

    it('clamps count to 2 minimum', () => {
        const sys = buildSuggesterSystem(0);
        expect(sys).toContain('2');
    });
});

// ── buildSuggesterMessage ─────────────────────────────────────────────────────

describe('buildSuggesterMessage', () => {
    it('includes keyword and description in message', () => {
        const msg = buildSuggesterMessage('cpp-expert', 'C++ guidance', 5);
        expect(msg).toContain('cpp-expert');
        expect(msg).toContain('C++ guidance');
        expect(msg).toContain('5');
    });

    it('escapes XML special chars in keyword', () => {
        const msg = buildSuggesterMessage('<script>', 'desc', 3);
        expect(msg).toContain('&lt;script&gt;');
        expect(msg).not.toContain('<script>');
    });

    it('escapes ampersands in description', () => {
        const msg = buildSuggesterMessage('skill', 'foo & bar', 3);
        expect(msg).toContain('foo &amp; bar');
    });

    it('wraps content in user_input tags', () => {
        const msg = buildSuggesterMessage('kw', 'desc', 4);
        expect(msg).toContain('<user_input>');
        expect(msg).toContain('</user_input>');
    });
});

// ── buildBuilderSystem ────────────────────────────────────────────────────────

describe('buildBuilderSystem', () => {
    it('does not contain the exemplar block', () => {
        const sys = buildBuilderSystem(['Class Designer', 'Memory Manager']);
        expect(sys).not.toContain('<exemplar>');
    });

    it('contains the output template', () => {
        const sys = buildBuilderSystem(['Class Designer']);
        expect(sys).toContain('<output_template>');
    });

    it('includes each section name in the template', () => {
        const sys = buildBuilderSystem(['Class Designer', 'Memory Manager']);
        expect(sys).toContain('## Class Designer');
        expect(sys).toContain('## Memory Manager');
    });

    it('escapes XML special chars in section names', () => {
        // _escapeXml is applied to each section name before embedding in the template
        const sys = buildBuilderSystem(['<script>']);
        expect(sys).toContain('&lt;script&gt;');
        expect(sys).not.toContain('<script>');
    });

    it('escapes ampersands in section names', () => {
        const sys = buildBuilderSystem(['A & B']);
        expect(sys).toContain('A &amp; B');
        expect(sys).not.toContain('A & B');
    });
});

// ── buildBuilderMessage ───────────────────────────────────────────────────────

describe('buildBuilderMessage', () => {
    it('includes keyword, description, and sections', () => {
        const msg = buildBuilderMessage('cpp-expert', 'C++ guidance', ['Class Designer']);
        expect(msg).toContain('cpp-expert');
        expect(msg).toContain('C++ guidance');
        expect(msg).toContain('Class Designer');
    });

    it('wraps content in user_input tags', () => {
        const msg = buildBuilderMessage('kw', 'desc', ['S1']);
        expect(msg).toContain('<user_input>');
        expect(msg).toContain('</user_input>');
    });
});
