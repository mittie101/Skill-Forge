'use strict';

// Manual mock for better-sqlite3 — used automatically by Jest for node_module mocks.
// Provides a minimal in-memory stub so integration tests can load db/* modules
// without requiring the native binary to be compiled for the test environment.

function _makeStmt() {
    return {
        get:    jest.fn(() => null),
        run:    jest.fn(() => ({ changes: 1, lastInsertRowid: 1 })),
        all:    jest.fn(() => []),
        pluck:  jest.fn(function() { return this; }),
        expand: jest.fn(function() { return this; }),
    };
}

function Database() {
    this.pragma  = jest.fn();
    this.exec    = jest.fn();
    this.close   = jest.fn();
    this.prepare = jest.fn(() => _makeStmt());
    this.transaction = jest.fn((fn) => {
        // Return a callable that executes fn immediately (synchronous, like better-sqlite3)
        return (...args) => fn(...args);
    });
}

Database.prototype.pragma  = jest.fn();
Database.prototype.exec    = jest.fn();
Database.prototype.close   = jest.fn();
Database.prototype.prepare = jest.fn(() => _makeStmt());
Database.prototype.transaction = jest.fn((fn) => (...args) => fn(...args));

module.exports = Database;
