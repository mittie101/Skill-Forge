'use strict';

jest.mock('electron');
jest.mock('../../main/db/settings');

const { ipcMain, dialog, BrowserWindow } = require('electron');
const { getAllSettings, setSetting }      = require('../../main/db/settings');

beforeAll(() => {
    ipcMain._reset();
    require('../../ipc/settings').register();
});

beforeEach(() => {
    jest.clearAllMocks();
});

function invoke(channel, ...args) {
    return ipcMain._invoke(channel, { sender: {} }, ...args);
}

// ── load-settings ─────────────────────────────────────────────────────────────

describe('load-settings', () => {
    it('returns defaults when no settings are saved', async () => {
        getAllSettings.mockReturnValue({});
        const result = await invoke('load-settings');
        expect(result.provider).toBe('');
        expect(result.saveMode).toBe('package');
        expect(result.defaultFramework).toBe('claude');
        expect(result.privacyMode).toBe(false);
        expect(result.anthropicModel).toBe('claude-sonnet-4-20250514');
        expect(result.openaiModel).toBe('gpt-4o');
        expect(typeof result.maxTokens).toBe('number');
        expect(typeof result.defaultSectionCount).toBe('number');
    });

    it('returns saved provider', async () => {
        getAllSettings.mockReturnValue({ provider: 'openai' });
        const result = await invoke('load-settings');
        expect(result.provider).toBe('openai');
    });

    it('parses privacyMode as boolean from string "true"', async () => {
        getAllSettings.mockReturnValue({ privacy_mode: 'true' });
        const result = await invoke('load-settings');
        expect(result.privacyMode).toBe(true);
    });

    it('parses privacyMode as false for string "false"', async () => {
        getAllSettings.mockReturnValue({ privacy_mode: 'false' });
        const result = await invoke('load-settings');
        expect(result.privacyMode).toBe(false);
    });

    it('parses maxTokens as integer', async () => {
        getAllSettings.mockReturnValue({ max_tokens: '4096' });
        const result = await invoke('load-settings');
        expect(result.maxTokens).toBe(4096);
    });

    it('parses defaultSectionCount as integer', async () => {
        getAllSettings.mockReturnValue({ default_section_count: '7' });
        const result = await invoke('load-settings');
        expect(result.defaultSectionCount).toBe(7);
    });

    it('returns saved anthropic and openai model', async () => {
        getAllSettings.mockReturnValue({
            anthropic_model: 'claude-opus-4-20250514',
            openai_model:    'gpt-4.1',
        });
        const result = await invoke('load-settings');
        expect(result.anthropicModel).toBe('claude-opus-4-20250514');
        expect(result.openaiModel).toBe('gpt-4.1');
    });
});

// ── save-settings ─────────────────────────────────────────────────────────────

describe('save-settings', () => {
    it('saves provider to db', async () => {
        const result = await invoke('save-settings', { provider: 'openai' });
        expect(result).toEqual({ ok: true });
        expect(setSetting).toHaveBeenCalledWith('provider', 'openai');
    });

    it('saves multiple settings at once', async () => {
        await invoke('save-settings', {
            provider:    'anthropic',
            saveMode:    'flat',
            privacyMode: true,
        });
        expect(setSetting).toHaveBeenCalledWith('provider', 'anthropic');
        expect(setSetting).toHaveBeenCalledWith('save_mode', 'flat');
        expect(setSetting).toHaveBeenCalledWith('privacy_mode', 'true');
    });

    it('does not call setSetting for undefined keys', async () => {
        await invoke('save-settings', { provider: 'anthropic' });
        const calls = setSetting.mock.calls.map(c => c[0]);
        expect(calls).not.toContain('output_folder');
    });

    it('converts boolean privacyMode to string', async () => {
        await invoke('save-settings', { privacyMode: false });
        expect(setSetting).toHaveBeenCalledWith('privacy_mode', 'false');
    });

    it('converts number maxTokens to string', async () => {
        await invoke('save-settings', { maxTokens: 8192 });
        expect(setSetting).toHaveBeenCalledWith('max_tokens', '8192');
    });
});

// ── pick-folder ───────────────────────────────────────────────────────────────

describe('pick-folder', () => {
    it('returns null when dialog is cancelled', async () => {
        dialog.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
        const result = await invoke('pick-folder');
        expect(result).toBeNull();
    });

    it('returns selected folder path', async () => {
        dialog.showOpenDialog.mockResolvedValue({
            canceled:  false,
            filePaths: ['C:\\Users\\test\\Documents\\skills'],
        });
        const result = await invoke('pick-folder');
        expect(result).toBe('C:\\Users\\test\\Documents\\skills');
    });
});
