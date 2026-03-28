'use strict';

const { ipcMain } = require('electron');
const { encryptKey, decryptKey, isEncryptionAvailable } = require('../main/storage');
const { getSetting, setSetting, deleteSetting } = require('../main/db/settings');
const { VALID_PROVIDERS } = require('../main/config');
const { apiErrorCode }   = require('../main/stream');

// Rate-limit map for test-api-key: provider → last test timestamp
const _lastTestTime = new Map();

function register() {
    // set-api-key — per-provider, one-way: plaintext enters, encrypted cipher stored — never returned
    ipcMain.handle('set-api-key', (_e, provider, key) => {
        if (!VALID_PROVIDERS.includes(provider)) return { error: 'invalid_provider' };
        if (typeof key !== 'string' || !key.trim()) return { error: 'invalid_key' };
        if (!isEncryptionAvailable()) return { error: 'encryption_unavailable' };
        try {
            const cipher = encryptKey(key.trim());
            setSetting(`api_key_cipher_${provider}`, cipher);
            return { ok: true };
        } catch {
            return { error: 'encrypt_failed' };
        }
    });

    // has-api-key — per-provider existence check
    ipcMain.handle('has-api-key', (_e, provider) => {
        if (!VALID_PROVIDERS.includes(provider)) return false;
        return !!getSetting(`api_key_cipher_${provider}`);
    });

    // get-provider — returns currently selected provider
    ipcMain.handle('get-provider', () => {
        return getSetting('provider') ?? null;
    });

    // clear-api-key — per-provider
    ipcMain.handle('clear-api-key', (_e, provider) => {
        if (!VALID_PROVIDERS.includes(provider)) return { error: 'invalid_provider' };
        deleteSetting(`api_key_cipher_${provider}`);
        return { ok: true };
    });

    // test-api-key — verify a stored key actually works with a cheap models-list call
    ipcMain.handle('test-api-key', async (_e, provider) => {
        if (!VALID_PROVIDERS.includes(provider)) return { ok: false, error: 'invalid_provider' };
        const now = Date.now();
        if (_lastTestTime.has(provider) && now - _lastTestTime.get(provider) < 2000) {
            return { ok: false, error: 'rate_limited' };
        }
        _lastTestTime.set(provider, now);
        const cipher = getSetting(`api_key_cipher_${provider}`);
        if (!cipher) return { ok: false, error: 'no_key' };
        const key = decryptKey(cipher);
        if (!key) return { ok: false, error: 'decrypt_failed' };

        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 10_000);
            let response;
            try {
                if (provider === 'anthropic') {
                    response = await fetch('https://api.anthropic.com/v1/models', {
                        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
                        signal: controller.signal,
                    });
                } else {
                    response = await fetch('https://api.openai.com/v1/models', {
                        headers: { 'Authorization': `Bearer ${key}` },
                        signal: controller.signal,
                    });
                }
            } finally {
                clearTimeout(timer);
            }
            if (!response.ok) return { ok: false, error: apiErrorCode({ statusCode: response.status }) };
            return { ok: true };
        } catch (err) {
            if (err.name === 'AbortError') return { ok: false, error: 'timeout' };
            return { ok: false, error: 'network_error' };
        }
    });
}

module.exports = { register };
