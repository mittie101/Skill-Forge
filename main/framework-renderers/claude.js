'use strict';

/**
 * Render JSON intermediate → Claude SKILL.md
 *
 * Output format:
 *   ---
 *   name: "..."
 *   description: "..."
 *   version: 1
 *   framework: claude
 *   ---
 *
 *   # Name
 *   ## When to use / Example requests / etc.
 *
 * @param {object} json  Validated JSON intermediate
 * @returns {string}     Markdown content
 */
function renderClaude(json) {
    const lines = [];

    // ── YAML frontmatter ──
    lines.push('---');
    lines.push(`name: "${_esc(String(json.name).toLowerCase())}"`);
    lines.push(`description: "${_esc(json.description)}"`);
    lines.push(`version: ${json.metadata?.version ?? 1}`);
    lines.push('framework: claude');
    lines.push('created_at: ' + (json.metadata?.created_at ?? new Date().toISOString()));
    lines.push('---');
    lines.push('');

    // ── Title ──
    lines.push(`# ${String(json.name).toLowerCase()}`);
    lines.push('');
    lines.push(json.description);
    lines.push('');

    // ── When to use ──
    lines.push('## When to use');
    lines.push('');
    lines.push(json.when_to_use);
    lines.push('');

    // ── Example requests ──
    lines.push('## Example requests');
    lines.push('');
    (json.example_requests ?? []).forEach(ex => {
        lines.push(`- ${ex}`);
    });
    lines.push('');

    // ── Expected inputs ──
    lines.push('## Expected inputs');
    lines.push('');
    lines.push(json.expected_inputs);
    lines.push('');

    // ── Expected outputs ──
    lines.push('## Expected outputs');
    lines.push('');
    lines.push(json.expected_outputs);
    lines.push('');

    // ── Instructions ──
    lines.push('## Instructions');
    lines.push('');
    (json.instructions ?? []).forEach((step, i) => {
        lines.push(`${i + 1}. ${step}`);
    });
    lines.push('');

    // ── Hard rules ──
    if (json.hard_rules && json.hard_rules.length > 0) {
        lines.push('## Hard rules');
        lines.push('');
        json.hard_rules.forEach(rule => {
            lines.push(`- ${rule}`);
        });
        lines.push('');
    }

    // ── Edge cases ──
    if (json.edge_cases && json.edge_cases.length > 0) {
        lines.push('## Edge cases');
        lines.push('');
        json.edge_cases.forEach(ec => {
            lines.push(`- ${ec}`);
        });
        lines.push('');
    }

    return lines.join('\n');
}

function _esc(str) {
    return String(str ?? '').replace(/"/g, '\\"');
}

module.exports = { renderClaude };
