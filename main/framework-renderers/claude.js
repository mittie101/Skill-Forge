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

    // ── Persona ──
    if (json.persona) {
        lines.push('## Persona');
        lines.push('');
        lines.push(json.persona);
        lines.push('');
    }

    // ── When to use ──
    lines.push('## When to use');
    lines.push('');
    lines.push(json.when_to_use);
    lines.push('');

    // ── Example requests ──
    lines.push('## Example requests');
    lines.push('');
    (json.example_requests ?? []).forEach(ex => lines.push(`- ${ex}`));
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

    const hasSpecialists = Array.isArray(json.specialists) && json.specialists.length > 0;

    if (hasSpecialists) {
        // ── Decision Points ──
        if (Array.isArray(json.decision_points) && json.decision_points.length > 0) {
            lines.push('## Decision Points');
            lines.push('');
            json.decision_points.forEach(dp => lines.push(`- ${dp}`));
            lines.push('');
        }

        // ── Specialist sections ──
        json.specialists.forEach(spec => {
            lines.push(`## ${spec.name}`);
            lines.push('');

            if (spec.when) {
                lines.push('**When to use this section:**');
                lines.push(spec.when);
                lines.push('');
            }
            if (spec.inputs) {
                lines.push('**Expected inputs:**');
                lines.push(spec.inputs);
                lines.push('');
            }
            if (spec.outputs) {
                lines.push('**Expected outputs:**');
                lines.push(spec.outputs);
                lines.push('');
            }
            if (Array.isArray(spec.hard_rules) && spec.hard_rules.length > 0) {
                lines.push('**Hard rules:**');
                spec.hard_rules.forEach(r => lines.push(`- ${r}`));
                lines.push('');
            }
        });

        // ── Output Format ──
        if (Array.isArray(json.output_format) && json.output_format.length > 0) {
            lines.push('## Output Format');
            lines.push('');
            json.output_format.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
            lines.push('');
        }

        // ── Constraints ──
        if (Array.isArray(json.constraints) && json.constraints.length > 0) {
            lines.push('## Constraints');
            lines.push('');
            json.constraints.forEach(c => lines.push(`- ${c}`));
            lines.push('');
        }

    } else {
        // ── Legacy flat format fallback ──
        if (Array.isArray(json.instructions) && json.instructions.length > 0) {
            lines.push('## Instructions');
            lines.push('');
            json.instructions.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
            lines.push('');
        }
        if (Array.isArray(json.hard_rules) && json.hard_rules.length > 0) {
            lines.push('## Hard rules');
            lines.push('');
            json.hard_rules.forEach(r => lines.push(`- ${r}`));
            lines.push('');
        }
        if (Array.isArray(json.edge_cases) && json.edge_cases.length > 0) {
            lines.push('## Edge cases');
            lines.push('');
            json.edge_cases.forEach(ec => lines.push(`- ${ec}`));
            lines.push('');
        }
    }

    return lines.join('\n');
}

function _esc(str) {
    return String(str ?? '').replace(/"/g, '\\"');
}

module.exports = { renderClaude };
