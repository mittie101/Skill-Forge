'use strict';

// Manual mock for 'electron' — used by all IPC tests via jest.mock('electron')

const _handlers = new Map();

const ipcMain = {
    handle: jest.fn((channel, handler) => {
        _handlers.set(channel, handler);
    }),
    removeHandler: jest.fn((channel) => {
        _handlers.delete(channel);
    }),
    // Test helper: invoke a registered handler directly
    _invoke: (channel, event, ...args) => {
        const handler = _handlers.get(channel);
        if (!handler) throw new Error(`No IPC handler registered for: ${channel}`);
        return handler(event ?? {}, ...args);
    },
    _handlers,
    _reset: () => _handlers.clear(),
};

const safeStorage = {
    isEncryptionAvailable: jest.fn(() => true),
    encryptString: jest.fn((text) => Buffer.from(text, 'utf8')),
    decryptString: jest.fn((buf) => buf.toString('utf8')),
};

const app = {
    getPath: jest.fn((name) => `/tmp/test-skillforge-${name}`),
    whenReady: jest.fn(() => Promise.resolve()),
    on: jest.fn(),
    quit: jest.fn(),
};

const _mockWin = {
    webContents: { send: jest.fn() },
    isDestroyed: jest.fn(() => false),
    loadFile: jest.fn(),
    on: jest.fn(),
    getBounds: jest.fn(() => ({ x: 0, y: 0, width: 1280, height: 800 })),
};

const BrowserWindow = {
    fromWebContents: jest.fn(() => _mockWin),
    _mockWin,
};

const dialog = {
    showOpenDialog: jest.fn(() => Promise.resolve({ canceled: true, filePaths: [] })),
    showErrorBox: jest.fn(),
    showMessageBoxSync: jest.fn(() => 1),
};

const shell = {
    openPath: jest.fn(() => Promise.resolve('')),
};

const session = {
    defaultSession: {
        webRequest: {
            onHeadersReceived: jest.fn(),
        },
    },
};

const screen = {
    getAllDisplays: jest.fn(() => [{
        workArea: { x: 0, y: 0, width: 1920, height: 1080 },
    }]),
};

const contextBridge = {
    exposeInMainWorld: jest.fn(),
};

const ipcRenderer = {
    invoke: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
    send: jest.fn(),
};

module.exports = {
    ipcMain,
    safeStorage,
    app,
    BrowserWindow,
    dialog,
    shell,
    session,
    screen,
    contextBridge,
    ipcRenderer,
};
