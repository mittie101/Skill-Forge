const { WINDOWS_RESERVED } = require('./config');

/**
 * Sanitise a skill name into a safe Windows filename stem.
 *
 * Rules (applied in order):
 *  1. Lowercase
 *  2. Replace spaces with hyphens
 *  3. Remove all chars except a-z, 0-9, hyphen
 *  4. Collapse multiple hyphens to one
 *  5. Trim leading/trailing hyphens
 *  6. If reserved or empty after sanitisation: append -skill
 *  7. Truncate to 80 chars
 *
 * @param {string} name
 * @returns {string}
 */
function sanitise(name) {
    let slug = (name ?? '').toLowerCase();
    slug = slug.replace(/\s+/g, '-');
    slug = slug.replace(/[^a-z0-9-]/g, '');
    slug = slug.replace(/-{2,}/g, '-');
    slug = slug.replace(/^-+|-+$/g, '');

    if (!slug || WINDOWS_RESERVED.has(slug.toUpperCase())) {
        slug = slug ? `${slug}-skill` : 'skill';
    }

    return slug.slice(0, 80);
}

module.exports = { sanitise };
