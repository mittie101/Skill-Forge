const { BrowserWindow, session, screen } = require('electron');
const path = require('path');

const CSP = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "connect-src 'none'",
    "font-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
].join('; ');

function _loadBounds() {
    try {
        const { getSetting } = require('./db/settings');
        const raw = getSetting('window_bounds');
        if (!raw) return null;
        return JSON.parse(raw);
    } catch { return null; }
}

function _saveBounds(bounds) {
    try {
        const { setSetting } = require('./db/settings');
        setSetting('window_bounds', JSON.stringify(bounds));
    } catch { /* non-fatal */ }
}

function _intersectsAnyDisplay(bounds) {
    return screen.getAllDisplays().some(d => {
        const wa = d.workArea;
        return (
            bounds.x < wa.x + wa.width  &&
            bounds.x + bounds.width  > wa.x &&
            bounds.y < wa.y + wa.height &&
            bounds.y + bounds.height > wa.y
        );
    });
}

function createWindow() {
    const saved     = _loadBounds();
    const usesSaved = saved && _intersectsAnyDisplay(saved);

    const win = new BrowserWindow({
        ...(usesSaved
            ? { x: saved.x, y: saved.y, width: saved.width, height: saved.height }
            : { width: 1280, height: 800 }),
        minWidth:        900,
        minHeight:       600,
        backgroundColor: '#0a0a14',
        webPreferences: {
            preload:          path.join(__dirname, '..', 'preload.js'),
            nodeIntegration:  false,
            contextIsolation: true,
            sandbox:          true,
            webSecurity:      true,
        },
    });

    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [CSP],
            },
        });
    });

    win.on('close', () => _saveBounds(win.getBounds()));

    // Renderer calls e.preventDefault() in beforeunload when unsaved output or
    // generation is in progress. Electron with sandbox:true silently blocks the
    // close — handle will-prevent-unload to show a confirmation dialog instead.
    win.webContents.on('will-prevent-unload', (event) => {
        const { dialog } = require('electron');
        const choice = dialog.showMessageBoxSync(win, {
            type:    'question',
            buttons: ['Close anyway', 'Cancel'],
            defaultId: 1,
            cancelId:  1,
            title:   'Unsaved changes',
            message: 'You have unsaved output or a generation in progress.\nClose anyway?',
        });
        if (choice === 0) event.preventDefault(); // 0 = "Close anyway" → allow close
    });

    win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
    return win;
}

module.exports = { createWindow, CSP };
