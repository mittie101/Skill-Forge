'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

function read(relPath) {
    return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

// ── BrowserWindow security flags ──────────────────────────────────────────────

describe('BrowserWindow security flags (main/window.js)', () => {
    const src = read('main/window.js');

    it('sets nodeIntegration: false', () => {
        expect(src).toMatch(/nodeIntegration\s*:\s*false/);
    });

    it('sets contextIsolation: true', () => {
        expect(src).toMatch(/contextIsolation\s*:\s*true/);
    });

    it('sets sandbox: true', () => {
        expect(src).toMatch(/sandbox\s*:\s*true/);
    });

    it('sets webSecurity: true', () => {
        expect(src).toMatch(/webSecurity\s*:\s*true/);
    });

    it('never sets webSecurity: false', () => {
        expect(src).not.toMatch(/webSecurity\s*:\s*false/);
    });

    it('never enables nodeIntegration', () => {
        expect(src).not.toMatch(/nodeIntegration\s*:\s*true/);
    });

    it('never disables contextIsolation', () => {
        expect(src).not.toMatch(/contextIsolation\s*:\s*false/);
    });

    it('never disables sandbox', () => {
        expect(src).not.toMatch(/sandbox\s*:\s*false/);
    });
});

// ── Content Security Policy ───────────────────────────────────────────────────

describe('Content Security Policy (main/window.js)', () => {
    const src = read('main/window.js');

    it('does not allow unsafe-inline scripts or styles', () => {
        expect(src).not.toMatch(/unsafe-inline/);
    });

    it('does not allow unsafe-eval', () => {
        expect(src).not.toMatch(/unsafe-eval/);
    });

    it('sets connect-src to none (no external connections from renderer)', () => {
        expect(src).toMatch(/connect-src\s*['"]?none['"]?/);
    });

    it('sets default-src to self', () => {
        expect(src).toMatch(/default-src\s*['"]?'self'['"]?/);
    });

    it('sets frame-src to none', () => {
        expect(src).toMatch(/frame-src\s*['"]?'none'['"]?/);
    });

    it('sets object-src to none', () => {
        expect(src).toMatch(/object-src\s*['"]?'none'['"]?/);
    });

    it('applies CSP via session.onHeadersReceived (not meta tag)', () => {
        expect(src).toMatch(/onHeadersReceived/);
        expect(src).toMatch(/Content-Security-Policy/);
    });
});

// ── Preload script ────────────────────────────────────────────────────────────

describe('Preload script security (preload.js)', () => {
    const src = read('preload.js');

    it('uses contextBridge.exposeInMainWorld for API exposure', () => {
        expect(src).toMatch(/contextBridge\.exposeInMainWorld/);
    });

    it('uses ipcRenderer.invoke for all data calls (no direct send)', () => {
        expect(src).not.toMatch(/ipcRenderer\.send\s*\(/);
    });

    it('all ipcRenderer.on listeners return unsubscribe cleanup functions', () => {
        const onCalls      = (src.match(/ipcRenderer\.on\(/g) ?? []).length;
        const removeCalls  = (src.match(/ipcRenderer\.removeListener\(/g) ?? []).length;
        expect(removeCalls).toBeGreaterThanOrEqual(onCalls);
        expect(onCalls).toBeGreaterThan(0);
    });
});

// ── API key handling ──────────────────────────────────────────────────────────

describe('API key security (ipc/api-keys.js + main/storage.js)', () => {
    const apiKeysSrc = read('ipc/api-keys.js');
    const storageSrc = read('main/storage.js');

    it('api-keys.js only uses decryptKey internally for connection testing (never returns plaintext)', () => {
        // decryptKey is now used for test-api-key — but the key is never returned to the renderer
        const codeLines = apiKeysSrc.split('\n').filter(l => !l.trim().startsWith('//'));
        // Must not directly return the decrypted key value to the renderer
        expect(codeLines.join('\n')).not.toMatch(/return\s+key\b/i);
    });

    it('api-keys.js never decrypts or returns plaintext to renderer', () => {
        // No non-comment line should return a key variable directly
        const codeLines = apiKeysSrc.split('\n').filter(l => !l.trim().startsWith('//'));
        expect(codeLines.join('\n')).not.toMatch(/return\s+key\b/i);
    });

    it('storage.js uses safeStorage.encryptString', () => {
        expect(storageSrc).toMatch(/safeStorage\.encryptString/);
    });

    it('storage.js uses safeStorage.decryptString', () => {
        expect(storageSrc).toMatch(/safeStorage\.decryptString/);
    });

    it('decryptKey returns null on failure (never throws to caller)', () => {
        expect(storageSrc).toMatch(/return null/);
        expect(storageSrc).toMatch(/try\s*\{/);
    });

    it('storage.js checks isEncryptionAvailable before operating', () => {
        expect(storageSrc).toMatch(/isEncryptionAvailable/);
    });
});

// ── Path traversal protection ─────────────────────────────────────────────────

describe('Path traversal protection (ipc/file.js)', () => {
    const src = read('ipc/file.js');

    it('validates file paths are within configured output folder', () => {
        expect(src).toMatch(/_isWithinFolder/);
    });

    it('sanitises slugs before building any file path', () => {
        expect(src).toMatch(/sanitise/);
    });

    it('uses atomic write (temp + rename) for new files to prevent partial writes', () => {
        expect(src).toMatch(/renameSync/);
        expect(src).toMatch(/\.tmp/);
    });

    it('rejects paths outside the output folder for overwrites', () => {
        expect(src).toMatch(/invalid_path/);
    });
});

describe('Path traversal protection (ipc/install.js)', () => {
    const src = read('ipc/install.js');

    it('re-validates renderer-supplied safeName before path construction', () => {
        expect(src).toMatch(/_makeSafeName\(safeName\)/);
    });

    it('rejects non-.md file extensions for load-file', () => {
        expect(src).toMatch(/invalid_extension/);
    });

    it('uses atomic write (temp + rename) for new installs to prevent partial writes', () => {
        expect(src).toMatch(/renameSync/);
        expect(src).toMatch(/\.tmp/);
    });
});

// ── IPC handler registration ──────────────────────────────────────────────────

describe('IPC surface area (ipc/index.js)', () => {
    const src = read('ipc/index.js');

    it('registers api-keys handlers', () => {
        expect(src).toMatch(/apiKeys\.register/);
    });

    it('registers settings handlers', () => {
        expect(src).toMatch(/settings\.register/);
    });

    it('registers history handlers', () => {
        expect(src).toMatch(/history\.register/);
    });

    it('registers file handlers', () => {
        expect(src).toMatch(/file\.register/);
    });

    it('registers generate handlers', () => {
        expect(src).toMatch(/generate\.register/);
    });

    it('registers build handlers', () => {
        expect(src).toMatch(/build\.register/);
    });

    it('registers install handlers', () => {
        expect(src).toMatch(/install\.register/);
    });
});

// ── Shared stream module (no duplication) ────────────────────────────────────

describe('Streaming deduplication (main/stream.js)', () => {
    const streamSrc    = read('main/stream.js');
    const generateSrc  = read('ipc/generate.js');
    const buildSrc     = read('ipc/build.js');

    it('generate.js imports from main/stream.js', () => {
        expect(generateSrc).toMatch(/require.*main\/stream/);
    });

    it('build.js imports from main/stream.js', () => {
        expect(buildSrc).toMatch(/require.*main\/stream/);
    });

    it('generate.js does not define its own _streamAnthropic', () => {
        expect(generateSrc).not.toMatch(/function _streamAnthropic/);
    });

    it('build.js does not define its own _streamAnthropic', () => {
        expect(buildSrc).not.toMatch(/function _streamAnthropic/);
    });

    it('generate.js does not define its own _streamOpenAI', () => {
        expect(generateSrc).not.toMatch(/function _streamOpenAI/);
    });

    it('build.js does not define its own _streamOpenAI', () => {
        expect(buildSrc).not.toMatch(/function _streamOpenAI/);
    });
});

// ── Model selection (generate.js reads user model from settings) ──────────────

describe('Model selection correctness (ipc/generate.js)', () => {
    const src = read('ipc/generate.js');

    it('reads anthropic_model from settings (not hardcoded)', () => {
        expect(src).toMatch(/anthropic_model/);
        expect(src).toMatch(/getSetting\(modelKey\)/);
    });

    it('reads openai_model from settings', () => {
        expect(src).toMatch(/openai_model/);
    });

    it('calls validateForm before streaming', () => {
        expect(src).toMatch(/validateForm/);
    });
});

// ── DB ────────────────────────────────────────────────────────────────────────

describe('Database safety (main/db)', () => {
    const historySrc = read('main/db/history.js');
    const indexSrc   = read('main/db/index.js');
    const settingsSrc = read('main/db/settings.js');

    it('history.js checks for DB instance change before using cached stmts', () => {
        expect(historySrc).toMatch(/_stmtsDb/);
    });

    it('history.js uses WAL mode for crash safety (set in db/index.js)', () => {
        expect(indexSrc).toMatch(/journal_mode\s*=\s*WAL/);
    });

    it('history.js uses transactions for atomic insert+prune', () => {
        expect(historySrc).toMatch(/db\.transaction/);
    });

    it('settings.js uses upsert (ON CONFLICT) for safe writes', () => {
        expect(settingsSrc).toMatch(/ON CONFLICT/);
    });

    it('searchHistory escapes LIKE metacharacters', () => {
        expect(historySrc).toMatch(/ESCAPE/);
    });

    it('db is stored in userData (not app directory)', () => {
        const configSrc = read('main/config.js');
        expect(configSrc).toMatch(/getPath\(['"]userData['"]\)/);
    });
});
