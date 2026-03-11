'use strict';

/**
 * Layer 4 — Claude framework-specific validation.
 * Checks that the rendered markdown contains required Claude markers.
 *
 * Required: YAML frontmatter block (--- delimiters with framework: claude inside)
 *
 * @param {string} markdown  Rendered markdown from renderClaude()
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateClaudeOutput(markdown) {
    const errors = [];

    if (typeof markdown !== 'string' || !markdown.trim()) {
        return { valid: false, errors: ['Rendered output is empty'] };
    }

    // Must start with --- frontmatter
    if (!markdown.trimStart().startsWith('---')) {
        errors.push('Missing YAML frontmatter (--- delimiter)');
    } else {
        // Find closing ---
        const afterOpen = markdown.indexOf('---') + 3;
        const closeIdx = markdown.indexOf('---', afterOpen);
        if (closeIdx === -1) {
            errors.push('Frontmatter block is not closed (missing closing ---)');
        } else {
            const frontmatter = markdown.slice(afterOpen, closeIdx);
            if (!frontmatter.includes('framework: claude')) {
                errors.push('Frontmatter missing "framework: claude"');
            }
            if (!frontmatter.includes('name:')) {
                errors.push('Frontmatter missing "name:" field');
            }
        }
    }

    return { valid: errors.length === 0, errors };
}

module.exports = { validateClaudeOutput };
