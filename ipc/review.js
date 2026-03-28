'use strict';

const { ipcMain, BrowserWindow }            = require('electron');
const { buildSkillReviewPrompt,
        buildSkillFixPrompt,
        fenceUserInput,
        REVIEW_RUBRIC }                      = require('../main/prompts');
const { getSetting }                         = require('../main/db/settings');
const { decryptKey }                         = require('../main/storage');
const { PROVIDERS, VALID_PROVIDERS,
        GENERATE_TIMEOUT_MS,
        FIX_BUFFER_LIMIT_BYTES }             = require('../main/config');
const { apiErrorCode, streamAnthropic, streamOpenAI } = require('../main/stream');
const { callApi, sleep }                     = require('../main/api-caller');
const { validateCanonicalSkillStructure }    = require('../main/validators/skill');
const { calculateCost }                      = require('../main/pricing');
const { createMutex }                        = require('./_mutex');
const { quoteFrontmatterValue: _quoteFrontmatterValue } = require('../main/frontmatter');

// ── One shared mutex — review and fix cannot run concurrently ──
const _mutex = createMutex();

// ── Canonical max scores (source of truth — never trust model values) ──
const CANONICAL_MAX = Object.fromEntries(REVIEW_RUBRIC.map(r => [r.name, r.max]));
const CANONICAL_NAMES = REVIEW_RUBRIC.map(r => r.name);

// ─────────────────────────────────────────────────────────────────────────────
// Retry wrapper for _callApi — retries on 5xx up to maxAttempts times
// ─────────────────────────────────────────────────────────────────────────────

let _retryDelayFn = (attempt) => attempt * 2000; // overrideable in tests

async function _callApiWithRetry(provider, key, opts, maxAttempts = 3) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (attempt > 0) {
            await sleep(_retryDelayFn(attempt));
        }
        try {
            return await callApi(provider, key, opts);
        } catch (err) {
            if (err.name === 'AbortError') throw err;
            const code = apiErrorCode(err);
            if (code !== 'api_5xx' || attempt === maxAttempts - 1) throw err;
        }
    }
}

/**
 * Restore the original frontmatter `name` field and matching H1 heading in the fixed output.
 * The model sometimes changes "app-expert" to "app expert" despite being told not to.
 */
function _restoreFrontmatterName(processed, originalContent) {
    const origMatch = originalContent.match(/^name:[ \t]*(.+)$/m);
    if (!origMatch) return processed;
    const originalName = origMatch[1].trim().replace(/^["']|["']$/g, '');
    if (!originalName) return processed;

    // Extract the broken name before mutating processed
    const procMatch = processed.match(/^name:[ \t]*(.+)$/m);
    const brokenName = procMatch ? procMatch[1].trim().replace(/^["']|["']$/g, '') : null;

    // Restore frontmatter name: field
    let result = processed.replace(/^name:[ \t]*.+$/m, `name: ${_quoteFrontmatterValue(originalName)}`);

    // Also restore the H1 heading if it uses the broken (model-mutated) name
    if (brokenName && brokenName !== originalName) {
        result = result.replace(
            new RegExp(`^(#[ \\t]+)${brokenName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([ \\t]*)$`, 'm'),
            `$1${originalName}$2`
        );
    }
    return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parser / Normaliser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strip wrapping code fences if present.
 */
function _stripFences(raw) {
    return raw.trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
}

/**
 * Strip markdown code fences from fix output.
 * The model occasionally wraps the rewritten skill in ```markdown ... ``` despite
 * being instructed not to. If the output starts with a fence, remove it and the
 * matching closing fence. Any content before the opening fence is also discarded.
 */
function _stripMarkdownFences(raw) {
    const trimmed = raw.trim();
    const fenceMatch = trimmed.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)```\s*$/i);
    if (fenceMatch) return fenceMatch[1].trim();
    // If it starts with a fence but has no closing fence, strip the opening line only
    const openOnly = trimmed.match(/^```(?:markdown|md)?\s*\n([\s\S]*)$/i);
    if (openOnly) return openOnly[1].trim();
    return trimmed;
}

/**
 * Extract all candidate JSON objects from a string.
 * Returns them sorted descending by character length (largest first).
 */
function _extractJsonCandidates(str) {
    const candidates = [];
    let i = 0;
    while (i < str.length) {
        const start = str.indexOf('{', i);
        if (start === -1) break;

        // Walk forward to find the matching closing brace
        let depth = 0;
        let inString = false;
        let escape = false;
        let end = -1;

        for (let j = start; j < str.length; j++) {
            const ch = str[j];
            if (escape) { escape = false; continue; }
            if (ch === '\\' && inString) { escape = true; continue; }
            if (ch === '"') { inString = !inString; continue; }
            if (inString) continue;
            if (ch === '{') depth++;
            else if (ch === '}') {
                depth--;
                if (depth === 0) { end = j; break; }
            }
        }

        if (end !== -1) {
            candidates.push(str.slice(start, end + 1));
            i = end + 1;
        } else {
            i = start + 1;
        }
    }

    // Sort by length descending — largest is most likely the real result
    candidates.sort((a, b) => b.length - a.length);
    return candidates;
}

/**
 * Lenient JSON recovery:
 * 1. Remove trailing commas before ] or }
 * 2. Strip // line comments and /* block comments
 */
function _lenientParse(str) {
    let s = str
        .replace(/,\s*([}\]])/g, '$1')             // trailing commas
        .replace(/\/\/[^\n]*/g, '')                 // // comments
        .replace(/\/\*[\s\S]*?\*\//g, '');          // /* */ comments

    // Attempt brace-balancing on truncated JSON
    const openBraces  = (s.match(/{/g) ?? []).length;
    const closeBraces = (s.match(/}/g) ?? []).length;
    const openBracks  = (s.match(/\[/g) ?? []).length;
    const closeBracks = (s.match(/]/g) ?? []).length;

    s += ']'.repeat(Math.max(0, openBracks - closeBracks));
    s += '}'.repeat(Math.max(0, openBraces - closeBraces));

    return JSON.parse(s);
}

/**
 * Normalise and deduplicate improvements array.
 * Deduplicates on normalised form (trim, lowercase, strip trailing punctuation),
 * but preserves original casing in output.
 */
function _normaliseImprovements(improvements) {
    if (!Array.isArray(improvements)) return [];
    const seen = new Set();
    const result = [];
    for (const item of improvements) {
        if (typeof item !== 'string') continue;
        const original = item.trim();
        if (!original) continue;
        const normalised = original.toLowerCase().replace(/[.,;]$/, '');
        if (seen.has(normalised)) continue;
        seen.add(normalised);
        result.push(original);
    }
    return result;
}

/**
 * Full normaliser for the raw model output.
 * Returns { ok: true, data: ReviewResult } or { ok: false, error: string }
 */
function _normaliseReviewResult(raw) {
    // Step 1: strip code fences
    let cleaned = _stripFences(raw);

    // Step 2: find all JSON candidates, try largest first
    const candidates = _extractJsonCandidates(cleaned);
    if (candidates.length === 0) candidates.push(cleaned); // try the whole string

    let parsed = null;
    for (const candidate of candidates) {
        try {
            parsed = JSON.parse(candidate);
            break;
        } catch {
            // try lenient recovery
            try {
                parsed = _lenientParse(candidate);
                break;
            } catch {
                // try next candidate
            }
        }
    }

    if (!parsed || typeof parsed !== 'object') {
        return { ok: false, error: 'Model returned unparseable output' };
    }

    // Step 3/4: validate categories array
    if (!Array.isArray(parsed.categories)) {
        return { ok: false, error: 'Review output is missing the categories array' };
    }

    const cats = parsed.categories;
    if (cats.length !== 7) {
        return { ok: false, error: `Expected 7 review categories, got ${cats.length}` };
    }

    // Check for duplicate names
    const seenNames = new Set();
    for (const cat of cats) {
        if (!cat || typeof cat.name !== 'string') {
            return { ok: false, error: 'One or more categories have missing or invalid names' };
        }
        if (seenNames.has(cat.name)) {
            return { ok: false, error: `Duplicate category name: "${cat.name}"` };
        }
        seenNames.add(cat.name);
    }

    // Check all canonical names are present
    for (const name of CANONICAL_NAMES) {
        if (!seenNames.has(name)) {
            return { ok: false, error: `Missing required category: "${name}"` };
        }
    }

    // Step 5: reorder to canonical order
    const catMap = Object.fromEntries(cats.map(c => [c.name, c]));
    const ordered = CANONICAL_NAMES.map(name => catMap[name]);

    // Step 6 & 7: overwrite max with canonical, clamp scores
    const normalisedCats = ordered.map(cat => {
        const canonMax = CANONICAL_MAX[cat.name];
        const rawScore = parseInt(cat.score, 10);
        const score    = isNaN(rawScore) ? 0 : Math.max(0, Math.min(rawScore, canonMax));
        const issues   = Array.isArray(cat.issues) ? cat.issues.filter(i => typeof i === 'string') : [];
        const verdict  = typeof cat.verdict === 'string' ? cat.verdict.trim() : '';
        return { name: cat.name, score, max: canonMax, issues, verdict };
    });

    // Step 8: recompute total
    const total = normalisedCats.reduce((sum, c) => sum + c.score, 0);

    // Step 9: recompute perfect
    const perfect = total === 100;

    // Step 10 & 11: enforce improvements rules
    let improvements = _normaliseImprovements(parsed.improvements);
    if (perfect) {
        improvements = [];
    } else if (improvements.length === 0) {
        improvements = ['Improve the skill to meet all rubric requirements'];
    }

    const result = {
        categories: normalisedCats,
        total,
        overall_verdict: typeof parsed.overall_verdict === 'string'
            ? parsed.overall_verdict.trim()
            : '',
        perfect,
        improvements,
    };

    return { ok: true, data: result };
}

// ─────────────────────────────────────────────────────────────────────────────
// Post-fix processing helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inject or replace `created_at` in frontmatter.
 */
function _injectCreatedAt(markdown, isoString) {
    if (!markdown.startsWith('---')) return markdown;
    const end = markdown.indexOf('\n---', 3);
    if (end === -1) return markdown;

    const fm      = markdown.slice(0, end);
    const rest    = markdown.slice(end);
    const safeIso = _quoteFrontmatterValue(isoString);

    if (/^created_at:/m.test(fm)) {
        return fm.replace(/^created_at:.*$/m, `created_at: ${safeIso}`) + rest;
    }
    // Add before closing ---
    return fm + `\ncreated_at: ${safeIso}` + rest;
}

/**
 * Bump `version` in frontmatter. If missing or non-numeric, sets to 1.
 */
function _bumpVersion(markdown) {
    if (!markdown.startsWith('---')) return markdown;
    const end = markdown.indexOf('\n---', 3);
    if (end === -1) return markdown;

    const fm   = markdown.slice(0, end);
    const rest = markdown.slice(end);

    const match = fm.match(/^version:\s*(.+)$/m);
    if (match) {
        const existing = parseInt(match[1].trim(), 10);
        const next     = isNaN(existing) ? 1 : existing + 1;
        return fm.replace(/^version:.*$/m, `version: ${next}`) + rest;
    }
    // Add version field
    return fm + `\nversion: 1` + rest;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider / key resolution helper
// ─────────────────────────────────────────────────────────────────────────────
function _resolveProviderAndKey(reqProvider, reqModel) {
    const provider = (VALID_PROVIDERS.includes(reqProvider) ? reqProvider : null)
        ?? getSetting('provider')
        ?? 'anthropic';

    if (!VALID_PROVIDERS.includes(provider)) {
        return { error: 'invalid_provider' };
    }

    const cipher = getSetting(`api_key_cipher_${provider}`);
    const key    = cipher ? decryptKey(cipher) : null;
    if (!key) return { error: 'no_key' };

    const modelKey     = provider === 'anthropic' ? 'anthropic_model' : 'openai_model';
    const defaultModel = PROVIDERS[provider]?.model ?? provider;
    const model        = reqModel || getSetting(modelKey) || defaultModel;

    return { provider, key, model };
}

// ─────────────────────────────────────────────────────────────────────────────
// IPC handlers
// ─────────────────────────────────────────────────────────────────────────────
function register() {

    // ── review-skill ──
    ipcMain.handle('review-skill', async (_e, { content, provider: reqProvider, model: reqModel } = {}) => {
        if (typeof content !== 'string' || !content.trim()) {
            return { ok: false, error: 'Content is required' };
        }

        if (!_mutex.acquire()) return { ok: false, error: 'A review or fix is already in progress' };

        try {
            const resolved = _resolveProviderAndKey(reqProvider, reqModel);
            if (resolved.error) return { ok: false, error: resolved.error };
            const { provider, key, model } = resolved;

            const { system, user } = buildSkillReviewPrompt(content);

            let rawText      = '';
            let inputTokens  = 0;
            let outputTokens = 0;
            try {
                const timer = setTimeout(() => _mutex.abort(), GENERATE_TIMEOUT_MS);
                try {
                    const res = await _callApiWithRetry(provider, key, {
                        model,
                        system,
                        messages:  [{ role: 'user', content: user }],
                        maxTokens: 4096,
                        signal:    _mutex.signal,
                    });
                    rawText      = res.rawText;
                    inputTokens  = res.inputTokens  ?? 0;
                    outputTokens = res.outputTokens ?? 0;
                } finally {
                    clearTimeout(timer);
                }
            } catch (err) {
                if (err.name === 'AbortError') {
                    return { ok: false, error: 'Review was stopped' };
                }
                return { ok: false, error: apiErrorCode(err) };
            }

            const normalised = _normaliseReviewResult(rawText);
            if (!normalised.ok) return { ok: false, error: normalised.error };

            const costUsd = calculateCost(provider, model, inputTokens, outputTokens);
            return { ok: true, data: normalised.data, inputTokens, outputTokens, costUsd };

        } finally {
            _mutex.release();
        }
    });

    // ── fix-skill ──
    ipcMain.handle('fix-skill', async (e, { content, improvements, scoreBreakdown, provider: reqProvider, model: reqModel } = {}) => {
        if (typeof content !== 'string' || !content.trim()) {
            return { ok: false, error: 'Content is required' };
        }
        if (!Array.isArray(improvements) || improvements.length === 0) {
            return { ok: false, error: 'improvements array is required' };
        }
        if (!Array.isArray(scoreBreakdown)) {
            return { ok: false, error: 'scoreBreakdown array is required' };
        }

        // Cap improvements to 20 items and fence each one to prevent prompt injection
        improvements = improvements.slice(0, 20).map(imp => fenceUserInput(String(imp)));

        if (!_mutex.acquire()) return { ok: false, error: 'A review or fix is already in progress' };

        const win = BrowserWindow.fromWebContents(e.sender);

        const sendChunk = (chunk) => {
            try {
                if (win && !win.isDestroyed()) {
                    win.webContents.send('fix-chunk', chunk);
                } else if (!e.sender.isDestroyed()) {
                    e.sender.send('fix-chunk', chunk);
                }
            } catch { /* non-fatal */ }
        };

        let fixBuffer = '';

        try {
            const resolved = _resolveProviderAndKey(reqProvider, reqModel);
            if (resolved.error) return { ok: false, error: resolved.error };
            const { provider, key, model } = resolved;

            const { system, user } = buildSkillFixPrompt(content, improvements, scoreBreakdown);

            const MAX_FIX_RETRIES = 2;
            const RETRYABLE       = new Set(['api_429', 'api_5xx', 'network_error']);

            let bufferExceeded = false;
            let inputTokens    = 0;
            let outputTokens   = 0;
            const streamFn     = provider === 'openai' ? streamOpenAI : streamAnthropic;

            const timer = setTimeout(() => _mutex.abort(), GENERATE_TIMEOUT_MS);
            try {
                for (let attempt = 0; attempt <= MAX_FIX_RETRIES; attempt++) {
                    if (_mutex.signal?.aborted) throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
                    if (attempt > 0) await sleep(_retryDelayFn(attempt)); // uses same delay fn as review (overrideable in tests)

                    // Reset buffer before every attempt — prevents corruption on retry (Bomb 1-A)
                    fixBuffer      = '';
                    bufferExceeded = false;

                    const attemptAbort = new AbortController();
                    const signal = AbortSignal.any([_mutex.signal, attemptAbort.signal]);

                    try {
                        const usage = await streamFn({
                            signal, key, model,
                            maxTokens: parseInt(getSetting('max_tokens')) || 8192,
                            system,
                            messages: [{ role: 'user', content: user }],
                            onChunk: (chunk) => {
                                fixBuffer += chunk;
                                sendChunk(chunk);
                                if (Buffer.byteLength(fixBuffer, 'utf8') > FIX_BUFFER_LIMIT_BYTES) {
                                    bufferExceeded = true;
                                    attemptAbort.abort(); // abort this attempt only
                                }
                            },
                        });
                        inputTokens  = usage?.inputTokens  ?? 0;
                        outputTokens = usage?.outputTokens ?? 0;
                        break; // stream completed — exit retry loop
                    } catch (err) {
                        if (bufferExceeded) break; // buffer cap hit — treat as success path
                        if (err.name === 'AbortError') throw err; // user stop or global timeout
                        const code = apiErrorCode(err);
                        if (!RETRYABLE.has(code) || attempt >= MAX_FIX_RETRIES) throw err;
                        // transient error within retry budget — loop again
                    }
                }
            } finally {
                clearTimeout(timer);
            }

            // ── Buffer exceeded: return partial ──
            if (bufferExceeded) {
                // Chunks already forwarded during streaming — no re-send needed (Bomb 1-B/1-C)
                return {
                    ok:      false,
                    partial: true,
                    error:   'buffer_exceeded',
                    data:    { content: fixBuffer },
                };
            }

            // ── Post-stream processing ──
            let processed = fixBuffer;

            // 0. Strip any markdown code fences the model may have added
            processed = _stripMarkdownFences(processed);

            // 1. Restore original name (model sometimes changes "app-expert" → "app expert")
            processed = _restoreFrontmatterName(processed, content);

            // 2. Inject created_at
            processed = _injectCreatedAt(processed, new Date().toISOString());

            // 3. Bump version
            processed = _bumpVersion(processed);

            // 4. Validate
            const validation = validateCanonicalSkillStructure(processed);
            const fixWarning = validation.valid ? null : validation.errors.join('; ');

            const costUsd = calculateCost(provider, model, inputTokens, outputTokens);

            // Renderer replaces fixedContent from result.data.content on IPC resolve —
            // sending a final chunk here would double-append to already-streamed content (Bomb 1-C)
            return {
                ok:   true,
                data: { content: processed },
                inputTokens, outputTokens, costUsd,
                ...(fixWarning ? { fixWarning } : {}),
            };

        } catch (err) {
            if (err.name === 'AbortError') {
                // Chunks already forwarded during streaming — partial content in renderer (Bomb 1-B)
                return {
                    ok:      false,
                    partial: true,
                    error:   'Fix was stopped',
                    data:    { content: fixBuffer ?? '' },
                };
            }
            return { ok: false, error: apiErrorCode(err) };
        } finally {
            _mutex.release();
        }
    });

    // ── review-stop ──
    ipcMain.handle('review-stop', () => {
        _mutex.abort();
        return { ok: true };
    });
}

// Export normaliser and helpers for unit testing
module.exports = { register, _normaliseReviewResult, _injectCreatedAt, _bumpVersion, _stripMarkdownFences, _restoreFrontmatterName, _quoteFrontmatterValue, _setRetryDelayFn: (fn) => { _retryDelayFn = fn; } };
