'use strict';

jest.mock('electron');
jest.mock('fs');
jest.mock('../../main/db/settings');
jest.mock('../../main/storage');

const { ipcMain, dialog }    = require('electron');
const fs                     = require('fs');
const path                   = require('path');
const { getSetting }         = require('../../main/db/settings');
const { decryptKey }         = require('../../main/storage');

// ── Fixtures ──

const VALID_SKILL_MD = `---
name: test-skill
description: A test skill.
version: 1
framework: claude
---

# test-skill

## Instructions
1. Do something useful.

## Hard rules
- ALWAYS verify output.
- NEVER skip validation.
`;

const VALID_PATH = path.join('C:', 'skills', 'test-skill.md');

// Minimal valid AI response
function _makeOpenClawJson(overrides = {}) {
    return JSON.stringify({
        openclaw: {
            emoji:  overrides.emoji   ?? '🧠',
            always: overrides.always  ?? true,
            ...( overrides.requires ? { requires: overrides.requires } : {} ),
        },
    });
}

// ── API mock helpers ──

function _mockFetchSuccess(responseText) {
    global.fetch = jest.fn(() =>
        Promise.resolve({
            ok:     true,
            status: 200,
            json:   () => Promise.resolve({
                content: [{ text: responseText }],
                usage:   { input_tokens: 100, output_tokens: 200 },
            }),
        })
    );
}

function _mockFetchError(statusCode) {
    global.fetch = jest.fn(() =>
        Promise.resolve({
            ok:     false,
            status: statusCode,
            json:   () => Promise.resolve({ error: 'API error' }),
        })
    );
}

// ── Setup ──

beforeAll(() => {
    ipcMain._reset();
    require('../../ipc/openclaw').register();
});

beforeEach(() => {
    jest.clearAllMocks();

    getSetting.mockImplementation((key) => {
        if (key === 'provider')                 return 'anthropic';
        if (key === 'api_key_cipher_anthropic')  return 'encrypted_key';
        if (key === 'anthropic_model')           return 'claude-sonnet-4-20250514';
        if (key === 'max_tokens')               return '4096';
        return null;
    });
    decryptKey.mockReturnValue('sk-ant-test-key-123');

    // Default fs behaviour: file exists and is readable
    fs.statSync.mockReturnValue({ size: 500 });
    fs.readFileSync.mockReturnValue(VALID_SKILL_MD);
    fs.existsSync.mockReturnValue(false);
    fs.mkdirSync.mockImplementation(() => {});
    fs.writeFileSync.mockImplementation(() => {});
    fs.renameSync.mockImplementation(() => {});
    fs.unlinkSync.mockImplementation(() => {});
    fs.readdirSync.mockReturnValue([]);

    global.fetch = undefined;
});

function invoke(channel, ...args) {
    return ipcMain._invoke(channel, { sender: { send: jest.fn() } }, ...args);
}

// ─────────────────────────────────────────────────────────────────────────────
// openclaw-load-file
// ─────────────────────────────────────────────────────────────────────────────

describe('openclaw-load-file', () => {
    it('returns invalid_path for non-string argument', async () => {
        const r = await invoke('openclaw-load-file', 42);
        expect(r.error).toBe('invalid_path');
    });

    it('returns invalid_extension for non-.md file', async () => {
        const r = await invoke('openclaw-load-file', 'C:\\path\\to\\script.py');
        expect(r.error).toBe('invalid_extension');
        expect(fs.statSync).not.toHaveBeenCalled();
    });

    it('returns TOO_LARGE for files over 1 MB', async () => {
        fs.statSync.mockReturnValue({ size: 1024 * 1024 + 1 });
        const r = await invoke('openclaw-load-file', VALID_PATH);
        expect(r.error).toBe('TOO_LARGE');
    });

    it('returns parsed file data for a valid .md file', async () => {
        const r = await invoke('openclaw-load-file', VALID_PATH);
        expect(r.ok).toBe(true);
        expect(r.name).toBe('test-skill');
        expect(r.safeName).toBe('test-skill');
        expect(typeof r.meta).toBe('object');
        expect(typeof r.body).toBe('string');
        expect(r.filePath).toBe(VALID_PATH);
    });

    it('derives name from filename when frontmatter has no name', async () => {
        fs.readFileSync.mockReturnValue('---\ndescription: no name field\n---\nbody');
        const r = await invoke('openclaw-load-file', path.join('C:', 'my-skill.md'));
        expect(r.ok).toBe(true);
        expect(r.name).toBe('my-skill');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// openclaw-convert
// ─────────────────────────────────────────────────────────────────────────────

describe('openclaw-convert', () => {
    it('returns ok:true with convertedMd on success', async () => {
        _mockFetchSuccess(_makeOpenClawJson());

        const r = await invoke('openclaw-convert', { filePath: VALID_PATH });
        expect(r.ok).toBe(true);
        expect(typeof r.convertedMd).toBe('string');
        expect(r.convertedMd).toContain('user-invocable: true');
        expect(r.convertedMd).toContain('metadata:');
    });

    it('includes emoji in metadata', async () => {
        _mockFetchSuccess(_makeOpenClawJson({ emoji: '🔧' }));
        const r = await invoke('openclaw-convert', { filePath: VALID_PATH });
        expect(r.ok).toBe(true);
        expect(r.metadataJson).toContain('"emoji":"🔧"');
    });

    it('returns costUsd > 0 on success', async () => {
        _mockFetchSuccess(_makeOpenClawJson());
        const r = await invoke('openclaw-convert', { filePath: VALID_PATH });
        expect(r.ok).toBe(true);
        expect(typeof r.costUsd).toBe('number');
        expect(r.costUsd).toBeGreaterThan(0);
    });

    it('returns inputTokens and outputTokens', async () => {
        _mockFetchSuccess(_makeOpenClawJson());
        const r = await invoke('openclaw-convert', { filePath: VALID_PATH });
        expect(r.inputTokens).toBe(100);
        expect(r.outputTokens).toBe(200);
    });

    it('preserves original frontmatter keys in convertedMd', async () => {
        _mockFetchSuccess(_makeOpenClawJson());
        const r = await invoke('openclaw-convert', { filePath: VALID_PATH });
        expect(r.convertedMd).toContain('name: test-skill');
        expect(r.convertedMd).toContain('framework: claude');
        expect(r.convertedMd).toContain('version: 1');
    });

    it('returns no_key when API key is missing', async () => {
        getSetting.mockImplementation((key) => {
            if (key === 'provider') return 'anthropic';
            return null;
        });
        const r = await invoke('openclaw-convert', { filePath: VALID_PATH });
        expect(r.error).toBe('no_key');
    });

    it('returns invalid_params for non-string filePath', async () => {
        const r = await invoke('openclaw-convert', { filePath: 42 });
        expect(r.error).toBe('invalid_params');
    });

    it('returns ai_parse_failed when AI returns non-JSON', async () => {
        _mockFetchSuccess('This is not JSON at all!');
        const r = await invoke('openclaw-convert', { filePath: VALID_PATH });
        expect(r.error).toBe('ai_parse_failed');
    });

    it('returns ai_invalid_shape when AI returns wrong structure', async () => {
        _mockFetchSuccess('{"wrong":{"key":"value"}}');
        const r = await invoke('openclaw-convert', { filePath: VALID_PATH });
        expect(r.error).toBe('ai_invalid_shape');
    });

    it('strips markdown fences from AI response', async () => {
        _mockFetchSuccess('```json\n' + _makeOpenClawJson() + '\n```');
        const r = await invoke('openclaw-convert', { filePath: VALID_PATH });
        expect(r.ok).toBe(true);
    });

    it('falls back to 🧩 emoji when AI returns invalid emoji', async () => {
        _mockFetchSuccess(JSON.stringify({ openclaw: { emoji: 'not-emoji' } }));
        const r = await invoke('openclaw-convert', { filePath: VALID_PATH });
        expect(r.ok).toBe(true);
        expect(r.metadataJson).toContain('"emoji":"🧩"');
    });

    it('fails gracefully on API 401 error', async () => {
        _mockFetchError(401);
        const r = await invoke('openclaw-convert', { filePath: VALID_PATH });
        expect(r.error).toBe('api_401');
    });

    it('fails gracefully on API 429 error', async () => {
        _mockFetchError(429);
        const r = await invoke('openclaw-convert', { filePath: VALID_PATH });
        expect(r.error).toBe('api_429');
    });

    it('re-reads the skill from disk (does not trust renderer body)', async () => {
        fs.readFileSync.mockReturnValue(VALID_SKILL_MD);
        _mockFetchSuccess(_makeOpenClawJson());

        const r = await invoke('openclaw-convert', { filePath: VALID_PATH });
        expect(r.ok).toBe(true);
        expect(fs.readFileSync).toHaveBeenCalledWith(VALID_PATH, { encoding: 'utf8' });
    });

    it('serialises concurrent convert calls via shared mutex', async () => {
        let callCount = 0;
        global.fetch = jest.fn(() => new Promise(resolve => {
            callCount++;
            setTimeout(() => {
                resolve({
                    ok:     true,
                    status: 200,
                    json:   () => Promise.resolve({
                        content: [{ text: _makeOpenClawJson() }],
                        usage:   { input_tokens: 10, output_tokens: 20 },
                    }),
                });
            }, 10);
        }));

        const [r1, r2] = await Promise.all([
            invoke('openclaw-convert', { filePath: VALID_PATH }),
            invoke('openclaw-convert', { filePath: VALID_PATH }),
        ]);

        const results   = [r1, r2];
        const successes = results.filter(r => r.ok);
        const blocked   = results.filter(r => !r.ok);
        expect(successes.length).toBe(1);
        expect(blocked.length).toBe(1);
        expect(blocked[0].error).toMatch(/generation_in_progress/);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// openclaw-stop
// ─────────────────────────────────────────────────────────────────────────────

describe('openclaw-stop', () => {
    it('returns ok:true when no conversion is running', async () => {
        const r = await invoke('openclaw-stop');
        expect(r).toEqual({ ok: true });
    });

    it('is a harmless no-op after a completed conversion', async () => {
        _mockFetchSuccess(_makeOpenClawJson());
        await invoke('openclaw-convert', { filePath: VALID_PATH });

        const stopResult = await invoke('openclaw-stop');
        expect(stopResult).toEqual({ ok: true });

        // Mutex was released — next convert should succeed
        _mockFetchSuccess(_makeOpenClawJson());
        const second = await invoke('openclaw-convert', { filePath: VALID_PATH });
        expect(second.ok).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// openclaw-save
// ─────────────────────────────────────────────────────────────────────────────

describe('openclaw-save', () => {
    const CONTENT = '---\nname: test-skill\nuser-invocable: true\nmetadata: "{}"\n---\nbody';
    const OUTPUT_DIR = path.resolve('C:', 'output');

    beforeEach(() => {
        dialog.showOpenDialog.mockResolvedValue({
            canceled:  false,
            filePaths: [OUTPUT_DIR],
        });
    });

    it('returns cancelled when dialog is dismissed', async () => {
        dialog.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
        const r = await invoke('openclaw-save', { safeName: 'test-skill', content: CONTENT });
        expect(r.error).toBe('cancelled');
    });

    it('returns invalid_params for empty content', async () => {
        const r = await invoke('openclaw-save', { safeName: 'test-skill', content: '' });
        expect(r.error).toBe('invalid_params');
    });

    it('re-validates safeName (never trusts renderer)', async () => {
        const r = await invoke('openclaw-save', { safeName: 'test skill with spaces', content: CONTENT });
        expect(r.ok).toBe(true);
        // safeName was sanitised — path uses hyphenated form
        expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('returns EEXIST when file already exists', async () => {
        fs.existsSync.mockReturnValue(true);
        const r = await invoke('openclaw-save', { safeName: 'test-skill', content: CONTENT });
        expect(r.error).toBe('EEXIST');
    });

    it('writes file atomically on success', async () => {
        const r = await invoke('openclaw-save', { safeName: 'test-skill', content: CONTENT });
        expect(r.ok).toBe(true);
        expect(r.destPath).toContain('test-skill');
        expect(r.destPath).toContain('SKILL.md');
        expect(fs.writeFileSync).toHaveBeenCalled();
        expect(fs.renameSync).toHaveBeenCalled();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// openclaw-save-overwrite
// ─────────────────────────────────────────────────────────────────────────────

describe('openclaw-save-overwrite', () => {
    const CONTENT = '---\nname: test-skill\nuser-invocable: true\nmetadata: "{}"\n---\nbody';
    const OUTPUT_DIR = path.resolve('C:', 'output');

    beforeEach(() => {
        dialog.showOpenDialog.mockResolvedValue({
            canceled:  false,
            filePaths: [OUTPUT_DIR],
        });
    });

    it('overwrites existing file without EEXIST error', async () => {
        fs.existsSync.mockReturnValue(true); // file exists but overwrite is ok
        const r = await invoke('openclaw-save-overwrite', { safeName: 'test-skill', content: CONTENT });
        expect(r.ok).toBe(true);
        expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('returns cancelled when dialog is dismissed', async () => {
        dialog.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
        const r = await invoke('openclaw-save-overwrite', { safeName: 'test-skill', content: CONTENT });
        expect(r.error).toBe('cancelled');
    });
});
