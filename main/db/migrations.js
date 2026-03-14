// Ordered SQL migration array — each entry runs exactly once, in order.
// Never modify existing entries; append new ones to add schema changes.

const MIGRATIONS = [
    // v1 — initial schema
    `
    CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS skills (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        skill_name          TEXT,
        framework           TEXT,
        provider            TEXT,
        model               TEXT,
        input_payload_json  TEXT,
        generated_md        TEXT,
        file_path           TEXT,
        status              TEXT,
        error_code          TEXT,
        error_message       TEXT,
        version             INTEGER DEFAULT 1,
        created_at          TEXT,
        updated_at          TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_skills_created ON skills(created_at DESC);
    `,

    // v2 — add cost tracking columns (input_tokens, output_tokens, cost_usd)
    // SQLite requires one ADD COLUMN per statement; run as separate execs via db.exec()
    `
    ALTER TABLE skills ADD COLUMN input_tokens  INTEGER;
    ALTER TABLE skills ADD COLUMN output_tokens INTEGER;
    ALTER TABLE skills ADD COLUMN cost_usd      REAL;
    `,
];

module.exports = { MIGRATIONS };
