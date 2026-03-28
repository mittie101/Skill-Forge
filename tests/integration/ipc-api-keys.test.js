'use strict';

jest.mock('electron');
jest.mock('../../main/db/settings');
jest.mock('../../main/storage');

const { ipcMain } = require('electron');
const { getSetting, setSetting, deleteSetting } = require('../../main/db/settings');
const { encryptKey, isEncryptionAvailable }     = require('../../main/storage');

// Register handlers once before all tests
beforeAll(() => {
    ipcMain._reset();
    require('../../ipc/api-keys').register();
});

beforeEach(() => {
    jest.clearAllMocks();
    isEncryptionAvailable.mockReturnValue(true);
    encryptKey.mockReturnValue('encrypted_base64');
    getSetting.mockReturnValue(null);
});

function invoke(channel, ...args) {
    return ipcMain._invoke(channel, {}, ...args);
}

// ── set-api-key ───────────────────────────────────────────────────────────────

describe('set-api-key', () => {
    it('stores encrypted key and returns ok:true for anthropic', async () => {
        const result = await invoke('set-api-key', 'anthropic', 'sk-ant-test-key');
        expect(result).toEqual({ ok: true });
        expect(encryptKey).toHaveBeenCalledWith('sk-ant-test-key');
        expect(setSetting).toHaveBeenCalledWith('api_key_cipher_anthropic', 'encrypted_base64');
    });

    it('stores encrypted key and returns ok:true for openai', async () => {
        const result = await invoke('set-api-key', 'openai', 'sk-openai-test-key');
        expect(result).toEqual({ ok: true });
        expect(setSetting).toHaveBeenCalledWith('api_key_cipher_openai', 'encrypted_base64');
    });

    it('trims whitespace from key before encrypting', async () => {
        await invoke('set-api-key', 'anthropic', '  sk-ant-test  ');
        expect(encryptKey).toHaveBeenCalledWith('sk-ant-test');
    });

    it('returns invalid_provider for unknown provider', async () => {
        const result = await invoke('set-api-key', 'google', 'sk-test');
        expect(result).toEqual({ error: 'invalid_provider' });
        expect(encryptKey).not.toHaveBeenCalled();
    });

    it('returns invalid_key for empty string', async () => {
        const result = await invoke('set-api-key', 'anthropic', '');
        expect(result).toEqual({ error: 'invalid_key' });
    });

    it('returns invalid_key for whitespace-only string', async () => {
        const result = await invoke('set-api-key', 'anthropic', '   ');
        expect(result).toEqual({ error: 'invalid_key' });
    });

    it('returns invalid_key for non-string value', async () => {
        const result = await invoke('set-api-key', 'anthropic', 12345);
        expect(result).toEqual({ error: 'invalid_key' });
    });

    it('returns invalid_key for null', async () => {
        const result = await invoke('set-api-key', 'anthropic', null);
        expect(result).toEqual({ error: 'invalid_key' });
    });

    it('returns encryption_unavailable when safeStorage not available', async () => {
        isEncryptionAvailable.mockReturnValue(false);
        const result = await invoke('set-api-key', 'anthropic', 'sk-ant-test');
        expect(result).toEqual({ error: 'encryption_unavailable' });
        expect(encryptKey).not.toHaveBeenCalled();
    });

    it('returns encrypt_failed when encryptKey throws', async () => {
        encryptKey.mockImplementation(() => { throw new Error('HSM failure'); });
        const result = await invoke('set-api-key', 'anthropic', 'sk-ant-test');
        expect(result).toEqual({ error: 'encrypt_failed' });
    });
});

// ── has-api-key ───────────────────────────────────────────────────────────────

describe('has-api-key', () => {
    it('returns true when cipher exists in settings', async () => {
        getSetting.mockReturnValue('some_cipher_blob');
        const result = await invoke('has-api-key', 'anthropic');
        expect(result).toBe(true);
        expect(getSetting).toHaveBeenCalledWith('api_key_cipher_anthropic');
    });

    it('returns false when key is absent (null)', async () => {
        getSetting.mockReturnValue(null);
        const result = await invoke('has-api-key', 'openai');
        expect(result).toBe(false);
    });

    it('returns false when key is empty string', async () => {
        getSetting.mockReturnValue('');
        const result = await invoke('has-api-key', 'anthropic');
        expect(result).toBe(false);
    });

    it('returns false for invalid provider', async () => {
        const result = await invoke('has-api-key', 'google');
        expect(result).toBe(false);
        expect(getSetting).not.toHaveBeenCalled();
    });
});

// ── get-provider ──────────────────────────────────────────────────────────────

describe('get-provider', () => {
    it('returns saved provider string', async () => {
        getSetting.mockReturnValue('anthropic');
        const result = await invoke('get-provider');
        expect(result).toBe('anthropic');
    });

    it('returns null when provider not set', async () => {
        getSetting.mockReturnValue(null);
        const result = await invoke('get-provider');
        expect(result).toBeNull();
    });
});

// ── clear-api-key ─────────────────────────────────────────────────────────────

describe('clear-api-key', () => {
    it('deletes the cipher setting and returns ok:true', async () => {
        const result = await invoke('clear-api-key', 'anthropic');
        expect(result).toEqual({ ok: true });
        expect(deleteSetting).toHaveBeenCalledWith('api_key_cipher_anthropic');
    });

    it('deletes openai cipher', async () => {
        const result = await invoke('clear-api-key', 'openai');
        expect(result).toEqual({ ok: true });
        expect(deleteSetting).toHaveBeenCalledWith('api_key_cipher_openai');
    });

    it('returns invalid_provider for unknown provider', async () => {
        const result = await invoke('clear-api-key', 'google');
        expect(result).toEqual({ error: 'invalid_provider' });
        expect(deleteSetting).not.toHaveBeenCalled();
    });
});
