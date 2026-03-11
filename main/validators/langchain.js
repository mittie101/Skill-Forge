'use strict';

/**
 * Layer 4 — LangChain framework-specific validation.
 * Checks that the rendered markdown contains required LangChain markers.
 *
 * Required:
 *   - At least one {variable} placeholder in curly braces
 *
 * @param {string} markdown  Rendered markdown from renderLangChain()
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateLangChainOutput(markdown) {
    const errors = [];

    if (typeof markdown !== 'string' || !markdown.trim()) {
        return { valid: false, errors: ['Rendered output is empty'] };
    }

    // Must contain at least one {variable} placeholder
    if (!(/\{[a-z_][a-z0-9_]*\}/i.test(markdown))) {
        errors.push('Missing {variable} placeholder required for LangChain template');
    }

    return { valid: errors.length === 0, errors };
}

module.exports = { validateLangChainOutput };
