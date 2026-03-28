const Database = require('better-sqlite3');
const { getDbPath } = require('../config');
const { MIGRATIONS } = require('./migrations');
const { app } = require('electron');

let _db = null;

/**
 * Returns the singleton better-sqlite3 Database instance.
 * Creates and migrates on first call.
 */
function getDb() {
    if (_db) return _db;

    _db = new Database(getDbPath());

    // Performance pragmas
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    _db.pragma('synchronous = NORMAL');

    _runMigrations(_db);

    return _db;
}

function _runMigrations(db) {
    // Determine current schema version
    let currentVersion = 0;

    const hasVersionTable = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'"
    ).get();

    if (hasVersionTable) {
        const row = db.prepare('SELECT MAX(version) as v FROM schema_version').get();
        currentVersion = row && row.v != null ? row.v : 0;
    }

    const pending = MIGRATIONS.slice(currentVersion);

    if (pending.length === 0) return;

    for (let i = 0; i < pending.length; i++) {
        const version = currentVersion + i + 1;
        try {
            db.transaction(() => {
                db.exec(pending[i]);
                db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(version);
            })();
            if (!app.isPackaged) console.log(`[DB] Migration v${version} applied.`);
        } catch (err) {
            console.error(`[DB] Migration v${version} failed:`, err.message);
            throw Object.assign(
                new Error(`DB migration failed at v${version}: ${err.message}`),
                { code: 'MIGRATION_FAILED', migrationVersion: version }
            );
        }
    }
}

/**
 * Closes the database. Called on app quit.
 */
function closeDb() {
    if (_db) {
        _db.close();
        _db = null;
    }
}

module.exports = { getDb, closeDb };
