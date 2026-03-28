'use strict';

jest.mock('electron');
jest.mock('../../main/db/settings');
jest.mock('../../main/storage');
jest.mock('../../main/db/history');
jest.mock('../../main/api-caller');
jest.mock('../../main/stream', () => ({
    ...jest.requireActual('../../main/stream'),
    streamWithRetry: jest.fn(),
}));

const { ipcMain, BrowserWindow } = require('electron');
const { getSetting }             = require('../../main/db/settings');
const { decryptKey }             = require('../../main/storage');
const { insertHistory }          = require('../../main/db/history');
const { callApi }                = require('../../main/api-caller');
const { streamWithRetry }        = require('../../main/stream');

const mockWin = BrowserWindow._mockWin;

// ── Fixtures ──

const VALID_PARAMS = {
    keyword:     'cpp-expert',
    description: 'A C++ expert skill',
    sections:    ['Core Concepts', 'Memory Management', 'STL', 'Best Practices', 'Debugging'],
    maxTokens:   4096,
};

const API_SUCCESS = {
    rawText:      '# cpp-expert\n\n## Core Concepts\n\nContent here.',
    inputTokens:  200,
    outputTokens: 500,
};

// ── Setup ──

beforeAll(() => {
    ipcMain._reset();
    require('../../ipc/build').register();
});

beforeEach(() => {
    jest.clearAllMocks();

    getSetting.mockImplementation((key) => {
        const map = {
            provider:                 'anthropic',
            api_key_cipher_anthropic: 'cipher_blob',
            anthropic_model:          'claude-sonnet-4-20250514',
            max_tokens:               null,
            privacy_mode:             'false',
        };
        return map[key] ?? null;
    });
    decryptKey.mockReturnValue('sk-ant-real-key');
    callApi.mockResolvedValue(API_SUCCESS);
    insertHistory.mockReturnValue(1);
    mockWin.webContents.send.mockClear();
    mockWin.isDestroyed.mockReturnValue(false);

    // Default streamWithRetry: simulate one text chunk delivered to renderer + return token usage
    streamWithRetry.mockImplementation(async ({ onChunk, win, chunkEvent }) => {
        onChunk(API_SUCCESS.rawText);
        if (win && !win.isDestroyed() && chunkEvent) {
            win.webContents.send(chunkEvent, API_SUCCESS.rawText);
        }
        return { inputTokens: API_SUCCESS.inputTokens, outputTokens: API_SUCCESS.outputTokens };
    });
});

function invoke(channel, ...args) {
    return ipcMain._invoke(channel, { sender: {} }, ...args);
}

// ─────────────────────────────────────────────────────────────────────────────
// build-generate — input validation
// ─────────────────────────────────────────────────────────────────────────────

describe('build-generate — input validation', () => {
    it('rejects empty keyword', async () => {
        const r = await invoke('build-generate', { ...VALID_PARAMS, keyword: '' });
        expect(r.error).toBeTruthy();
        expect(streamWithRetry).not.toHaveBeenCalled();
    });

    it('rejects whitespace-only keyword', async () => {
        const r = await invoke('build-generate', { ...VALID_PARAMS, keyword: '   ' });
        expect(r.error).toBeTruthy();
        expect(streamWithRetry).not.toHaveBeenCalled();
    });

    it('rejects keyword over 500 chars', async () => {
        const r = await invoke('build-generate', { ...VALID_PARAMS, keyword: 'k'.repeat(501) });
        expect(r.error).toBeTruthy();
    });

    it('rejects description over 2000 chars', async () => {
        const r = await invoke('build-generate', { ...VALID_PARAMS, description: 'd'.repeat(2001) });
        expect(r.error).toBeTruthy();
    });

    it('rejects sections that is not an array', async () => {
        const r = await invoke('build-generate', { ...VALID_PARAMS, sections: 'not-array' });
        expect(r.error).toBeTruthy();
    });

    it('rejects sections with fewer than 2 items', async () => {
        const r = await invoke('build-generate', { ...VALID_PARAMS, sections: ['Only One'] });
        expect(r.error).toBeTruthy();
    });

    it('rejects sections with more than 10 items', async () => {
        const r = await invoke('build-generate', { ...VALID_PARAMS, sections: new Array(11).fill('Section') });
        expect(r.error).toBeTruthy();
    });

    it('rejects a blank section name', async () => {
        const r = await invoke('build-generate', { ...VALID_PARAMS, sections: ['Valid', '   '] });
        expect(r.error).toBeTruthy();
    });

    it('rejects a section name over 100 chars', async () => {
        const r = await invoke('build-generate', { ...VALID_PARAMS, sections: ['Valid', 's'.repeat(101)] });
        expect(r.error).toBeTruthy();
    });

    it('rejects maxTokens below 1024', async () => {
        const r = await invoke('build-generate', { ...VALID_PARAMS, maxTokens: 512 });
        expect(r.error).toBeTruthy();
    });

    it('rejects maxTokens above 32768', async () => {
        const r = await invoke('build-generate', { ...VALID_PARAMS, maxTokens: 40000 });
        expect(r.error).toBeTruthy();
    });

    it('accepts null maxTokens (uses default)', async () => {
        const r = await invoke('build-generate', { ...VALID_PARAMS, maxTokens: null });
        expect(r.error).toBeUndefined();
    });

    it('validation fires before mutex — rejected params never block subsequent valid calls', async () => {
        const bad = await invoke('build-generate', { ...VALID_PARAMS, keyword: '' });
        expect(bad.error).toBeTruthy();
        // A valid call must succeed immediately (not blocked by mutex)
        const good = await invoke('build-generate', VALID_PARAMS);
        expect(good.ok).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// build-generate — auth / provider
// ─────────────────────────────────────────────────────────────────────────────

describe('build-generate — auth', () => {
    it('returns no_key when cipher is missing', async () => {
        getSetting.mockImplementation((key) => {
            if (key === 'provider') return 'anthropic';
            return null; // no cipher
        });
        const r = await invoke('build-generate', VALID_PARAMS);
        expect(r.error).toBe('no_key');
    });

    it('returns no_key when decryptKey returns null', async () => {
        decryptKey.mockReturnValue(null);
        const r = await invoke('build-generate', VALID_PARAMS);
        expect(r.error).toBe('no_key');
    });

    it('uses openai provider when saved setting is openai', async () => {
        getSetting.mockImplementation((key) => {
            const map = {
                provider:              'openai',
                api_key_cipher_openai: 'openai_cipher',
                openai_model:          'gpt-4o',
                privacy_mode:          'false',
            };
            return map[key] ?? null;
        });
        decryptKey.mockReturnValue('sk-openai-key');

        const r = await invoke('build-generate', VALID_PARAMS);
        expect(r.ok).toBe(true);
        expect(streamWithRetry).toHaveBeenCalledWith(
            expect.objectContaining({ provider: 'openai', key: 'sk-openai-key' })
        );
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// build-generate — successful generation
// ─────────────────────────────────────────────────────────────────────────────

describe('build-generate — success', () => {
    it('returns ok:true with rawText and token counts', async () => {
        const r = await invoke('build-generate', VALID_PARAMS);
        expect(r.ok).toBe(true);
        expect(r.rawText).toBe(API_SUCCESS.rawText);
        expect(r.inputTokens).toBe(API_SUCCESS.inputTokens);
        expect(r.outputTokens).toBe(API_SUCCESS.outputTokens);
    });

    it('sends a build-chunk event to the renderer window', async () => {
        await invoke('build-generate', VALID_PARAMS);
        expect(mockWin.webContents.send).toHaveBeenCalledWith('build-chunk', API_SUCCESS.rawText);
    });

    it('returns skillName equal to the keyword', async () => {
        const r = await invoke('build-generate', VALID_PARAMS);
        expect(r.skillName).toBe(VALID_PARAMS.keyword);
    });

    it('returns a numeric costUsd', async () => {
        const r = await invoke('build-generate', VALID_PARAMS);
        expect(typeof r.costUsd).toBe('number');
        expect(r.costUsd).toBeGreaterThanOrEqual(0);
    });

    it('saves to history when privacy mode is off', async () => {
        await invoke('build-generate', VALID_PARAMS);
        expect(insertHistory).toHaveBeenCalledWith(
            expect.objectContaining({ skill_name: 'cpp-expert', status: 'success' })
        );
    });

    it('does NOT save to history when privacy mode is on', async () => {
        getSetting.mockImplementation((key) => {
            if (key === 'provider')                   return 'anthropic';
            if (key === 'api_key_cipher_anthropic')   return 'cipher_blob';
            if (key === 'anthropic_model')             return 'claude-sonnet-4-20250514';
            if (key === 'privacy_mode')                return 'true';
            return null;
        });
        await invoke('build-generate', VALID_PARAMS);
        expect(insertHistory).not.toHaveBeenCalled();
    });

    it('accepts 2-section minimum', async () => {
        const r = await invoke('build-generate', { ...VALID_PARAMS, sections: ['Section A', 'Section B'] });
        expect(r.ok).toBe(true);
    });

    it('accepts 10-section maximum', async () => {
        const sections = Array.from({ length: 10 }, (_, i) => `Section ${i + 1}`);
        const r = await invoke('build-generate', { ...VALID_PARAMS, sections });
        expect(r.ok).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// build-generate — mutex / concurrency
// ─────────────────────────────────────────────────────────────────────────────

describe('build-generate — mutex', () => {
    it('blocks a concurrent call with generation_in_progress', async () => {
        let resolveCall;
        streamWithRetry.mockReturnValueOnce(new Promise(r => { resolveCall = r; }));

        const p1 = invoke('build-generate', VALID_PARAMS);
        // Allow the first call to acquire the mutex
        await new Promise(r => setImmediate(r));

        const r2 = await invoke('build-generate', VALID_PARAMS);
        expect(r2.error).toBe('generation_in_progress');

        resolveCall({ inputTokens: API_SUCCESS.inputTokens, outputTokens: API_SUCCESS.outputTokens });
        await p1;
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// build-generate — API errors
// ─────────────────────────────────────────────────────────────────────────────

describe('build-generate — API errors', () => {
    it('returns an error code on HTTP 401', async () => {
        const err = new Error('HTTP 401');
        err.statusCode = 401;
        streamWithRetry.mockRejectedValueOnce(err);
        const r = await invoke('build-generate', VALID_PARAMS);
        expect(r.ok).toBe(false);
        expect(r.error).toBe('api_401');
    });

    it('returns an error code on HTTP 429', async () => {
        const err = new Error('HTTP 429');
        err.statusCode = 429;
        streamWithRetry.mockRejectedValueOnce(err);
        const r = await invoke('build-generate', VALID_PARAMS);
        expect(r.ok).toBe(false);
        expect(r.error).toBe('api_429');
    });

    it('returns an error code on HTTP 500', async () => {
        const err = new Error('HTTP 500');
        err.statusCode = 500;
        streamWithRetry.mockRejectedValueOnce(err);
        const r = await invoke('build-generate', VALID_PARAMS);
        expect(r.ok).toBe(false);
        expect(r.error).toBe('api_5xx');
    });

    it('does NOT save to history on API error', async () => {
        const err = new Error('HTTP 500');
        err.statusCode = 500;
        streamWithRetry.mockRejectedValueOnce(err);
        await invoke('build-generate', VALID_PARAMS);
        expect(insertHistory).not.toHaveBeenCalled();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// build-stop
// ─────────────────────────────────────────────────────────────────────────────

describe('build-stop', () => {
    it('returns ok:true', async () => {
        const r = await invoke('build-stop');
        expect(r).toEqual({ ok: true });
    });

    it('can be called multiple times without error', async () => {
        await invoke('build-stop');
        await invoke('build-stop');
        const r = await invoke('build-stop');
        expect(r).toEqual({ ok: true });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// suggest-sections
// ─────────────────────────────────────────────────────────────────────────────

describe('suggest-sections', () => {
    it('returns no_key when cipher is missing', async () => {
        getSetting.mockImplementation((key) => {
            if (key === 'provider') return 'anthropic';
            return null;
        });
        const r = await invoke('suggest-sections', { keyword: 'sql-expert', description: '', sectionCount: 5 });
        expect(r.error).toBe('no_key');
    });

    it('returns error for empty keyword', async () => {
        const r = await invoke('suggest-sections', { keyword: '', description: '', sectionCount: 5 });
        expect(r.error).toBeTruthy();
    });

    it('returns error for keyword over 500 chars', async () => {
        const r = await invoke('suggest-sections', { keyword: 'k'.repeat(501), description: '', sectionCount: 5 });
        expect(r.error).toBeTruthy();
    });

    it('returns ok:true with suggestions on success', async () => {
        callApi.mockResolvedValueOnce({
            rawText:      'Core Concepts\nAdvanced Topics\nBest Practices\nPerformance\nDebugging',
            inputTokens:  50,
            outputTokens: 20,
        });
        const r = await invoke('suggest-sections', { keyword: 'sql-expert', description: 'SQL tuning', sectionCount: 5 });
        expect(r.ok).toBe(true);
        expect(Array.isArray(r.suggestions)).toBe(true);
    });

    it('returns suggestion_failed on API error', async () => {
        const err = new Error('HTTP 500');
        err.statusCode = 500;
        callApi.mockRejectedValueOnce(err);
        const r = await invoke('suggest-sections', { keyword: 'sql-expert', description: '', sectionCount: 5 });
        expect(r.error).toBe('suggestion_failed');
    });

    it('clamps sectionCount to [2, 10]', async () => {
        callApi.mockResolvedValueOnce({ rawText: 'A\nB', inputTokens: 10, outputTokens: 5 });
        // sectionCount=99 should be clamped to 10 without error
        const r = await invoke('suggest-sections', { keyword: 'sql-expert', description: '', sectionCount: 99 });
        expect(r.ok).toBe(true);
    });
});
