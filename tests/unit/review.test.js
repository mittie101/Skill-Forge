'use strict';

const {
    buildSkillReviewPrompt,
    buildSkillFixPrompt,
    REVIEW_RUBRIC,
} = require('../../main/prompts');

const {
    _normaliseReviewResult,
    _injectCreatedAt,
    _bumpVersion,
    _stripMarkdownFences,
    _restoreFrontmatterName,
    _quoteFrontmatterValue,
} = require('../../ipc/review');

const {
    MAX_REVIEW_INPUT_CHARS,
} = require('../../main/prompts');

const {
    validateCanonicalSkillStructure,
    _isRichFormat,
} = require('../../main/validators/skill');

// ─────────────────────────────────────────────────────────────────────────────
// Prompt builders — buildSkillReviewPrompt
// ─────────────────────────────────────────────────────────────────────────────

describe('buildSkillReviewPrompt', () => {
    const CATEGORY_NAMES = [
        'Trigger Accuracy',
        'Instruction Precision',
        'Output Specificity',
        'Hard Rule Quality',
        'Example Request Coverage',
        'Edge Case Utility',
        'Readability & Frontmatter',
    ];

    it('returns { system, user } object', () => {
        const { system, user } = buildSkillReviewPrompt('some content');
        expect(typeof system).toBe('string');
        expect(typeof user).toBe('string');
        expect(system.length).toBeGreaterThan(100);
        expect(user.length).toBeGreaterThan(0);
    });

    it('includes all 7 exact category names in system prompt', () => {
        const { system } = buildSkillReviewPrompt('some content');
        for (const name of CATEGORY_NAMES) {
            expect(system).toContain(name);
        }
    });

    it('includes canonical max scores in system prompt', () => {
        const { system } = buildSkillReviewPrompt('skill content');
        // Check each category max appears near its name
        const maxes = [20, 20, 15, 15, 10, 10, 10];
        for (const max of maxes) {
            expect(system).toContain(String(max));
        }
    });

    it('demands JSON-only output', () => {
        const { system } = buildSkillReviewPrompt('skill content');
        expect(system.toLowerCase()).toContain('json');
        // Should instruct no prose/fences
        expect(system).toMatch(/no.*prose|no.*explanation|only.*json|json.*only/i);
    });

    it('includes score-as-written instruction', () => {
        const { system } = buildSkillReviewPrompt('skill content');
        expect(system).toContain('as it is written');
    });

    it('includes do-not-reward-intent instruction', () => {
        const { system } = buildSkillReviewPrompt('skill content');
        expect(system).toMatch(/do not reward intent/i);
    });

    it('includes improvements ordered highest-impact instruction', () => {
        const { system } = buildSkillReviewPrompt('skill content');
        expect(system).toMatch(/highest.impact first|ordered.*highest/i);
    });

    it('fences skill content in user message', () => {
        const { user } = buildSkillReviewPrompt('---\nname: test\n---\n# test');
        expect(user).toContain('<user_input>');
        expect(user).toContain('</user_input>');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Prompt builders — buildSkillFixPrompt
// ─────────────────────────────────────────────────────────────────────────────

describe('buildSkillFixPrompt', () => {
    const sampleImprovements = [
        'Add at least 5 example requests',
        'Prefix all hard rules with ALWAYS or NEVER',
    ];
    const sampleBreakdown = [
        { name: 'Trigger Accuracy', score: 12, max: 20, issues: ['Vague description'], verdict: 'Needs specificity' },
        { name: 'Instruction Precision', score: 20, max: 20, issues: [], verdict: 'Perfect' },
    ];

    it('returns { system, user } object', () => {
        const { system, user } = buildSkillFixPrompt('content', sampleImprovements, sampleBreakdown);
        expect(typeof system).toBe('string');
        expect(typeof user).toBe('string');
    });

    it('includes ordered improvements in user message', () => {
        const { user } = buildSkillFixPrompt('content', sampleImprovements, sampleBreakdown);
        expect(user).toContain(sampleImprovements[0]);
        expect(user).toContain(sampleImprovements[1]);
    });

    it('requires raw markdown output only', () => {
        const { system } = buildSkillFixPrompt('content', sampleImprovements, sampleBreakdown);
        expect(system).toMatch(/raw.*\.md|output raw/i);
        expect(system).toMatch(/no.*explanation|no.*fences/i);
    });

    it('instructs do not set version or created_at', () => {
        const { system } = buildSkillFixPrompt('content', sampleImprovements, sampleBreakdown);
        expect(system).toMatch(/do not set.*(version|created_at)/i);
    });

    it('fences original skill content in user message', () => {
        const { user } = buildSkillFixPrompt('my skill content', sampleImprovements, sampleBreakdown);
        expect(user).toContain('<user_input>');
        expect(user).toContain('my skill content');
    });

    it('includes score breakdown in user message', () => {
        const { user } = buildSkillFixPrompt('content', sampleImprovements, sampleBreakdown);
        expect(user).toContain('Trigger Accuracy');
        expect(user).toContain('12/20');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Parser / Normaliser — _normaliseReviewResult
// ─────────────────────────────────────────────────────────────────────────────

function _makeValidRaw(overrides = {}) {
    const base = {
        categories: [
            { name: 'Trigger Accuracy',          score: 18, max: 20, issues: [],                    verdict: 'Good' },
            { name: 'Instruction Precision',     score: 16, max: 20, issues: ['Too vague'],          verdict: 'Needs work' },
            { name: 'Output Specificity',        score: 12, max: 15, issues: [],                    verdict: 'OK' },
            { name: 'Hard Rule Quality',         score: 13, max: 15, issues: [],                    verdict: 'Good' },
            { name: 'Example Request Coverage',  score:  9, max: 10, issues: [],                    verdict: 'Good' },
            { name: 'Edge Case Utility',         score:  8, max: 10, issues: [],                    verdict: 'OK' },
            { name: 'Readability & Frontmatter', score:  9, max: 10, issues: [],                    verdict: 'Good' },
        ],
        total: 85,
        overall_verdict: 'Solid skill, a few areas to improve.',
        perfect: false,
        improvements: ['Make instruction steps more specific', 'Add ALWAYS/NEVER prefix to rules'],
    };
    return JSON.stringify({ ...base, ...overrides });
}

describe('_normaliseReviewResult', () => {
    it('parses clean JSON successfully', () => {
        const result = _normaliseReviewResult(_makeValidRaw());
        expect(result.ok).toBe(true);
        expect(result.data.categories).toHaveLength(7);
        expect(result.data.total).toBeGreaterThan(0);
    });

    it('parses JSON wrapped in code fences', () => {
        const raw = '```json\n' + _makeValidRaw() + '\n```';
        const result = _normaliseReviewResult(raw);
        expect(result.ok).toBe(true);
    });

    it('parses JSON wrapped in plain code fences', () => {
        const raw = '```\n' + _makeValidRaw() + '\n```';
        const result = _normaliseReviewResult(raw);
        expect(result.ok).toBe(true);
    });

    it('parses adversarial prose-wrapped JSON (explanation before real result)', () => {
        const raw = 'Sure! Here is my review of your skill:\n\nSome commentary here.\n\n' + _makeValidRaw() + '\n\nLet me know if you want more detail!';
        const result = _normaliseReviewResult(raw);
        expect(result.ok).toBe(true);
    });

    it('selects the largest JSON object when multiple are present', () => {
        // Small JSON followed by the real result
        const small = JSON.stringify({ note: 'preamble', value: 1 });
        const raw   = small + '\n\n' + _makeValidRaw();
        const result = _normaliseReviewResult(raw);
        expect(result.ok).toBe(true);
        expect(result.data.categories).toHaveLength(7);
    });

    it('recovers from trailing commas', () => {
        const bad = _makeValidRaw().replace(/"improvements":\s*\[([^\]]+)\]/, (m) => m.replace(/]$/, ',]'));
        const result = _normaliseReviewResult(bad);
        expect(result.ok).toBe(true);
    });

    it('recovers from JS-style line comments', () => {
        const commented = '// This is a review\n' + _makeValidRaw();
        const result = _normaliseReviewResult(commented);
        expect(result.ok).toBe(true);
    });

    it('returns friendly error when categories array is missing', () => {
        const bad = JSON.stringify({ total: 50, perfect: false, improvements: [] });
        const result = _normaliseReviewResult(bad);
        expect(result.ok).toBe(false);
        expect(result.error).toBeTruthy();
    });

    it('returns friendly error when fewer than 7 categories', () => {
        const bad = JSON.stringify({ categories: [{ name: 'Trigger Accuracy', score: 10, max: 20, issues: [], verdict: '' }], total: 10, perfect: false, improvements: [] });
        const result = _normaliseReviewResult(bad);
        expect(result.ok).toBe(false);
    });

    it('returns friendly error for duplicate category names', () => {
        const cats = JSON.parse(_makeValidRaw()).categories;
        cats[1] = { ...cats[0] }; // duplicate
        const bad = JSON.stringify({ categories: cats, total: 0, perfect: false, improvements: [] });
        const result = _normaliseReviewResult(bad);
        expect(result.ok).toBe(false);
    });

    it('returns friendly error for wrong category names', () => {
        const cats = JSON.parse(_makeValidRaw()).categories;
        cats[0] = { name: 'Wrong Category', score: 10, max: 20, issues: [], verdict: '' };
        const bad = JSON.stringify({ categories: cats, total: 0, perfect: false, improvements: [] });
        const result = _normaliseReviewResult(bad);
        expect(result.ok).toBe(false);
    });

    it('reorders categories to canonical order', () => {
        const parsed    = JSON.parse(_makeValidRaw());
        const reversed  = { ...parsed, categories: [...parsed.categories].reverse() };
        const result    = _normaliseReviewResult(JSON.stringify(reversed));
        expect(result.ok).toBe(true);
        expect(result.data.categories[0].name).toBe('Trigger Accuracy');
        expect(result.data.categories[6].name).toBe('Readability & Frontmatter');
    });

    it('overwrites model max values with canonical values', () => {
        const parsed = JSON.parse(_makeValidRaw());
        parsed.categories[0].max = 999; // model lying about max
        const result = _normaliseReviewResult(JSON.stringify(parsed));
        expect(result.ok).toBe(true);
        expect(result.data.categories[0].max).toBe(20); // canonical
    });

    it('clamps scores to [0, canonicalMax]', () => {
        const parsed = JSON.parse(_makeValidRaw());
        parsed.categories[0].score = 999; // too high
        parsed.categories[1].score = -5;  // negative
        const result = _normaliseReviewResult(JSON.stringify(parsed));
        expect(result.ok).toBe(true);
        expect(result.data.categories[0].score).toBe(20); // clamped to max
        expect(result.data.categories[1].score).toBe(0);  // clamped to 0
    });

    it('recomputes total from category scores', () => {
        const parsed = JSON.parse(_makeValidRaw());
        parsed.total = 0; // wrong total
        const result = _normaliseReviewResult(JSON.stringify(parsed));
        expect(result.ok).toBe(true);
        const expectedTotal = parsed.categories.reduce((s, c) => s + c.score, 0);
        expect(result.data.total).toBe(expectedTotal);
    });

    it('sets perfect=true only when total===100', () => {
        const parsed = JSON.parse(_makeValidRaw());
        // Set all scores to max
        REVIEW_RUBRIC.forEach((r, i) => { parsed.categories[i].score = r.max; });
        parsed.perfect = false; // lie about perfect
        const result = _normaliseReviewResult(JSON.stringify(parsed));
        expect(result.ok).toBe(true);
        expect(result.data.total).toBe(100);
        expect(result.data.perfect).toBe(true);
    });

    it('sets perfect=false and keeps improvements when total<100', () => {
        const result = _normaliseReviewResult(_makeValidRaw());
        expect(result.ok).toBe(true);
        expect(result.data.perfect).toBe(false);
        expect(result.data.improvements.length).toBeGreaterThan(0);
    });

    it('normalises and deduplicates improvements', () => {
        const parsed = JSON.parse(_makeValidRaw());
        parsed.improvements = [
            'Add more examples.',
            'Add more examples',  // duplicate (normalised form matches)
            'fix the hard rules',
        ];
        const result = _normaliseReviewResult(JSON.stringify(parsed));
        expect(result.ok).toBe(true);
        expect(result.data.improvements).toHaveLength(2);
    });

    it('strips trailing punctuation for dedup but preserves original casing', () => {
        const parsed = JSON.parse(_makeValidRaw());
        parsed.improvements = ['Fix the trigger description.', 'Fix the trigger description'];
        const result = _normaliseReviewResult(JSON.stringify(parsed));
        expect(result.ok).toBe(true);
        expect(result.data.improvements).toHaveLength(1);
        expect(result.data.improvements[0]).toBe('Fix the trigger description.');
    });

    it('sets improvements to empty array when perfect===true', () => {
        const parsed = JSON.parse(_makeValidRaw());
        REVIEW_RUBRIC.forEach((r, i) => { parsed.categories[i].score = r.max; });
        parsed.improvements = ['some improvement'];
        const result = _normaliseReviewResult(JSON.stringify(parsed));
        expect(result.ok).toBe(true);
        expect(result.data.perfect).toBe(true);
        expect(result.data.improvements).toEqual([]);
    });

    it('returns ok:false with friendly message on completely unparseable input', () => {
        const result = _normaliseReviewResult('not json at all!!!');
        expect(result.ok).toBe(false);
        expect(typeof result.error).toBe('string');
        expect(result.error.length).toBeGreaterThan(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Skill validator — validateCanonicalSkillStructure
// ─────────────────────────────────────────────────────────────────────────────

function _makeValidSkill(overrides = {}) {
    return `---
name: ${overrides.name ?? 'my-skill'}
description: ${overrides.description ?? 'A test skill.'}
version: ${overrides.version ?? '1'}
framework: claude
created_at: ${overrides.created_at ?? '2026-03-21T14:22:05.123Z'}
---

# ${overrides.title ?? (overrides.name ?? 'my-skill')}

One-line purpose statement.

## When to use
- Always use before starting any task.
- Use when the user asks about this domain.

## Example requests
- Example one
- Example two
- Example three
- Example four
- Example five

## Expected inputs
- The user provides relevant information.

## Expected outputs
- A structured response in the expected format.

## Instructions
1. Read the input carefully.
2. Identify the key requirements.
3. Apply domain knowledge.
4. Produce the output.
5. Verify correctness.

## Hard rules
- ALWAYS follow the canonical schema.
- NEVER invent facts not in the input.
- ALWAYS verify output before returning.

## Edge cases
- Scenario: Empty input provided.
  Mitigation: Return an error message.
- Scenario: Ambiguous input.
  Mitigation: Ask for clarification.
- Scenario: Input exceeds limits.
  Mitigation: Truncate and warn.
`;
}

describe('validateCanonicalSkillStructure', () => {
    it('passes a fully compliant skill', () => {
        const { valid, errors } = validateCanonicalSkillStructure(_makeValidSkill());
        expect(errors).toEqual([]);
        expect(valid).toBe(true);
    });

    it('detects missing frontmatter', () => {
        const md = '# my-skill\n\nNo frontmatter here.\n';
        const { valid, errors } = validateCanonicalSkillStructure(md);
        expect(valid).toBe(false);
        expect(errors.some(e => /frontmatter/i.test(e))).toBe(true);
    });

    it('detects missing required section', () => {
        const md = _makeValidSkill().replace(/## Hard rules[\s\S]*?## Edge cases/, '## Edge cases');
        const { valid, errors } = validateCanonicalSkillStructure(md);
        expect(valid).toBe(false);
        expect(errors.some(e => /Hard rules/i.test(e))).toBe(true);
    });

    it('detects wrong section order', () => {
        // Swap Instructions and Hard rules
        const base = _makeValidSkill();
        const withHard = base.replace(
            /(## Instructions[\s\S]*?)(## Hard rules[\s\S]*?)(## Edge cases)/,
            '$2$1$3'
        );
        const { valid, errors } = validateCanonicalSkillStructure(withHard);
        expect(valid).toBe(false);
        expect(errors.some(e => /order/i.test(e))).toBe(true);
    });

    it('detects insufficient example requests (<5)', () => {
        const md = _makeValidSkill().replace(
            /## Example requests[\s\S]*?## Expected inputs/,
            '## Example requests\n- Only one example\n\n## Expected inputs'
        );
        const { valid, errors } = validateCanonicalSkillStructure(md);
        expect(valid).toBe(false);
        expect(errors.some(e => /example request/i.test(e) && /5/i.test(e))).toBe(true);
    });

    it('detects insufficient hard rule count (<3)', () => {
        const md = _makeValidSkill().replace(
            /## Hard rules[\s\S]*?## Edge cases/,
            '## Hard rules\n- ALWAYS do this.\n\n## Edge cases'
        );
        const { valid, errors } = validateCanonicalSkillStructure(md);
        expect(valid).toBe(false);
        expect(errors.some(e => /hard rule/i.test(e) && /3/i.test(e))).toBe(true);
    });

    it('detects hard rules missing ALWAYS/NEVER prefix', () => {
        const md = _makeValidSkill().replace(
            '- NEVER invent facts not in the input.',
            '- Do not invent facts.'  // missing ALWAYS/NEVER
        );
        const { valid, errors } = validateCanonicalSkillStructure(md);
        expect(valid).toBe(false);
        expect(errors.some(e => /ALWAYS|NEVER/i.test(e))).toBe(true);
    });

    it('detects insufficient edge case count (<3)', () => {
        const md = _makeValidSkill().replace(
            /## Edge cases[\s\S]*/,
            '## Edge cases\n- Scenario: One case.\n  Mitigation: Handle it.\n'
        );
        const { valid, errors } = validateCanonicalSkillStructure(md);
        expect(valid).toBe(false);
        expect(errors.some(e => /edge case/i.test(e) && /3/i.test(e))).toBe(true);
    });

    it('detects invalid version (non-integer after parseInt)', () => {
        const md = _makeValidSkill({ version: 'abc' });
        const { valid, errors } = validateCanonicalSkillStructure(md);
        expect(valid).toBe(false);
        expect(errors.some(e => /version/i.test(e))).toBe(true);
    });

    it('detects missing version', () => {
        const md = _makeValidSkill().replace(/^version: 1\n/m, '');
        const { valid, errors } = validateCanonicalSkillStructure(md);
        expect(valid).toBe(false);
        expect(errors.some(e => /version/i.test(e))).toBe(true);
    });

    it('detects malformed created_at', () => {
        const md = _makeValidSkill({ created_at: 'not-a-date' });
        const { valid, errors } = validateCanonicalSkillStructure(md);
        expect(valid).toBe(false);
        expect(errors.some(e => /created_at/i.test(e))).toBe(true);
    });

    it('detects description >280 chars', () => {
        const longDesc = 'x'.repeat(281);
        const md = _makeValidSkill({ description: longDesc });
        const { valid, errors } = validateCanonicalSkillStructure(md);
        expect(valid).toBe(false);
        expect(errors.some(e => /description.*280|280.*description/i.test(e))).toBe(true);
    });

    it('detects title/name mismatch', () => {
        const md = _makeValidSkill({ name: 'my-skill', title: 'different-skill' });
        const { valid, errors } = validateCanonicalSkillStructure(md);
        expect(valid).toBe(false);
        expect(errors.some(e => /title|name/i.test(e))).toBe(true);
    });

    it('returns errors array on empty input', () => {
        const { valid, errors } = validateCanonicalSkillStructure('');
        expect(valid).toBe(false);
        expect(errors.length).toBeGreaterThan(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Post-stream injection — _injectCreatedAt, _bumpVersion
// ─────────────────────────────────────────────────────────────────────────────

describe('_injectCreatedAt', () => {
    it('replaces existing created_at', () => {
        const md     = '---\nname: test\ncreated_at: 2025-01-01T00:00:00.000Z\n---\nbody';
        const result = _injectCreatedAt(md, '2026-03-21T10:00:00.000Z');
        expect(result).toContain('created_at: "2026-03-21T10:00:00.000Z"');
        expect(result).not.toContain('2025-01-01T00:00:00.000Z');
    });

    it('adds created_at when missing from frontmatter', () => {
        const md     = '---\nname: test\n---\nbody';
        const result = _injectCreatedAt(md, '2026-03-21T10:00:00.000Z');
        expect(result).toContain('created_at: "2026-03-21T10:00:00.000Z"');
    });

    it('does not modify non-frontmatter markdown', () => {
        const md = '# No frontmatter\n\nJust body.';
        const result = _injectCreatedAt(md, '2026-03-21T10:00:00.000Z');
        expect(result).toBe(md); // unchanged
    });

    it('does not false-positive on HR separator in skill body', () => {
        const md = '---\nname: test\ncreated_at: 2025-01-01T00:00:00.000Z\n---\n# test\n\nBody text.\n\n---\n\nMore content.';
        const result = _injectCreatedAt(md, '2026-03-21T10:00:00.000Z');
        expect(result).toContain('created_at: "2026-03-21T10:00:00.000Z"');
        expect(result).not.toContain('2025-01-01T00:00:00.000Z');
        expect(result).toContain('\n\n---\n\nMore content.');
    });
});

describe('_bumpVersion', () => {
    it('bumps version by 1 from integer string', () => {
        const md     = '---\nname: test\nversion: 2\n---\nbody';
        const result = _bumpVersion(md);
        expect(result).toContain('version: 3');
    });

    it('sets version to 1 when missing', () => {
        const md     = '---\nname: test\n---\nbody';
        const result = _bumpVersion(md);
        expect(result).toContain('version: 1');
    });

    it('sets version to 1 when non-numeric', () => {
        const md     = '---\nname: test\nversion: abc\n---\nbody';
        const result = _bumpVersion(md);
        expect(result).toContain('version: 1');
    });

    it('parses string "2" correctly and bumps to 3', () => {
        const md     = '---\nname: test\nversion: 2\n---\nbody';
        const result = _bumpVersion(md);
        expect(result).toContain('version: 3');
    });

    it('does not modify non-frontmatter markdown', () => {
        const md = '# No frontmatter\n\nbody text.';
        const result = _bumpVersion(md);
        expect(result).toBe(md);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// REVIEW_RUBRIC export
// ─────────────────────────────────────────────────────────────────────────────

describe('REVIEW_RUBRIC', () => {
    it('has exactly 7 entries', () => {
        expect(REVIEW_RUBRIC).toHaveLength(7);
    });

    it('totals 100 points', () => {
        const total = REVIEW_RUBRIC.reduce((s, r) => s + r.max, 0);
        expect(total).toBe(100);
    });

    it('has correct max values', () => {
        const byName = Object.fromEntries(REVIEW_RUBRIC.map(r => [r.name, r.max]));
        expect(byName['Trigger Accuracy']).toBe(20);
        expect(byName['Instruction Precision']).toBe(20);
        expect(byName['Output Specificity']).toBe(15);
        expect(byName['Hard Rule Quality']).toBe(15);
        expect(byName['Example Request Coverage']).toBe(10);
        expect(byName['Edge Case Utility']).toBe(10);
        expect(byName['Readability & Frontmatter']).toBe(10);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Format detection — _isRichFormat
// ─────────────────────────────────────────────────────────────────────────────

describe('_isRichFormat', () => {
    it('detects rich format by **Hard rules:** marker', () => {
        expect(_isRichFormat('## Class Designer\n**Hard rules:**\n- ALWAYS do x')).toBe(true);
    });

    it('detects rich format by ## Persona heading', () => {
        expect(_isRichFormat('## Persona\nSenior architect.')).toBe(true);
    });

    it('returns false for flat format skill', () => {
        expect(_isRichFormat('## Hard rules\n- ALWAYS do x\n## Instructions\n1. Step')).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildSkillReviewPrompt — format branching
// ─────────────────────────────────────────────────────────────────────────────

describe('buildSkillReviewPrompt — rich format', () => {
    const richSkill = `---
name: "test"
description: "test"
version: 1
framework: claude
created_at: 2026-01-01T00:00:00.000Z
---
# test
## Persona
Senior architect.
## Class Designer
**Hard rules:**
- ALWAYS declare virtual destructors`;

    it('identifies the skill as rich format in the system prompt', () => {
        const { system } = buildSkillReviewPrompt(richSkill);
        expect(system).toContain('rich specialist format');
    });

    it('uses specialist-aware rubric for Instruction Precision', () => {
        const { system } = buildSkillReviewPrompt(richSkill);
        expect(system).toMatch(/specialist section|per-specialist/i);
    });

    it('does not reference flat-format Instructions section in rich prompt', () => {
        const { system } = buildSkillReviewPrompt(richSkill);
        expect(system).not.toMatch(/Steps numbered, sequential, unambiguous/);
    });

    it('still outputs the same 7 category names', () => {
        const { system } = buildSkillReviewPrompt(richSkill);
        expect(system).toContain('"Trigger Accuracy"');
        expect(system).toContain('"Instruction Precision"');
        expect(system).toContain('"Hard Rule Quality"');
        expect(system).toContain('"Readability & Frontmatter"');
    });
});

describe('buildSkillReviewPrompt — flat format', () => {
    const flatSkill = `---
name: "test"
description: "test"
version: 1
framework: claude
created_at: 2026-01-01T00:00:00.000Z
---
# test
## Instructions
1. Step one
## Hard rules
- ALWAYS do x`;

    it('identifies the skill as flat format in the system prompt', () => {
        const { system } = buildSkillReviewPrompt(flatSkill);
        expect(system).toContain('flat canonical format');
    });

    it('uses instruction-aware rubric for Instruction Precision', () => {
        const { system } = buildSkillReviewPrompt(flatSkill);
        expect(system).toMatch(/Steps numbered|sequential/i);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildSkillFixPrompt — format preservation
// ─────────────────────────────────────────────────────────────────────────────

describe('buildSkillFixPrompt — rich format', () => {
    const richSkill = `---
name: "test"
framework: claude
---
## Persona
Architect.
## Class Designer
**Hard rules:**
- ALWAYS use virtual destructors`;

    it('instructs model to preserve rich format', () => {
        const { system } = buildSkillFixPrompt(richSkill, ['Improve hard rules'], []);
        expect(system).toContain('rich specialist format');
        expect(system).toMatch(/do NOT rewrite as a flat skill|preserve the rich/i);
    });

    it('does not include flat canonical schema in rich fix prompt', () => {
        const { system } = buildSkillFixPrompt(richSkill, ['Improve hard rules'], []);
        expect(system).not.toContain('## Instructions');
        expect(system).not.toContain('## Edge cases');
    });
});

describe('buildSkillFixPrompt — flat format', () => {
    const flatSkill = `---
name: "test"
framework: claude
---
## Instructions
1. Do x
## Hard rules
- ALWAYS do x`;

    it('instructs model to preserve flat format', () => {
        const { system } = buildSkillFixPrompt(flatSkill, ['Add edge cases'], []);
        expect(system).toContain('flat canonical format');
        expect(system).toMatch(/do NOT convert to specialist|preserve the flat/i);
    });

    it('includes flat schema requirements in flat fix prompt', () => {
        const { system } = buildSkillFixPrompt(flatSkill, ['Add edge cases'], []);
        expect(system).toContain('Edge cases');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildSkillFixPrompt — non-regression and breakdown split
// ─────────────────────────────────────────────────────────────────────────────

describe('buildSkillFixPrompt — non-regression and breakdown split', () => {
    const flatSkill = `---
name: "test"
framework: claude
---
## Instructions
1. Do x
## Hard rules
- ALWAYS do x`;

    const breakdown = [
        { name: 'Trigger Accuracy',         score: 20, max: 20, issues: [],               verdict: 'Perfect' },
        { name: 'Instruction Precision',     score: 12, max: 20, issues: ['Too vague'],    verdict: 'Weak' },
        { name: 'Output Specificity',        score: 15, max: 15, issues: [],               verdict: 'Perfect' },
        { name: 'Hard Rule Quality',         score:  8, max: 15, issues: ['Not specific'], verdict: 'Needs work' },
        { name: 'Example Request Coverage',  score: 10, max: 10, issues: [],               verdict: 'Perfect' },
        { name: 'Edge Case Utility',         score:  5, max: 10, issues: ['Too generic'],  verdict: 'Weak' },
        { name: 'Readability & Frontmatter', score:  8, max: 10, issues: ['Minor issues'], verdict: 'Good' },
    ];

    it('includes a non-regression rule in the system prompt', () => {
        const { system } = buildSkillFixPrompt(flatSkill, ['Add edge cases'], breakdown);
        expect(system).toMatch(/must not regress|do not regress/i);
        expect(system).toMatch(/must be ≥ its current score|≥ its current/i);
    });

    it('marks already-perfect categories as DO NOT DEGRADE in user message', () => {
        const { user } = buildSkillFixPrompt(flatSkill, ['Add edge cases'], breakdown);
        expect(user).toContain('DO NOT DEGRADE');
        expect(user).toMatch(/Trigger Accuracy.*DO NOT DEGRADE/s);
        expect(user).toMatch(/Output Specificity.*DO NOT DEGRADE/s);
        expect(user).toMatch(/Example Request Coverage.*DO NOT DEGRADE/s);
    });

    it('marks deficient categories as FIX in user message', () => {
        const { user } = buildSkillFixPrompt(flatSkill, ['Add edge cases'], breakdown);
        expect(user).toContain('FIX these');
        expect(user).toContain('Instruction Precision');
        expect(user).toContain('Hard Rule Quality');
        expect(user).toContain('Edge Case Utility');
    });

    it('reminds model not to degrade at end of user message', () => {
        const { user } = buildSkillFixPrompt(flatSkill, ['Add edge cases'], breakdown);
        expect(user).toMatch(/do not degrade any category/i);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// _stripMarkdownFences
// ─────────────────────────────────────────────────────────────────────────────

describe('_stripMarkdownFences', () => {
    const inner = '---\nname: test\n---\n# test\n## Hard rules\n- ALWAYS do x';

    it('strips ```markdown ... ``` fences', () => {
        expect(_stripMarkdownFences('```markdown\n' + inner + '\n```')).toBe(inner);
    });

    it('strips ```md ... ``` fences', () => {
        expect(_stripMarkdownFences('```md\n' + inner + '\n```')).toBe(inner);
    });

    it('strips plain ``` ... ``` fences', () => {
        expect(_stripMarkdownFences('```\n' + inner + '\n```')).toBe(inner);
    });

    it('returns raw content unchanged when no fences present', () => {
        expect(_stripMarkdownFences(inner)).toBe(inner);
    });

    it('strips opening fence even when closing fence is missing', () => {
        const result = _stripMarkdownFences('```markdown\n' + inner);
        expect(result).toBe(inner);
    });

    it('trims surrounding whitespace', () => {
        expect(_stripMarkdownFences('  \n```markdown\n' + inner + '\n```\n  ')).toBe(inner);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// _restoreFrontmatterName
// ─────────────────────────────────────────────────────────────────────────────

describe('_restoreFrontmatterName', () => {
    it('restores hyphenated name lost by model (unquoted)', () => {
        const original  = '---\nname: app-expert\n---\n# app-expert';
        const processed = '---\nname: app expert\n---\n# app expert';
        expect(_restoreFrontmatterName(processed, original)).toMatch(/^name: app-expert$/m);
    });

    it('restores H1 heading when model mutates it', () => {
        const original  = '---\nname: app-expert\n---\n\n# app-expert\n\nPurpose.';
        const processed = '---\nname: app expert\n---\n\n# app expert\n\nImproved purpose.';
        const result = _restoreFrontmatterName(processed, original);
        expect(result).toMatch(/^name: app-expert$/m);
        expect(result).toMatch(/^# app-expert$/m);
    });

    it('restores hyphenated name when original is quoted', () => {
        const original  = '---\nname: "app-expert"\n---\n';
        const processed = '---\nname: app expert\n---\n';
        expect(_restoreFrontmatterName(processed, original)).toMatch(/^name: app-expert$/m);
    });

    it('does not touch H1 if it already uses the correct name', () => {
        const original  = '---\nname: app-expert\n---\n\n# app-expert\n';
        const processed = '---\nname: app expert\n---\n\n# app-expert\n';
        const result = _restoreFrontmatterName(processed, original);
        expect(result).toMatch(/^name: app-expert$/m);
        expect(result).toMatch(/^# app-expert$/m);
    });

    it('leaves name unchanged when model preserved it correctly', () => {
        const original  = '---\nname: app-expert\n---\n';
        const processed = '---\nname: app-expert\n---\n';
        expect(_restoreFrontmatterName(processed, original)).toMatch(/^name: app-expert$/m);
    });

    it('returns processed unchanged when original has no name field', () => {
        const original  = '---\ndescription: test\n---\n';
        const processed = '---\nname: something\n---\n';
        expect(_restoreFrontmatterName(processed, original)).toBe(processed);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// _quoteFrontmatterValue
// ─────────────────────────────────────────────────────────────────────────────

describe('_quoteFrontmatterValue', () => {
    it('leaves simple scalar unquoted', () => {
        expect(_quoteFrontmatterValue('app-expert')).toBe('app-expert');
        expect(_quoteFrontmatterValue('claude')).toBe('claude');
        expect(_quoteFrontmatterValue('1')).toBe('1');
        expect(_quoteFrontmatterValue('v1.0')).toBe('v1.0');
    });

    it('quotes ISO timestamps (contain colon)', () => {
        expect(_quoteFrontmatterValue('2026-03-21T10:00:00.000Z')).toBe('"2026-03-21T10:00:00.000Z"');
    });

    it('quotes strings with spaces', () => {
        expect(_quoteFrontmatterValue('my skill with spaces')).toBe('"my skill with spaces"');
    });

    it('quotes strings with YAML-special characters', () => {
        expect(_quoteFrontmatterValue('name: value')).toBe('"name: value"');
        expect(_quoteFrontmatterValue('{inline}')).toBe('"{inline}"');
        expect(_quoteFrontmatterValue('[array]')).toBe('"[array]"');
    });

    it('escapes internal double-quotes', () => {
        expect(_quoteFrontmatterValue('say "hello"')).toBe('"say \\"hello\\""');
    });

    it('escapes internal backslashes', () => {
        expect(_quoteFrontmatterValue('path\\to\\file')).toBe('"path\\\\to\\\\file"');
    });

    it('does not double-quote a value that is already simple', () => {
        const v = _quoteFrontmatterValue('simple');
        expect(v).toBe('simple');
        expect(v).not.toContain('"');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 20k truncation in prompt builders
// ─────────────────────────────────────────────────────────────────────────────

describe('buildSkillReviewPrompt — 20k truncation', () => {
    it('does not truncate content within the limit', () => {
        const short = '---\nname: test\n---\nBody.';
        const { user } = buildSkillReviewPrompt(short);
        expect(user).toContain('Body.');
        expect(user).not.toContain('truncated');
    });

    it('truncates content exceeding MAX_REVIEW_INPUT_CHARS and appends notice', () => {
        const long = '---\nname: test\n---\n' + 'x'.repeat(MAX_REVIEW_INPUT_CHARS);
        const { user } = buildSkillReviewPrompt(long);
        expect(user).toContain('[Body truncated for analysis');
        // Verify the sentinel x beyond the boundary is absent
        const sentinel = 'x'.repeat(MAX_REVIEW_INPUT_CHARS + 1);
        expect(user).not.toContain(sentinel);
    });

    it('uses MAX_REVIEW_INPUT_CHARS as the cut-off boundary', () => {
        const content = 'A'.repeat(MAX_REVIEW_INPUT_CHARS + 1);
        const { user } = buildSkillReviewPrompt(content);
        expect(user).toContain('[Body truncated for analysis');
    });
});

describe('buildSkillFixPrompt — 20k truncation', () => {
    it('truncates content exceeding MAX_REVIEW_INPUT_CHARS in fix prompt', () => {
        const long = '---\nname: test\n---\n' + 'y'.repeat(MAX_REVIEW_INPUT_CHARS);
        const { user } = buildSkillFixPrompt(long, ['Fix something'], []);
        expect(user).toContain('[Body truncated for analysis');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cost display formatting
// ─────────────────────────────────────────────────────────────────────────────

describe('cost display _formatCost (inline helper)', () => {
    // Mirror of the _formatCost helper in src/views/review.js
    function _formatCost(cost) {
        if (typeof cost !== 'number' || isNaN(cost)) return null;
        if (cost < 0.0001) return '< $0.0001';
        return '$' + cost.toFixed(4);
    }

    it('uses toFixed(4) for costs >= 0.0001', () => {
        expect(_formatCost(0.0008)).toBe('$0.0008');
        expect(_formatCost(0.1234)).toBe('$0.1234');
        expect(_formatCost(0.0033)).toBe('$0.0033');
    });

    it('returns "< $0.0001" for very small costs', () => {
        expect(_formatCost(0.00001)).toBe('< $0.0001');
        expect(_formatCost(1e-7)).toBe('< $0.0001');
    });

    it('returns null for non-numeric input', () => {
        expect(_formatCost(null)).toBeNull();
        expect(_formatCost(undefined)).toBeNull();
        expect(_formatCost(NaN)).toBeNull();
    });

    it('does not produce scientific notation', () => {
        expect(_formatCost(0.000001)).not.toMatch(/e/i);
        expect(_formatCost(0.0001)).not.toMatch(/e/i);
    });

    it('handles zero correctly', () => {
        expect(_formatCost(0)).toBe('< $0.0001');
    });
});
