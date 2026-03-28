const { getDb } = require('./index');
const { HISTORY_CAP } = require('../config');

// ── Cached prepared statements ──
// _stmtsDb tracks which db instance the statements were compiled against.
// If closeDb() is called and a new db is opened, stmts are rebuilt automatically.
let _stmts   = null;
let _stmtsDb = null;

function _getStmts() {
    const db = getDb();
    // Invalidate cache if the db instance changed (e.g. after close + reopen)
    if (_stmts && _stmtsDb !== db) _stmts = null;
    if (_stmts) return _stmts;

    _stmtsDb = db;
    _stmts = {
        insert: db.prepare(`
            INSERT INTO skills
                (skill_name, framework, provider, model,
                 input_payload_json, generated_md, file_path,
                 status, error_code, error_message, version,
                 input_tokens, output_tokens, cost_usd,
                 created_at, updated_at)
            VALUES
                (@skill_name, @framework, @provider, @model,
                 @input_payload_json, @generated_md, @file_path,
                 @status, @error_code, @error_message, @version,
                 @input_tokens, @output_tokens, @cost_usd,
                 @created_at, @updated_at)
        `),
        pruneOldest: db.prepare(`
            DELETE FROM skills
            WHERE id = (SELECT id FROM skills ORDER BY created_at ASC, id ASC LIMIT 1)
        `),
        count:      db.prepare('SELECT COUNT(*) as n FROM skills'),
        getById:    db.prepare('SELECT * FROM skills WHERE id = ?'),
        deleteById: db.prepare('DELETE FROM skills WHERE id = ?'),
        clearAll:   db.prepare('DELETE FROM skills'),
        countAll:   db.prepare('SELECT COUNT(*) as n FROM skills'),
    };
    return _stmts;
}

/**
 * Insert a new skill generation record.
 * Enforces HISTORY_CAP-row cap by deleting the oldest row on overflow.
 * Privacy mode: caller skips this function entirely — do not call if privacy on.
 *
 * @param {object} data
 * @returns {number} inserted row id
 */
function insertHistory(data) {
    const db    = getDb();
    const stmts = _getStmts();
    const now   = new Date().toISOString();

    const run = db.transaction(() => {
        const { n } = stmts.count.get();
        if (n >= HISTORY_CAP) {
            stmts.pruneOldest.run();
        }

        const result = stmts.insert.run({
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
            input_tokens:       data.input_tokens        ?? null,
            output_tokens:      data.output_tokens       ?? null,
            cost_usd:           data.cost_usd            ?? null,
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
 * @param {number} [opts.limit]      defaults to HISTORY_CAP (matches the enforced cap)
 * @returns {object[]}
 */
function listHistory({ framework, limit = HISTORY_CAP } = {}) {
    const db = getDb();

    if (framework) {
        return db.prepare(`
            SELECT id, skill_name, framework, provider, model,
                   status, file_path, input_tokens, output_tokens, cost_usd, created_at
            FROM skills
            WHERE framework = ?
            ORDER BY created_at DESC
            LIMIT ?
        `).all(framework, limit);
    }

    return db.prepare(`
        SELECT id, skill_name, framework, provider, model,
               status, file_path, input_tokens, output_tokens, cost_usd, created_at
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
                   status, file_path, input_tokens, output_tokens, cost_usd, created_at
            FROM skills
            WHERE framework = ?
              AND (skill_name LIKE ? ESCAPE '\\' OR generated_md LIKE ? ESCAPE '\\')
            ORDER BY created_at DESC
            LIMIT 200
        `).all(framework, like, like);
    }

    return db.prepare(`
        SELECT id, skill_name, framework, provider, model,
               status, file_path, input_tokens, output_tokens, cost_usd, created_at
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

function deleteHistory(id) {
    const stmts = _getStmts();
    const result = stmts.deleteById.run(id);
    return result.changes > 0;
}

function clearHistory() {
    const stmts = _getStmts();
    const result = stmts.clearAll.run();
    return result.changes;
}

function historyCount() {
    const stmts = _getStmts();
    return stmts.countAll.get().n;
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
