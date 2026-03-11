const { getDb } = require('./index');
const { HISTORY_CAP } = require('../config');

/**
 * Insert a new skill generation record.
 * Enforces 100-row cap by deleting the oldest row on overflow.
 * Privacy mode: caller skips this function entirely — do not call if privacy on.
 *
 * @param {object} data
 * @returns {number} inserted row id
 */
function insertHistory(data) {
    const db = getDb();
    const now = new Date().toISOString();

    const insert = db.prepare(`
        INSERT INTO skills
            (skill_name, framework, provider, model,
             input_payload_json, generated_md, file_path,
             status, error_code, error_message, version,
             created_at, updated_at)
        VALUES
            (@skill_name, @framework, @provider, @model,
             @input_payload_json, @generated_md, @file_path,
             @status, @error_code, @error_message, @version,
             @created_at, @updated_at)
    `);

    const pruneOldest = db.prepare(`
        DELETE FROM skills
        WHERE id = (SELECT id FROM skills ORDER BY created_at ASC, id ASC LIMIT 1)
    `);

    const countStmt = db.prepare('SELECT COUNT(*) as n FROM skills');

    const run = db.transaction(() => {
        const { n } = countStmt.get();
        if (n >= HISTORY_CAP) {
            pruneOldest.run();
        }

        const result = insert.run({
            skill_name:         data.skill_name         ?? null,
            framework:          data.framework           ?? null,
            provider:           data.provider            ?? null,
            model:              data.model               ?? null,
            input_payload_json: data.input_payload_json  ?? null,
            generated_md:       data.generated_md        ?? null,
            file_path:          data.file_path           ?? null,
            status:             data.status              ?? 'success',
            error_code:         data.error_code          ?? null,
            error_message:      data.error_message       ?? null,
            version:            data.version             ?? 1,
            created_at:         now,
            updated_at:         now,
        });

        return result.lastInsertRowid;
    });

    return run();
}

/**
 * List history rows, newest first.
 * @param {object} [opts]
 * @param {string} [opts.framework]  filter by framework
 * @param {number} [opts.limit]      default 200
 * @returns {object[]}
 */
function listHistory({ framework, limit = 200 } = {}) {
    const db = getDb();

    if (framework) {
        return db.prepare(`
            SELECT id, skill_name, framework, provider, model,
                   status, file_path, created_at
            FROM skills
            WHERE framework = ?
            ORDER BY created_at DESC
            LIMIT ?
        `).all(framework, limit);
    }

    return db.prepare(`
        SELECT id, skill_name, framework, provider, model,
               status, file_path, created_at
        FROM skills
        ORDER BY created_at DESC
        LIMIT ?
    `).all(limit);
}

/**
 * Full-text search across skill_name and generated_md.
 * Escapes LIKE special chars to prevent injection.
 * @param {string} query
 * @param {string} [framework]
 * @returns {object[]}
 */
function searchHistory(query, framework) {
    const db = getDb();

    // Escape LIKE metacharacters
    const escaped = query
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_');

    const like = `%${escaped}%`;

    if (framework) {
        return db.prepare(`
            SELECT id, skill_name, framework, provider, model,
                   status, file_path, created_at
            FROM skills
            WHERE framework = ?
              AND (skill_name LIKE ? ESCAPE '\\' OR generated_md LIKE ? ESCAPE '\\')
            ORDER BY created_at DESC
            LIMIT 200
        `).all(framework, like, like);
    }

    return db.prepare(`
        SELECT id, skill_name, framework, provider, model,
               status, file_path, created_at
        FROM skills
        WHERE skill_name LIKE ? ESCAPE '\\'
           OR generated_md LIKE ? ESCAPE '\\'
        ORDER BY created_at DESC
        LIMIT 200
    `).all(like, like);
}

/**
 * Fetch a single full row by id (used for reopen).
 * @param {number} id
 * @returns {object|null}
 */
function getHistoryById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM skills WHERE id = ?').get(id) ?? null;
}

/**
 * Delete a history row by id.
 * @param {number} id
 * @returns {boolean} true if a row was deleted
 */
function deleteHistory(id) {
    const db = getDb();
    const result = db.prepare('DELETE FROM skills WHERE id = ?').run(id);
    return result.changes > 0;
}

/**
 * Delete all history rows.
 * @returns {number} rows deleted
 */
function clearHistory() {
    const db = getDb();
    const result = db.prepare('DELETE FROM skills').run();
    return result.changes;
}

/**
 * Count of history rows.
 * @returns {number}
 */
function historyCount() {
    const db = getDb();
    return db.prepare('SELECT COUNT(*) as n FROM skills').get().n;
}

module.exports = {
    insertHistory,
    listHistory,
    searchHistory,
    getHistoryById,
    deleteHistory,
    clearHistory,
    historyCount,
};
