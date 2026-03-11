'use strict';

/**
 * Render JSON intermediate → LangChain prompt template (.md)
 *
 * Required markers (validated by validators/langchain.js):
 *   - At least one {variable} placeholder in curly braces
 *
 * @param {object} json  Validated JSON intermediate
 * @returns {string}     Markdown content
 */
function renderLangChain(json) {
    const lines = [];

    // ── Title ──
    lines.push(`# ${json.name}`);
    lines.push('');
    lines.push(json.description);
    lines.push('');

    // ── System instructions ──
    lines.push('## System instructions');
    lines.push('');
    lines.push(json.when_to_use);
    lines.push('');
    (json.instructions ?? []).forEach((step, i) => {
        lines.push(`${i + 1}. ${step}`);
    });
    lines.push('');

    // ── Hard rules ──
    if (json.hard_rules && json.hard_rules.length > 0) {
        lines.push('## Rules');
        lines.push('');
        json.hard_rules.forEach(rule => {
            lines.push(`- ${rule}`);
        });
        lines.push('');
    }

    // ── Input schema ──
    lines.push('## Input');
    lines.push('');
    lines.push(json.expected_inputs);
    lines.push('');

    // ── Template variables ──
    lines.push('## Prompt template');
    lines.push('');
    lines.push('```');
    lines.push(`{input}`);
    lines.push('```');
    lines.push('');

    // ── Context (optional chaining) ──
    lines.push('## Context (optional)');
    lines.push('');
    lines.push('Additional context to inject into the chain:');
    lines.push('');
    lines.push('```');
    lines.push('{context}');
    lines.push('```');
    lines.push('');

    // ── Output schema ──
    lines.push('## Output');
    lines.push('');
    lines.push(json.expected_outputs);
    lines.push('');

    // ── Format instructions placeholder ──
    lines.push('## Format instructions');
    lines.push('');
    lines.push('{format_instructions}');
    lines.push('');

    // ── Example requests ──
    lines.push('## Example requests');
    lines.push('');
    (json.example_requests ?? []).forEach(ex => {
        lines.push(`- ${ex}`);
    });
    lines.push('');

    // ── Edge cases ──
    if (json.edge_cases && json.edge_cases.length > 0) {
        lines.push('## Edge cases');
        lines.push('');
        json.edge_cases.forEach(ec => {
            lines.push(`- ${ec}`);
        });
        lines.push('');
    }

    // ── Metadata footer ──
    lines.push('---');
    lines.push(`*Generated for LangChain · ${json.metadata?.created_at ?? new Date().toISOString()}*`);
    lines.push('');

    return lines.join('\n');
}

module.exports = { renderLangChain };
