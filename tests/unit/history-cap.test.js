'use strict';

/**
 * History cap tests.
 * Uses an in-memory JS store to simulate the SQLite layer so that
 * the native better-sqlite3 binary is not required (it's compiled for
 * Electron's Node.js and cannot be rebuilt for the test Node.js easily).
 */

const { HISTORY_CAP } = require('../../main/config');

// ── Lightweight in-memory DB simulator ─────────────────────────────────────

function makeMemoryDb() {
    let rows     = [];
    let nextId   = 1;
    let _txFn    = null;

    return {
        _rows() { return rows; },
        prepare(sql) {
            return {
                run(...args)  { return this._run(sql, args); },
                get(...args)  { return this._get(sql, args); },
                all(...args)  { return this._all(sql, args); },
                _run(sql, args) {
                    if (/INSERT INTO skills/.test(sql)) {
                        const [
                            skill_name, framework, provider, model,
                            input_payload_json, generated_md, file_path,
                            status, error_code, error_message, version,
                            created_at, updated_at,
                        ] = args[0] ? Object.values(args[0]) : args;
                        const id = nextId++;
                        rows.push({
                            id, skill_name, framework, provider, model,
                            input_payload_json, generated_md, file_path,
                            status, error_code, error_message, version,
                            created_at, updated_at,
                        });
                        return { lastInsertRowid: id, changes: 1 };
                    }
                    if (/DELETE FROM skills/.test(sql) && /ORDER BY created_at ASC/.test(sql)) {
                        if (rows.length === 0) return { changes: 0 };
                        const sorted = [...rows].sort((a, b) =>
                            (a.created_at ?? '').localeCompare(b.created_at ?? ''));
                        const oldest = sorted[0];
                        rows = rows.filter(r => r.id !== oldest.id);
                        return { changes: 1 };
                    }
                    return { changes: 0 };
                },
                _get(sql) {
                    if (/COUNT\(\*\)/.test(sql)) return { n: rows.length };
                    return null;
                },
                _all(sql, args) {
                    let result = [...rows];
                    if (/ORDER BY created_at DESC/.test(sql)) {
                        result.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
                    }
                    return result;
                },
            };
        },
        transaction(fn) {
            return () => fn();
        },
        pragma()  {},
        exec()    {},
        close()   {},
        _reset()  { rows = []; nextId = 1; },
    };
}

// ── Wire mock ────────────────────────────────────────────────────────────────

let mockDb = makeMemoryDb();

jest.mock('../../main/db/index', () => ({
    getDb: () => mockDb,
}));

const { insertHistory, historyCount, listHistory } = require('../../main/db/history');

beforeEach(() => {
    mockDb._reset();
});

function makeRow(name, createdAt) {
    return {
        skill_name:         name,
        framework:          'claude',
        provider:           'anthropic',
        model:              'model',
        input_payload_json: '{}',
        generated_md:       '# test',
        status:             'success',
        created_at:         createdAt,
    };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('history cap enforcement', () => {
    test('insertHistory returns a numeric id', () => {
        const id = insertHistory(makeRow('first'));
        expect(typeof id).toBe('number');
        expect(id).toBeGreaterThan(0);
    });

    test('count reflects inserted rows', () => {
        insertHistory(makeRow('a'));
        insertHistory(makeRow('b'));
        expect(historyCount()).toBe(2);
    });

    test(`inserting ${HISTORY_CAP} rows does not prune`, () => {
        for (let i = 0; i < HISTORY_CAP; i++) {
            insertHistory(makeRow(`skill-${i}`));
        }
        expect(historyCount()).toBe(HISTORY_CAP);
    });

    test(`inserting row ${HISTORY_CAP + 1} prunes one row, keeps count at ${HISTORY_CAP}`, () => {
        for (let i = 0; i < HISTORY_CAP; i++) {
            insertHistory(makeRow(`skill-${i}`));
        }
        insertHistory(makeRow('newest'));
        expect(historyCount()).toBe(HISTORY_CAP);
    });

    test('oldest row (by created_at) is removed when cap exceeded', () => {
        // Insert oldest row first with earliest timestamp
        insertHistory(makeRow('skill-oldest', '2020-01-01T00:00:00.000Z'));

        for (let i = 1; i < HISTORY_CAP; i++) {
            const ts = `2025-${String(i).padStart(2, '0')}-01T00:00:00.000Z`;
            insertHistory(makeRow(`skill-${i}`, ts));
        }

        expect(historyCount()).toBe(HISTORY_CAP);

        insertHistory(makeRow('skill-new', '2026-01-01T00:00:00.000Z'));

        expect(historyCount()).toBe(HISTORY_CAP);

        const rows  = listHistory();
        const names = rows.map(r => r.skill_name);
        expect(names).not.toContain('skill-oldest');
        expect(names).toContain('skill-new');
    });

    test('inserting two rows past cap keeps count at HISTORY_CAP', () => {
        for (let i = 0; i < HISTORY_CAP; i++) {
            insertHistory(makeRow(`skill-${i}`));
        }
        insertHistory(makeRow('extra-1'));
        insertHistory(makeRow('extra-2'));
        expect(historyCount()).toBe(HISTORY_CAP);
    });

    test('HISTORY_CAP constant is 100', () => {
        expect(HISTORY_CAP).toBe(100);
    });
});
