'use strict';

/**
 * Parse YAML-like frontmatter from a markdown string.
 * Returns { meta: object, body: string }
 *
 * @param {string} content
 * @returns {{ meta: object, body: string }}
 */
function parseFrontmatter(content) {
    const meta = {};
    if (!content.startsWith('---')) return { meta, body: content };
    const end = content.indexOf('\n---', 3);
    if (end === -1) return { meta, body: content };
    const fm = content.slice(4, end);
    for (const line of fm.split('\n')) {
        const colon = line.indexOf(':');
        if (colon === -1) continue;
        const key = line.slice(0, colon).trim();
        const val = line.slice(colon + 1).trim().replace(/^["']|["']$/g, '');
        if (key) meta[key] = val;
    }
    return { meta, body: content.slice(end + 4) };
}

/**
 * Quote a YAML frontmatter scalar value unless it is a simple identifier.
 * Simple scalars contain only [a-zA-Z0-9._-] — everything else is wrapped in
 * double quotes with internal `"` and `\` escaped.
 */
function quoteFrontmatterValue(str) {
    if (/^[a-zA-Z0-9._-]+$/.test(str)) return str;
    return '"' + str.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

module.exports = { parseFrontmatter, quoteFrontmatterValue };
