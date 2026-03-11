'use strict';

const { ipcMain } = require('electron');
const { encryptKey, isEncryptionAvailable } = require('../main/storage');
const { getSetting, setSetting, deleteSetting } = require('../main/db/settings');

function register() {
    // One-way: plaintext key enters, encrypted cipher is stored — never returned
    ipcMain.handle('set-api-key', (_e, key) => {
        if (typeof key !== 'string' || !key.trim()) return { error: 'invalid_key' };
        if (!isEncryptionAvailable()) return { error: 'encryption_unavailable' };
        try {
            const cipher = encryptKey(key.trim());
            setSetting('api_key_cipher', cipher);
            return { ok: true };
        } catch {
            return { error: 'encrypt_failed' };
        }
    });

    ipcMain.handle('has-api-key', () => {
        return !!getSetting('api_key_cipher');
    });

    // Returns currently selected provider — NOT derived from key prefix
    ipcMain.handle('get-provider', () => {
        return getSetting('provider') ?? null;
    });

    ipcMain.handle('clear-api-key', () => {
        deleteSetting('api_key_cipher');
        return { ok: true };
    });
}

module.exports = { register };
