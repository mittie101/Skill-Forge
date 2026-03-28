'use strict';

const { parseFrontmatter: _parseFrontmatterShared } = require('../frontmatter');

// ── Canonical section headers for flat-format skills ──
const CANONICAL_SECTIONS = [
    'When to use',
    'Example requests',
    'Expected inputs',
    'Expected outputs',
    'Instructions',
    'Hard rules',
    'Edge cases',
];

// ── Required sections for rich-format skills ──
const RICH_REQUIRED_SECTIONS = [
    'When to use',
    'Example requests',
    'Expected inputs',
    'Expected outputs',
];

/**
 * Detect whether a skill markdown file uses the rich specialist format.
 * Rich format is identified by the presence of specialist-rendered subsection
 * labels or a Persona section — both are only emitted by the rich renderer.
 */
function _isRichFormat(markdown) {
    return /\*\*Hard rules:\*\*/m.test(markdown) || /^## Persona\s*$/m.test(markdown);
}

/**
 * Parse YAML-like frontmatter from a markdown string.
 * Returns { meta: object, body: string, found: boolean }
 * Delegates to the shared parseFrontmatter in main/frontmatter.js and adds `found` flag.
 */
function _parseFrontmatter(markdown) {
    const hasFrontmatter = markdown.startsWith('---') && markdown.indexOf('\n---', 3) !== -1;
    const { meta, body } = _parseFrontmatterShared(markdown);
    return { meta, body, found: hasFrontmatter };
}

/**
 * Count list items under a ## Section heading in body.
 * Returns the count of lines starting with - or a digit+dot.
 */
function _countSectionItems(body, heading) {
    const lower = body.toLowerCase();
    const pat   = `## ${heading.toLowerCase()}`;
    const idx   = lower.indexOf(pat);
    if (idx === -1) return -1; // section not found

    const start = body.indexOf('\n', idx);
    if (start === -1) return 0;
    const nextSection = lower.indexOf('\n## ', start + 1);
    const sectionBody = nextSection === -1
        ? body.slice(start + 1)
        : body.slice(start + 1, nextSection);

    return sectionBody
        .split('\n')
        .filter(l => /^\s*[-*]\s+\S/.test(l) || /^\s*\d+\.\s+\S/.test(l))
        .length;
}

/**
 * Get the lines under a ## Section heading.
 */
function _getSectionLines(body, heading) {
    const lower = body.toLowerCase();
    const pat   = `## ${heading.toLowerCase()}`;
    const idx   = lower.indexOf(pat);
    if (idx === -1) return [];

    const start = body.indexOf('\n', idx);
    if (start === -1) return [];
    const nextSection = lower.indexOf('\n## ', start + 1);
    const sectionBody = nextSection === -1
        ? body.slice(start + 1)
        : body.slice(start + 1, nextSection);

    return sectionBody.split('\n');
}

/**
 * Get all ## headings in order from the body.
 */
function _getHeadingsInOrder(body) {
    return body
        .split('\n')
        .filter(l => /^## /.test(l))
        .map(l => l.slice(3).trim());
}

/**
 * Count specialist sections in a rich-format skill.
 * A specialist section is any ## heading that is not in RICH_REQUIRED_SECTIONS
 * and not Persona, Decision Points, Output Format, or Constraints.
 */
function _countSpecialistSections(body) {
    const reserved = new Set([
        ...RICH_REQUIRED_SECTIONS.map(s => s.toLowerCase()),
        'persona', 'decision points', 'output format', 'constraints',
    ]);
    return _getHeadingsInOrder(body)
        .filter(h => !reserved.has(h.toLowerCase()))
        .length;
}

/**
 * Count **Hard rules:** blocks in a rich-format skill body.
 */
function _countRichHardRuleBlocks(body) {
    return (body.match(/\*\*Hard rules:\*\*/gm) ?? []).length;
}

/**
 * Validate a rich-format specialist skill against the rich schema.
 */
function _validateRichFormat(body, meta, errors) {
    // Required sections must be present
    for (const required of RICH_REQUIRED_SECTIONS) {
        const present = _getHeadingsInOrder(body)
            .some(h => h.toLowerCase() === required.toLowerCase());
        if (!present) {
            errors.push(`Missing required section: ## ${required}`);
        }
    }

    // Example requests ≥ 5
    const exampleCount = _countSectionItems(body, 'Example requests');
    if (exampleCount !== -1 && exampleCount < 5) {
        errors.push(`## Example requests must have at least 5 items (found ${exampleCount})`);
    }

    // At least 1 specialist section
    const specialistCount = _countSpecialistSections(body);
    if (specialistCount < 1) {
        errors.push('Rich-format skill must have at least one specialist section');
    }

    // At least 1 **Hard rules:** block
    const hardRuleBlocks = _countRichHardRuleBlocks(body);
    if (hardRuleBlocks < 1) {
        errors.push('Rich-format skill must have at least one **Hard rules:** subsection');
    }

    // Each **Hard rules:** block should have ALWAYS/NEVER items
    const chunks = body.split(/\*\*Hard rules:\*\*/);
    for (let i = 1; i < chunks.length; i++) {
        const chunk = chunks[i];
        const nextLabel = chunk.search(/\*\*[A-Z]|\n## /);
        const section = nextLabel === -1 ? chunk : chunk.slice(0, nextLabel);
        const items = section.split('\n').filter(l => /^\s*-\s+\S/.test(l));
        for (const line of items) {
            const content = line.replace(/^\s*-\s*/, '').trim();
            if (!/^(ALWAYS|NEVER)\b/i.test(content)) {
                errors.push(`Hard rule must begin with ALWAYS or NEVER: "${content.slice(0, 60)}"`);
            }
        }
    }
}

/**
 * Validate a skill markdown file against the canonical schema.
 * Detects format automatically and applies the appropriate validation branch.
 *
 * @param {string} markdown
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateCanonicalSkillStructure(markdown) {
    const errors = [];

    if (typeof markdown !== 'string' || !markdown.trim()) {
        return { valid: false, errors: ['Content is empty or not a string'] };
    }

    // ── 1. Frontmatter ──
    const { meta, body, found } = _parseFrontmatter(markdown);
    if (!found) {
        errors.push('Missing YAML frontmatter (file must start with ---)');
        return { valid: false, errors };
    }

    // ── 2. Required frontmatter fields ──
    const name = (meta['name'] ?? '').trim();
    if (!name) errors.push('Frontmatter missing required field: name');

    const desc = (meta['description'] ?? '').trim();
    if (desc.length > 280) {
        errors.push(`Frontmatter description exceeds 280 characters (${desc.length})`);
    }

    // ── 3. version ──
    const rawVersion = meta['version'];
    if (rawVersion === undefined || rawVersion === null || rawVersion === '') {
        errors.push('Frontmatter missing required field: version');
    } else {
        const v = parseInt(rawVersion, 10);
        if (isNaN(v) || v < 1) {
            errors.push(`Frontmatter version must be a positive integer (got: "${rawVersion}")`);
        }
    }

    // ── 4. created_at ──
    const createdAt = (meta['created_at'] ?? '').trim();
    if (!createdAt) {
        errors.push('Frontmatter missing required field: created_at');
    } else {
        const d = new Date(createdAt);
        if (isNaN(d.getTime()) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(createdAt)) {
            errors.push(`Frontmatter created_at is not a valid ISO 8601 datetime (got: "${createdAt}")`);
        }
    }

    // ── 5. Title ──
    const titleMatch = body.match(/^#\s+(.+)/m);
    if (!titleMatch) {
        errors.push('Missing top-level title (# Skill Name)');
    } else {
        const titleText = titleMatch[1].trim();
        if (name && titleText.toLowerCase() !== name.toLowerCase()) {
            errors.push(`Title "# ${titleText}" does not match frontmatter name "${name}"`);
        }
    }

    // ── 6. Format-specific validation ──
    if (_isRichFormat(markdown)) {
        _validateRichFormat(body, meta, errors);
    } else {
        // ── Flat format: existing canonical checks ──
        const headings = _getHeadingsInOrder(body);

        for (const required of CANONICAL_SECTIONS) {
            const present = headings.some(h => h.toLowerCase() === required.toLowerCase());
            if (!present) errors.push(`Missing required section: ## ${required}`);
        }

        // Check canonical order
        const presentCanonical = CANONICAL_SECTIONS.filter(s =>
            headings.some(h => h.toLowerCase() === s.toLowerCase())
        );
        const presentInDoc = headings.filter(h =>
            CANONICAL_SECTIONS.some(s => s.toLowerCase() === h.toLowerCase())
        );
        for (let i = 0; i < presentCanonical.length; i++) {
            if (!presentInDoc[i] || presentInDoc[i].toLowerCase() !== presentCanonical[i].toLowerCase()) {
                errors.push(
                    `Sections are out of canonical order. Expected "## ${presentCanonical[i]}" at position ${i + 1}`
                );
                break;
            }
        }

        const exampleCount = _countSectionItems(body, 'Example requests');
        if (exampleCount !== -1 && exampleCount < 5) {
            errors.push(`## Example requests must have at least 5 items (found ${exampleCount})`);
        }

        const hardRuleLines = _getSectionLines(body, 'Hard rules')
            .filter(l => /^\s*[-*]\s+\S/.test(l) || /^\s*\d+\.\s+\S/.test(l));
        if (_countSectionItems(body, 'Hard rules') !== -1) {
            if (hardRuleLines.length < 3) {
                errors.push(`## Hard rules must have at least 3 items (found ${hardRuleLines.length})`);
            }
            for (const line of hardRuleLines) {
                const content = line.replace(/^\s*[-*\d.]+\s*/, '').trim();
                if (!/^(ALWAYS|NEVER)\b/i.test(content)) {
                    errors.push(`Hard rule must begin with ALWAYS or NEVER: "${content.slice(0, 60)}"`);
                }
            }
        }

        const edgeCount = _countSectionItems(body, 'Edge cases');
        if (edgeCount !== -1 && edgeCount < 3) {
            errors.push(`## Edge cases must have at least 3 items (found ${edgeCount})`);
        }
    }

    return { valid: errors.length === 0, errors };
}

module.exports = {
    validateCanonicalSkillStructure,
    CANONICAL_SECTIONS,
    _isRichFormat,          // exported for use in prompts.js
};
