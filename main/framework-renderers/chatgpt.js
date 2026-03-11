'use strict';

/**
 * Render JSON intermediate → ChatGPT instructions.md
 *
 * Required markers (validated by validators/chatgpt.js):
 *   - A "# Role" section
 *   - A "# Rules" section
 *
 * @param {object} json  Validated JSON intermediate
 * @returns {string}     Markdown content
 */
function renderChatGPT(json) {
    const lines = [];

    // ── Title ──
    lines.push(`# ${json.name}`);
    lines.push('');

    // ── Role ──
    lines.push('# Role');
    lines.push('');
    lines.push(`You are an expert assistant specialised in: ${json.description}`);
    lines.push('');
    lines.push(json.when_to_use);
    lines.push('');

    // ── Rules ──
    lines.push('# Rules');
    lines.push('');
    const rules = [...(json.hard_rules ?? [])];
    if (rules.length === 0) {
        rules.push('Always follow the user\'s instructions carefully and completely.');
    }
    rules.forEach((rule, i) => {
        lines.push(`${i + 1}. ${rule}`);
    });
    lines.push('');

    // ── Instructions ──
    lines.push('# Instructions');
    lines.push('');
    (json.instructions ?? []).forEach((step, i) => {
        lines.push(`${i + 1}. ${step}`);
    });
    lines.push('');

    // ── Expected inputs ──
    lines.push('# Expected inputs');
    lines.push('');
    lines.push(json.expected_inputs);
    lines.push('');

    // ── Expected outputs ──
    lines.push('# Expected outputs');
    lines.push('');
    lines.push(json.expected_outputs);
    lines.push('');

    // ── Example requests ──
    lines.push('# Example requests');
    lines.push('');
    (json.example_requests ?? []).forEach(ex => {
        lines.push(`- ${ex}`);
    });
    lines.push('');

    // ── Edge cases ──
    if (json.edge_cases && json.edge_cases.length > 0) {
        lines.push('# Edge cases');
        lines.push('');
        json.edge_cases.forEach(ec => {
            lines.push(`- ${ec}`);
        });
        lines.push('');
    }

    // ── Metadata footer ──
    lines.push('---');
    lines.push(`*Generated for ChatGPT · ${json.metadata?.created_at ?? new Date().toISOString()}*`);
    lines.push('');

    return lines.join('\n');
}

module.exports = { renderChatGPT };
