'use strict';

jest.mock('electron');
jest.mock('../../main/db/settings');
jest.mock('../../main/db/history');
jest.mock('../../main/storage');
jest.mock('../../main/stream');

const { ipcMain, BrowserWindow } = require('electron');
const { getSetting }             = require('../../main/db/settings');
const { decryptKey }             = require('../../main/storage');
const { insertHistory }          = require('../../main/db/history');
const { streamWithRetry }        = require('../../main/stream');

const { register, _resetForTesting } = require('../../ipc/generate');

const mockWin = BrowserWindow._mockWin;

beforeAll(() => {
    ipcMain._reset();
    register();
});

beforeEach(() => {
    jest.clearAllMocks();
    _resetForTesting();

    // Default: anthropic provider, key present, privacy off
    getSetting.mockImplementation((key) => {
        const map = {
            provider:                 'anthropic',
            anthropic_model:          'claude-sonnet-4-20250514',
            api_key_cipher_anthropic: 'cipher_blob',
            privacy_mode:             'false',
        };
        return map[key] ?? null;
    });
    decryptKey.mockReturnValue('sk-ant-real-key');
    streamWithRetry.mockResolvedValue({ inputTokens: 100, outputTokens: 50 });
    insertHistory.mockReturnValue(1);
    mockWin.webContents.send.mockClear();
    mockWin.isDestroyed.mockReturnValue(false);
});

function invoke(channel, ...args) {
    return ipcMain._invoke(channel, { sender: {} }, ...args);
}

// ── Mutex / concurrency ────────────────────────────────────────────────────────

describe('generate mutex', () => {
    it('returns generation_in_progress if already generating', async () => {
        // Start a generation that won't resolve immediately
        let resolveStream;
        streamWithRetry.mockReturnValue(new Promise(r => { resolveStream = r; }));

        const validForm = {
            skillName: 'My Skill',
            whenToUse: 'Use when you need to do something specific and useful.',
            exampleRequests: ['Do the thing'],
            framework: 'claude',
        };

        const p1 = invoke('generate', validForm);
        // Give first call time to set mutex
        await new Promise(r => setImmediate(r));

        const r2 = await invoke('generate', validForm);
        expect(r2).toEqual({ error: 'generation_in_progress' });

        resolveStream({ inputTokens: 0, outputTokens: 0 });
        await p1;
    });

    it('returns invalid_params for null formData', async () => {
        const result = await invoke('generate', null);
        expect(result).toEqual({ error: 'invalid_params' });
    });

    it('returns invalid_params for non-object formData', async () => {
        const result = await invoke('generate', 'bad');
        expect(result).toEqual({ error: 'invalid_params' });
    });
});

// ── _aborted flag reset (time bomb fix) ──────────────────────────────────────

describe('_aborted flag reset after generation', () => {
    it('resets _aborted to false in finally block so next generation is not poisoned', async () => {
        // Simulate a stopped generation: streamWithRetry throws AbortError
        const abortErr = Object.assign(new Error('AbortError'), { name: 'AbortError' });
        streamWithRetry.mockRejectedValueOnce(abortErr);

        const validForm = {
            skillName: 'My Skill',
            whenToUse: 'Use when you need to do something specific and useful.',
            exampleRequests: ['Do the thing'],
            framework: 'claude',
        };

        await invoke('generate', validForm);

        // After abort, _aborted must have been reset — next generation must run normally
        streamWithRetry.mockResolvedValueOnce({ inputTokens: 10, outputTokens: 5 });
        const r2 = await invoke('generate', validForm);
        // If _aborted was not reset, stream exits immediately as partial and returns ok:true
        // But we also need it to not fail with generation_in_progress
        expect(r2).toEqual({ ok: true });
        // streamWithRetry should have been called for second generation
        expect(streamWithRetry).toHaveBeenCalledTimes(2);
    });

    it('resets mutex after a normal successful generation', async () => {
        streamWithRetry.mockResolvedValue({ inputTokens: 100, outputTokens: 50 });

        const validForm = {
            skillName: 'Test Skill',
            whenToUse: 'Use when you need to run a test and verify something.',
            exampleRequests: ['Run a test'],
            framework: 'claude',
        };

        await invoke('generate', validForm);
        // Second call should succeed (not get generation_in_progress)
        const r2 = await invoke('generate', validForm);
        expect(r2).not.toEqual({ error: 'generation_in_progress' });
    });
});

// ── Form validation at IPC boundary ──────────────────────────────────────────

describe('IPC-level form validation', () => {
    it('returns validation_failed for missing skillName', async () => {
        const result = await invoke('generate', {
            skillName:       '',
            whenToUse:       'Use when needed for a specific purpose.',
            exampleRequests: ['Do the thing'],
            framework:       'claude',
        });
        expect(result.error).toBe('validation_failed');
        expect(result.errors).toBeDefined();
        expect(result.errors.length).toBeGreaterThan(0);
        // Must not have started the stream
        expect(streamWithRetry).not.toHaveBeenCalled();
    });

    it('returns validation_failed for invalid framework', async () => {
        const result = await invoke('generate', {
            skillName:       'My Skill',
            whenToUse:       'Use when you need to accomplish something specific.',
            exampleRequests: ['Do it'],
            framework:       'gemini',
        });
        expect(result.error).toBe('validation_failed');
        expect(streamWithRetry).not.toHaveBeenCalled();
    });

    it('returns validation_failed for empty exampleRequests', async () => {
        const result = await invoke('generate', {
            skillName:       'My Skill',
            whenToUse:       'Use when you need to accomplish something specific.',
            exampleRequests: [],
            framework:       'claude',
        });
        expect(result.error).toBe('validation_failed');
        expect(streamWithRetry).not.toHaveBeenCalled();
    });

    it('skips form validation for isTest payloads', async () => {
        streamWithRetry.mockResolvedValue({ inputTokens: 5, outputTokens: 10 });
        // Test payloads have different shape — no skillName etc.
        const result = await invoke('generate', {
            isTest:       true,
            systemPrompt: 'You are a helpful assistant.',
            testMessage:  'Hello',
        });
        // Should not return validation_failed for isTest
        expect(result.error).not.toBe('validation_failed');
    });

    it('does not lock mutex permanently after validation_failed', async () => {
        // validation_failed should return early without setting _generating
        await invoke('generate', {
            skillName: '', whenToUse: '', exampleRequests: [], framework: 'claude',
        });

        // Mutex must still be free — valid form should now generate
        streamWithRetry.mockResolvedValue({ inputTokens: 10, outputTokens: 5 });
        const r2 = await invoke('generate', {
            skillName:       'Real Skill',
            whenToUse:       'Use when you need to do something specific and real.',
            exampleRequests: ['Do the real thing'],
            framework:       'claude',
        });
        expect(r2).not.toEqual({ error: 'generation_in_progress' });
    });
});

// ── No API key ────────────────────────────────────────────────────────────────

describe('no API key', () => {
    it('sends no_key stream-end event and returns ok:true', async () => {
        decryptKey.mockReturnValue(null);
        getSetting.mockImplementation((key) => {
            if (key === 'provider') return 'anthropic';
            if (key === 'anthropic_model') return 'claude-sonnet-4-20250514';
            if (key === 'api_key_cipher_anthropic') return null;
            return null;
        });

        const result = await invoke('generate', {
            skillName:       'My Skill',
            whenToUse:       'Use when you need to accomplish something specific.',
            exampleRequests: ['Do the thing'],
            framework:       'claude',
        });

        expect(result).toEqual({ ok: true });
        expect(mockWin.webContents.send).toHaveBeenCalledWith(
            'stream-end',
            expect.objectContaining({ ok: false, error: 'no_key' })
        );
        expect(streamWithRetry).not.toHaveBeenCalled();
    });
});

// ── stop-generation ───────────────────────────────────────────────────────────

describe('stop-generation', () => {
    it('returns ok:true', async () => {
        const result = await invoke('stop-generation');
        expect(result).toEqual({ ok: true });
    });
});
