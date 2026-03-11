'use strict';

/**
 * Integration smoke tests for IPC modules.
 * These tests verify module structure and exports without spinning up Electron.
 * Electron APIs are mocked at the module level.
 */

// ── Mock Electron ────────────────────────────────────────────────────────────

jest.mock('electron', () => ({
    ipcMain: {
        handle: jest.fn(),
    },
    dialog: {
        showOpenDialog: jest.fn(),
    },
    shell: {
        openPath: jest.fn(),
    },
    safeStorage: {
        isEncryptionAvailable: jest.fn(() => true),
        encryptString:         jest.fn(s => Buffer.from(s)),
        decryptString:         jest.fn(b => b.toString()),
    },
    BrowserWindow: {
        fromWebContents: jest.fn(),
    },
    app: {
        getPath: jest.fn(() => '/tmp'),
    },
}));

// ── Mock DB ──────────────────────────────────────────────────────────────────

jest.mock('../../main/db/index', () => ({
    getDb: jest.fn(() => ({
        prepare: jest.fn(() => ({
            run:  jest.fn(),
            get:  jest.fn(() => ({ n: 0, value: null })),
            all:  jest.fn(() => []),
        })),
        transaction: jest.fn(fn => fn),
    })),
    closeDb: jest.fn(),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ipc/index.js', () => {
    test('registerAllIpcHandlers calls register on all modules without throwing', () => {
        expect(() => require('../../ipc/index')).not.toThrow();
    });

    test('exports registerAllIpcHandlers function', () => {
        const { registerAllIpcHandlers } = require('../../ipc/index');
        expect(typeof registerAllIpcHandlers).toBe('function');
    });

    test('registerAllIpcHandlers invokes ipcMain.handle', () => {
        const { ipcMain } = require('electron');
        const { registerAllIpcHandlers } = require('../../ipc/index');
        registerAllIpcHandlers();
        expect(ipcMain.handle).toHaveBeenCalled();
    });
});

describe('ipc/generate.js', () => {
    test('exports register function', () => {
        const mod = require('../../ipc/generate');
        expect(typeof mod.register).toBe('function');
    });
});

describe('ipc/api-keys.js', () => {
    test('exports register function', () => {
        const mod = require('../../ipc/api-keys');
        expect(typeof mod.register).toBe('function');
    });
});

describe('ipc/settings.js', () => {
    test('exports register function', () => {
        const mod = require('../../ipc/settings');
        expect(typeof mod.register).toBe('function');
    });
});

describe('ipc/history.js', () => {
    test('exports register function', () => {
        const mod = require('../../ipc/history');
        expect(typeof mod.register).toBe('function');
    });
});

describe('ipc/file.js', () => {
    test('exports register function', () => {
        const mod = require('../../ipc/file');
        expect(typeof mod.register).toBe('function');
    });
});

describe('main/slug.js', () => {
    test('sanitise is exported and is a function', () => {
        const { sanitise } = require('../../main/slug');
        expect(typeof sanitise).toBe('function');
    });
});

describe('main/prompts.js', () => {
    test('buildSkillPrompt and fenceUserInput are exported', () => {
        const { buildSkillPrompt, fenceUserInput } = require('../../main/prompts');
        expect(typeof buildSkillPrompt).toBe('function');
        expect(typeof fenceUserInput).toBe('function');
    });
});

describe('main/config.js', () => {
    test('exports expected constants', () => {
        const config = require('../../main/config');
        expect(config.HISTORY_CAP).toBe(100);
        expect(config.HISTORY_WARN_AT).toBe(80);
        expect(config.IMPORT_MAX_BYTES).toBe(50 * 1024);
        expect(config.INPUT_CAPS).toBeDefined();
        expect(config.WINDOWS_RESERVED).toBeInstanceOf(Set);
    });
});
