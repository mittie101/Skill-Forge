'use strict';

// HTML-escape a string for safe insertion into HTML content
function escHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Attribute-escape a string for safe use in HTML attribute values
function escAttr(str) {
    return String(str ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Rebuild raw markdown from installLoadFile result { meta, body }
function rebuildRaw(result) {
    if (!result) return '';
    const meta = result.meta ?? {};
    const body = result.body ?? '';
    const fmLines = ['---'];
    for (const [k, v] of Object.entries(meta)) {
        const safeV = String(v ?? '').replace(/[\r\n]+/g, ' ');
        fmLines.push(`${k}: ${safeV}`);
    }
    fmLines.push('---');
    return fmLines.join('\n') + '\n' + body;
}

window.SkillUtils = { escHtml, escAttr, rebuildRaw };
