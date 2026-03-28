'use strict';

const { ipcMain, dialog, BrowserWindow } = require('electron');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { parseFrontmatter, quoteFrontmatterValue: _quoteFrontmatterValue } = require('../main/frontmatter');
const { getSetting }        = require('../main/db/settings');
const { decryptKey }        = require('../main/storage');
const { PROVIDERS, GENERATE_TIMEOUT_MS } = require('../main/config');
const { callApi }           = require('../main/api-caller');
const { apiErrorCode }      = require('../main/stream');
const { calculateCost }     = require('../main/pricing');
const { createMutex }       = require('./_mutex');

// ── One shared mutex — only one convert at a time ──
const _mutex = createMutex();

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers (exported for unit tests)
// ─────────────────────────────────────────────────────────────────────────────

function _makeSafeName(name) {
    let s = (name ?? '').replace(/[^a-zA-Z0-9\-_]/g, '-');
    s = s.replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '');
    const RESERVED = new Set([
        'CON','PRN','AUX','NUL',
        'COM1','COM2','COM3','COM4','COM5','COM6','COM7','COM8','COM9',
        'LPT1','LPT2','LPT3','LPT4','LPT5','LPT6','LPT7','LPT8','LPT9',
    ]);
    if (!s || RESERVED.has(s.toUpperCase())) s = s ? `${s}-skill` : 'skill';
    return s;
}

function _atomicWrite(filePath, content, { exclusive = false } = {}) {
    if (exclusive && fs.existsSync(filePath)) {
        return { error: 'EEXIST', filePath };
    }
    const tmpPath = filePath + '.' + crypto.randomUUID() + '.tmp';
    try {
        fs.writeFileSync(tmpPath, content, { encoding: 'utf8' });
        fs.renameSync(tmpPath, filePath);
        return { ok: true, filePath };
    } catch (err) {
        try { fs.unlinkSync(tmpPath); } catch {}
        if (exclusive && err.code === 'EEXIST') return { error: 'EEXIST', filePath };
        return { error: err.code ?? 'write_failed', message: err.message };
    }
}

/**
 * Returns true if resolvedFilePath is strictly inside baseFolder.
 * Prevents path traversal via `../` segments in the safeName component.
 */
function _isWithinFolder(filePath, folder) {
    const resolved = path.resolve(filePath);
    const base     = path.resolve(folder) + path.sep;
    return resolved.startsWith(base);
}

/**
 * Strip accidental markdown code fences (```json / ```) from AI response.
 */
function _stripFences(raw) {
    return raw.trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
}

/**
 * Load, parse, and validate a .md skill file from disk.
 * Returns { ok, name, safeName, meta, body, filePath } or { error }.
 */
function _loadSkillFile(filePath) {
    if (path.extname(filePath).toLowerCase() !== '.md') return { error: 'invalid_extension' };

    let stat;
    try { stat = fs.statSync(filePath); }
    catch (err) { return { error: err.code ?? 'stat_failed' }; }
    if (stat.size > 1024 * 1024) return { error: 'TOO_LARGE' };

    let raw;
    try { raw = fs.readFileSync(filePath, { encoding: 'utf8' }); }
    catch (err) { return { error: err.code ?? 'read_failed' }; }

    raw = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');

    const { meta, body } = parseFrontmatter(raw);
    const name     = (meta['name'] || path.basename(filePath, '.md')).trim();
    const safeName = _makeSafeName(name);
    if (!safeName) return { error: 'invalid_name' };

    return { ok: true, name, safeName, meta, body, filePath };
}

// ─────────────────────────────────────────────────────────────────────────────
// AI response validation
// ─────────────────────────────────────────────────────────────────────────────

function _sanitiseStringArray(arr, field) {
    const seen = new Set();
    const out  = [];
    for (const item of arr.slice(0, 10)) {
        if (typeof item !== 'string') continue;
        const trimmed = item.trim();
        if (!trimmed) continue;
        if (/[\n\r"'/\\]/.test(trimmed)) {
            return { error: 'ai_invalid_shape', detail: `${field} entry contains disallowed characters` };
        }
        if (seen.has(trimmed)) continue;
        seen.add(trimmed);
        out.push(trimmed);
    }
    return { ok: true, data: out };
}

function _containsBadSequences(obj) {
    for (const v of Object.values(obj)) {
        if (typeof v === 'string' && (/[\n\r]/.test(v) || v.includes('---'))) return true;
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            if (_containsBadSequences(v)) return true;
        }
    }
    return false;
}

/**
 * Validate and sanitise the parsed AI OpenClaw response.
 * Whitelist-only: rejects unexpected keys and bad value types.
 * Returns { ok: true, data: validatedObj } or { error, detail }.
 */
function _validateOpenClawResponse(parsed) {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { error: 'ai_invalid_shape', detail: 'root is not an object' };
    }
    const rootKeys = Object.keys(parsed);
    if (rootKeys.length !== 1 || rootKeys[0] !== 'openclaw') {
        return { error: 'ai_invalid_shape', detail: `unexpected root keys: ${rootKeys.join(', ')}` };
    }
    const oc = parsed.openclaw;
    if (!oc || typeof oc !== 'object' || Array.isArray(oc)) {
        return { error: 'ai_invalid_shape', detail: 'openclaw value is not an object' };
    }

    const allowedOcKeys = new Set(['emoji', 'always', 'requires']);
    for (const k of Object.keys(oc)) {
        if (!allowedOcKeys.has(k)) {
            return { error: 'ai_invalid_shape', detail: `unexpected key: openclaw.${k}` };
        }
    }

    const result = {};

    // emoji: validate or fallback silently to 🧩
    if ('emoji' in oc) {
        const em = oc.emoji;
        if (typeof em === 'string' && /^\p{Emoji}/u.test(em) && em.length <= 8) {
            result.emoji = em;
        } else {
            result.emoji = '🧩';
        }
    } else {
        result.emoji = '🧩';
    }

    // always: must be boolean if present
    if ('always' in oc) {
        if (typeof oc.always !== 'boolean') {
            return { error: 'ai_invalid_shape', detail: 'openclaw.always must be boolean' };
        }
        result.always = oc.always;
    }

    // requires: optional plain object
    if ('requires' in oc) {
        const req = oc.requires;
        if (!req || typeof req !== 'object' || Array.isArray(req)) {
            return { error: 'ai_invalid_shape', detail: 'openclaw.requires must be an object' };
        }
        const allowedReqKeys = new Set(['bins', 'env']);
        for (const k of Object.keys(req)) {
            if (!allowedReqKeys.has(k)) {
                return { error: 'ai_invalid_shape', detail: `unexpected key: openclaw.requires.${k}` };
            }
        }

        const resultReq = {};

        if ('bins' in req) {
            if (!Array.isArray(req.bins)) {
                return { error: 'ai_invalid_shape', detail: 'openclaw.requires.bins must be array' };
            }
            const sanitised = _sanitiseStringArray(req.bins, 'bins');
            if (sanitised.error) return sanitised;
            if (sanitised.data.length > 0) resultReq.bins = sanitised.data;
        }

        if ('env' in req) {
            if (!Array.isArray(req.env)) {
                return { error: 'ai_invalid_shape', detail: 'openclaw.requires.env must be array' };
            }
            const sanitised = _sanitiseStringArray(req.env, 'env');
            if (sanitised.error) return sanitised;
            if (sanitised.data.length > 0) resultReq.env = sanitised.data;
        }

        if (Object.keys(resultReq).length > 0) result.requires = resultReq;
    }

    if (_containsBadSequences(result)) {
        return { error: 'ai_invalid_shape', detail: 'value contains disallowed sequences' };
    }

    return { ok: true, data: { openclaw: result } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Frontmatter reconstruction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reconstruct the full converted SKILL.md.
 * Preserves all original meta keys; adds user-invocable and metadata.
 * Applies _quoteFrontmatterValue to every scalar value.
 */
function _reconstructSkill(meta, body, metadataObj) {
    const m = Object.assign({}, meta);
    m['user-invocable'] = true;
    m['metadata'] = JSON.stringify(metadataObj);

    let fm = '---\n';
    for (const [k, v] of Object.entries(m)) {
        fm += `${k}: ${_quoteFrontmatterValue(String(v))}\n`;
    }
    fm += '---';

    const convertedMd = fm + '\n' + body;

    return { ok: true, convertedMd };
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt builders
// ─────────────────────────────────────────────────────────────────────────────

const _SYSTEM_PROMPT = `You are an expert at converting Claude Code skill files to OpenClaw format.
OpenClaw skills use AgentSkills-compatible SKILL.md files with YAML frontmatter.
The metadata field must be a single-line JSON object with no newlines.

Return ONLY a JSON object — no markdown, no explanation, no code fences.
The object must have this shape (all fields optional except the root object):
{
  "openclaw": {
    "emoji": "<single emoji character>",
    "always": <true if no external tools/bins/env needed, omit otherwise>,
    "requires": {
      "bins": ["<binary name>", ...],
      "env": ["<ENV_VAR_NAME>", ...]
    }
  }
}

Rules:
- "always": true only when the skill is pure LLM instruction with zero CLI tools or API keys
- "bins": list only executables the skill explicitly requires on PATH — DO NOT infer common tools (node, git, bash, etc.) unless the skill body clearly states they are required
- "env": list only environment variable names explicitly needed by the skill body
- If no bins required, omit "bins". If no env required, omit "env".
- If neither bins nor env required, omit "requires" entirely.
- "emoji" must be a single emoji character that reflects the skill's purpose
- Respond with ONLY the JSON object. No other text whatsoever.`;

function _buildUserMessage(name, description, body) {
    const descLine = description ? `Description: ${description}\n\n` : '';
    return `Skill name: ${name}\n${descLine}${body}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// IPC registration
// ─────────────────────────────────────────────────────────────────────────────

function register() {

    ipcMain.handle('openclaw-open-file', async (e) => {
        const win = BrowserWindow.fromWebContents(e.sender);
        const result = await dialog.showOpenDialog(win, {
            filters: [{ name: 'Markdown', extensions: ['md'] }],
            properties: ['openFile'],
        });
        if (result.canceled || !result.filePaths.length) return null;
        return _loadSkillFile(result.filePaths[0]);
    });

    ipcMain.handle('openclaw-load-file', (_e, filePath) => {
        if (typeof filePath !== 'string') return { error: 'invalid_path' };
        return _loadSkillFile(filePath);
    });

    ipcMain.handle('openclaw-convert', async (_e, { filePath }) => {
        if (typeof filePath !== 'string') return { error: 'invalid_params' };
        if (!_mutex.acquire()) return { error: 'generation_in_progress' };

        let timeoutId;
        try {
            const provider     = getSetting('provider') || 'anthropic';
            const modelKey     = provider === 'anthropic' ? 'anthropic_model' : 'openai_model';
            const defaultModel = PROVIDERS[provider]?.model ?? provider;
            const model        = getSetting(modelKey) || defaultModel;
            const cipher       = getSetting(`api_key_cipher_${provider}`);
            const key          = cipher ? decryptKey(cipher) : null;
            if (!key) return { error: 'no_key' };

            // Re-read from disk — never trust renderer state
            const loaded = _loadSkillFile(filePath);
            if (loaded.error) return loaded;

            const { name, meta, body } = loaded;
            const description = String(meta.description || '');

            const messages = [{ role: 'user', content: _buildUserMessage(name, description, body) }];

            timeoutId = setTimeout(() => _mutex.abort(), GENERATE_TIMEOUT_MS);

            let rawText, inputTokens, outputTokens;
            try {
                const res = await callApi(provider, key, {
                    model,
                    system: _SYSTEM_PROMPT,
                    messages,
                    maxTokens: 1024,
                    signal: _mutex.signal,
                });
                rawText      = res.rawText;
                inputTokens  = res.inputTokens  ?? 0;
                outputTokens = res.outputTokens ?? 0;
            } catch (err) {
                if (_mutex.aborted) return { error: 'aborted' };
                return { error: apiErrorCode(err) };
            } finally {
                clearTimeout(timeoutId);
                timeoutId = null;
            }

            if (_mutex.aborted) return { error: 'aborted' };

            let parsed;
            try   { parsed = JSON.parse(_stripFences(rawText)); }
            catch { return { error: 'ai_parse_failed' }; }

            const validated = _validateOpenClawResponse(parsed);
            if (!validated.ok) return validated;

            const metadataObj = validated.data;
            const recon = _reconstructSkill(loaded.meta, loaded.body, metadataObj);
            if (!recon.ok) return recon;

            const costUsd = calculateCost(provider, model, inputTokens, outputTokens);
            return {
                ok: true,
                convertedMd:  recon.convertedMd,
                metadataJson: JSON.stringify(metadataObj),
                inputTokens,
                outputTokens,
                costUsd,
            };
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
            _mutex.release();
        }
    });

    ipcMain.handle('openclaw-stop', () => {
        _mutex.abort();
        return { ok: true };
    });

    ipcMain.handle('openclaw-save', async (e, { safeName, content }) => {
        if (typeof content !== 'string' || !content) return { error: 'invalid_params' };
        const safe = _makeSafeName(safeName);
        if (!safe) return { error: 'invalid_name' };

        const win = BrowserWindow.fromWebContents(e.sender);
        const dirResult = await dialog.showOpenDialog(win, {
            properties: ['openDirectory', 'createDirectory'],
            title: 'Choose output folder',
        });
        if (dirResult.canceled || !dirResult.filePaths.length) return { error: 'cancelled' };

        const outputDir = dirResult.filePaths[0];
        const destPath  = path.join(outputDir, safe, 'SKILL.md');

        if (!_isWithinFolder(destPath, outputDir)) return { error: 'path_traversal' };

        try { fs.mkdirSync(path.dirname(destPath), { recursive: true }); }
        catch (err) { return { error: err.code ?? 'mkdir_failed', message: err.message }; }

        const result = _atomicWrite(destPath, content, { exclusive: true });
        if (!result.ok) return result;
        return { ok: true, destPath };
    });

    ipcMain.handle('openclaw-save-overwrite', async (e, { safeName, content }) => {
        if (typeof content !== 'string' || !content) return { error: 'invalid_params' };
        const safe = _makeSafeName(safeName);
        if (!safe) return { error: 'invalid_name' };

        const win = BrowserWindow.fromWebContents(e.sender);
        const dirResult = await dialog.showOpenDialog(win, {
            properties: ['openDirectory', 'createDirectory'],
            title: 'Choose output folder',
        });
        if (dirResult.canceled || !dirResult.filePaths.length) return { error: 'cancelled' };

        const outputDir = dirResult.filePaths[0];
        const destPath  = path.join(outputDir, safe, 'SKILL.md');

        if (!_isWithinFolder(destPath, outputDir)) return { error: 'path_traversal' };

        try { fs.mkdirSync(path.dirname(destPath), { recursive: true }); }
        catch (err) { return { error: err.code ?? 'mkdir_failed', message: err.message }; }

        const result = _atomicWrite(destPath, content);
        if (!result.ok) return result;
        return { ok: true, destPath };
    });
}

module.exports = {
    register,
    _makeSafeName,
    _quoteFrontmatterValue,
    _isWithinFolder,
    _stripFences,
    _validateOpenClawResponse,
    _reconstructSkill,
    _buildUserMessage,
    _loadSkillFile,
};
