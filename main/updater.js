'use strict';

const { ipcMain } = require('electron');

let _autoUpdater = null;
let _win = null;

function _loadAutoUpdater() {
    if (_autoUpdater) return _autoUpdater;
    try {
        _autoUpdater = require('electron-updater').autoUpdater;
    } catch {
        // electron-updater not available (dev/test environment)
        _autoUpdater = null;
    }
    return _autoUpdater;
}

function initUpdater(win) {
    _win = win;
    const autoUpdater = _loadAutoUpdater();
    if (!autoUpdater) return;

    autoUpdater.autoDownload         = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-available', (info) => {
        _send('update-available', { version: info.version });
    });
    autoUpdater.on('update-downloaded', (info) => {
        _send('update-downloaded', { version: info.version });
    });
    autoUpdater.on('error', (err) => {
        // Non-fatal — notify renderer so it can surface a subtle toast
        _send('update-error', { message: err.message });
    });

    // Delay check to avoid blocking app startup.
    // checkForUpdates() returns a Promise — must be caught to prevent the
    // "No published versions on GitHub" rejection from reaching the global
    // unhandledRejection handler and showing an error dialog.
    setTimeout(() => {
        try {
            const p = autoUpdater.checkForUpdates();
            if (p && typeof p.catch === 'function') p.catch(() => {});
        } catch {}
    }, 10_000);
}

function _send(channel, payload) {
    try {
        if (_win && !_win.isDestroyed()) _win.webContents.send(channel, payload);
    } catch {}
}

function register() {
    ipcMain.handle('install-update', () => {
        const autoUpdater = _loadAutoUpdater();
        if (autoUpdater) autoUpdater.quitAndInstall(false, true);
        return { ok: true };
    });
}

module.exports = { initUpdater, register };
