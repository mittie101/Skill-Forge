const { getDb } = require('./index');

/**
 * Get a single setting value by key.
 * @param {string} key
 * @param {*} [defaultValue]
 * @returns {string|null}
 */
function getSetting(key, defaultValue = null) {
    const db = getDb();
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : defaultValue;
}

/**
 * Set a setting key/value (upsert).
 * @param {string} key
 * @param {string} value
 */
function setSetting(key, value) {
    const db = getDb();
    db.prepare(`
        INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, String(value));
}

/**
 * Get all settings as a plain key→value object.
 * @returns {Record<string, string>}
 */
function getAllSettings() {
    const db = getDb();
    const rows = db.prepare('SELECT key, value FROM settings').all();
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

/**
 * Delete a setting by key.
 * @param {string} key
 */
function deleteSetting(key) {
    const db = getDb();
    db.prepare('DELETE FROM settings WHERE key = ?').run(key);
}

module.exports = { getSetting, setSetting, getAllSettings, deleteSetting };
