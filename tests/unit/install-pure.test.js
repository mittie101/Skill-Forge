'use strict';

jest.mock('electron');

const {
    _makeSafeName,
    _parseFrontmatter,
    _extractSection,
    _buildInstallContent,
} = require('../../ipc/install');

// ── _makeSafeName ─────────────────────────────────────────────────────────────

describe('_makeSafeName', () => {
    it('returns a simple name unchanged (alphanumeric + hyphen)', () => {
        expect(_makeSafeName('my-skill')).toBe('my-skill');
    });

    it('allows underscores', () => {
        expect(_makeSafeName('my_skill')).toBe('my_skill');
    });

    it('replaces spaces with hyphens', () => {
        expect(_makeSafeName('my skill')).toBe('my-skill');
    });

    it('replaces special characters with hyphens and trims trailing hyphen', () => {
        // '!' becomes '-', then trailing '-' is trimmed
        expect(_makeSafeName('my@skill!')).toBe('my-skill');
    });

    it('collapses multiple hyphens into one', () => {
        expect(_makeSafeName('my---skill')).toBe('my-skill');
    });

    it('trims leading hyphens', () => {
        expect(_makeSafeName('---skill')).toBe('skill');
    });

    it('trims trailing hyphens', () => {
        expect(_makeSafeName('skill---')).toBe('skill');
    });

    it('handles null input', () => {
        const result = _makeSafeName(null);
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
    });

    it('handles undefined input', () => {
        const result = _makeSafeName(undefined);
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
    });

    it('handles empty string — returns "skill" fallback', () => {
        expect(_makeSafeName('')).toBe('skill');
    });

    it('handles all-special input — returns "skill" fallback', () => {
        expect(_makeSafeName('@@@')).toBe('skill');
    });

    it('rejects Windows reserved name CON — appends -skill', () => {
        expect(_makeSafeName('CON')).toBe('CON-skill');
    });

    it('rejects Windows reserved name NUL — appends -skill', () => {
        expect(_makeSafeName('NUL')).toBe('NUL-skill');
    });

    it('rejects Windows reserved name COM1 — appends -skill', () => {
        expect(_makeSafeName('COM1')).toBe('COM1-skill');
    });

    it('rejects Windows reserved name LPT9 — appends -skill', () => {
        expect(_makeSafeName('LPT9')).toBe('LPT9-skill');
    });

    it('does NOT treat non-reserved names as reserved', () => {
        expect(_makeSafeName('CONSOLE')).toBe('CONSOLE');
        expect(_makeSafeName('readme')).toBe('readme');
    });

    it('preserves mixed-case (unlike slug.js which lowercases)', () => {
        expect(_makeSafeName('MySkill')).toBe('MySkill');
    });
});

// ── _parseFrontmatter ─────────────────────────────────────────────────────────

describe('_parseFrontmatter', () => {
    it('parses basic frontmatter', () => {
        const md = '---\nname: test-skill\ndescription: A test\n---\n\nBody here.';
        const { meta, body } = _parseFrontmatter(md);
        expect(meta.name).toBe('test-skill');
        expect(meta.description).toBe('A test');
        expect(body.trim()).toBe('Body here.');
    });

    it('returns empty meta if no frontmatter', () => {
        const md = 'Just a body with no frontmatter.';
        const { meta, body } = _parseFrontmatter(md);
        expect(meta).toEqual({});
        expect(body).toBe(md);
    });

    it('returns empty meta if frontmatter not closed', () => {
        const md = '---\nname: test\n\nBody without closing.';
        const { meta, body } = _parseFrontmatter(md);
        expect(meta).toEqual({});
        expect(body).toBe(md);
    });

    it('strips quotes from values', () => {
        const md = '---\nname: "quoted name"\ndescription: \'single quotes\'\n---\n';
        const { meta } = _parseFrontmatter(md);
        expect(meta.name).toBe('quoted name');
        expect(meta.description).toBe('single quotes');
    });

    it('handles colons in values', () => {
        const md = '---\ndescription: Use for: thing\n---\n';
        const { meta } = _parseFrontmatter(md);
        expect(meta.description).toBe('Use for: thing');
    });

    it('returns body after closing ---', () => {
        const md = '---\nname: foo\n---\n\n## Section\n\nContent.';
        const { body } = _parseFrontmatter(md);
        expect(body).toContain('## Section');
        expect(body).toContain('Content.');
    });

    it('ignores malformed lines (no colon)', () => {
        const md = '---\nname: test\nno-colon-here\n---\nBody.';
        const { meta } = _parseFrontmatter(md);
        expect(meta.name).toBe('test');
        expect(meta['no-colon-here']).toBeUndefined();
    });
});

// ── _extractSection ───────────────────────────────────────────────────────────

describe('_extractSection', () => {
    const body = `
## When to Use

Use this skill to do X.

## Instructions

Step 1. Do this.
Step 2. Do that.

## Expected Outputs

A well-formed result.

## Hard Rules

Never do Y.
    `.trim();

    it('extracts "When to Use" section', () => {
        const result = _extractSection(body, 'When to Use');
        expect(result).toContain('Use this skill to do X.');
    });

    it('extracts "Instructions" section', () => {
        const result = _extractSection(body, 'Instructions');
        expect(result).toContain('Step 1. Do this.');
        expect(result).toContain('Step 2. Do that.');
    });

    it('extracts "Hard Rules" section (last section — no trailing ##)', () => {
        const result = _extractSection(body, 'Hard Rules');
        expect(result).toContain('Never do Y.');
    });

    it('is case-insensitive', () => {
        const lower = _extractSection(body, 'when to use');
        const upper = _extractSection(body, 'WHEN TO USE');
        expect(lower).toBe(upper);
        expect(lower.length).toBeGreaterThan(0);
    });

    it('returns empty string for missing section', () => {
        expect(_extractSection(body, 'Edge Cases')).toBe('');
        expect(_extractSection(body, 'Nonexistent')).toBe('');
    });

    it('does not bleed into the next section', () => {
        const result = _extractSection(body, 'Instructions');
        expect(result).not.toContain('A well-formed result.');
    });

    it('returns empty string on empty body', () => {
        expect(_extractSection('', 'When to Use')).toBe('');
    });
});

// ── _buildInstallContent ──────────────────────────────────────────────────────

describe('_buildInstallContent', () => {
    const meta = { name: 'my-skill', description: 'Does something useful.' };
    const body = `
## When to Use

When you need to do X.

## Instructions

Follow these steps.

## Expected Outputs

A markdown file.

## Hard Rules

Never skip validation.

## Edge Cases

Handle empty input.
    `.trim();

    describe('skill mode (modeSkill = true)', () => {
        it('includes YAML frontmatter with name', () => {
            const out = _buildInstallContent(meta, body, true);
            expect(out).toMatch(/^---\n/);
            expect(out).toContain('name: my-skill');
        });

        it('includes description in frontmatter', () => {
            const out = _buildInstallContent(meta, body, true);
            expect(out).toContain('description: Does something useful.');
        });

        it('includes all extracted sections', () => {
            const out = _buildInstallContent(meta, body, true);
            expect(out).toContain('When you need to do X.');
            expect(out).toContain('Follow these steps.');
            expect(out).toContain('A markdown file.');
            expect(out).toContain('Never skip validation.');
            expect(out).toContain('Handle empty input.');
        });

        it('ends with ## Task and $ARGUMENTS', () => {
            const out = _buildInstallContent(meta, body, true);
            expect(out).toMatch(/## Task\s*\n\n\$ARGUMENTS\s*$/);
        });
    });

    describe('command mode (modeSkill = false)', () => {
        it('does NOT include YAML frontmatter', () => {
            const out = _buildInstallContent(meta, body, false);
            expect(out).not.toMatch(/^---\n/);
            expect(out).not.toContain('name:');
        });

        it('still includes description text', () => {
            const out = _buildInstallContent(meta, body, false);
            expect(out).toContain('Does something useful.');
        });

        it('ends with ## Task and $ARGUMENTS', () => {
            const out = _buildInstallContent(meta, body, false);
            expect(out).toMatch(/## Task\s*\n\n\$ARGUMENTS\s*$/);
        });
    });

    describe('edge cases', () => {
        it('omits sections that are absent from body', () => {
            const sparseBody = '## Instructions\n\nJust do it.';
            const out = _buildInstallContent(meta, sparseBody, false);
            expect(out).not.toContain('## When to Use');
            expect(out).not.toContain('## Expected Outputs');
            expect(out).toContain('## Instructions');
        });

        it('omits description block when meta has no description', () => {
            const out = _buildInstallContent({ name: 'no-desc' }, body, false);
            expect(out).not.toContain('Does something useful.');
        });

        it('handles empty meta gracefully', () => {
            expect(() => _buildInstallContent({}, body, true)).not.toThrow();
        });

        it('always includes ## Task section', () => {
            const out = _buildInstallContent({}, '', false);
            expect(out).toContain('## Task');
            expect(out).toContain('$ARGUMENTS');
        });
    });
});
