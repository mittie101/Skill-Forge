'use strict';

/**
 * Layer 4 — ChatGPT framework-specific validation.
 * Checks that the rendered markdown contains required ChatGPT markers.
 *
 * Required:
 *   - A "# Role" section
 *   - A "# Rules" section
 *
 * @param {string} markdown  Rendered markdown from renderChatGPT()
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateChatGPTOutput(markdown) {
    const errors = [];

    if (typeof markdown !== 'string' || !markdown.trim()) {
        return { valid: false, errors: ['Rendered output is empty'] };
    }

    // Case-insensitive heading checks
    if (!/^#\s+role\s*$/im.test(markdown)) {
        errors.push('Missing "# Role" section');
    }

    if (!/^#\s+rules\s*$/im.test(markdown)) {
        errors.push('Missing "# Rules" section');
    }

    return { valid: errors.length === 0, errors };
}

module.exports = { validateChatGPTOutput };
