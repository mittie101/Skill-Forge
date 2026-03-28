'use strict';

const { ipcMain, BrowserWindow } = require('electron');
const {
    buildBuilderSystem, buildBuilderMessage,
    buildSuggesterSystem, buildSuggesterMessage, parseSuggestions,
} = require('../main/prompts');
const { getSetting }    = require('../main/db/settings');
const { decryptKey }    = require('../main/storage');
const { insertHistory } = require('../main/db/history');
const { PROVIDERS, VALID_PROVIDERS, GENERATE_TIMEOUT_MS, SUGGEST_TIMEOUT_MS, MAX_TOKENS_DEFAULT } = require('../main/config');
const { calculateCost } = require('../main/pricing');
const { apiErrorCode, streamWithRetry } = require('../main/stream');
const { callApi }       = require('../main/api-caller');
const { createMutex }   = require('./_mutex');

// ── Fast models for section suggestions (cheap + low latency) ──
const _SUGGEST_MODELS = {
    anthropic: 'claude-haiku-4-5-20251001',
    openai:    'gpt-4o-mini',
};

// ── Global mutex — one build at a time ──
const _mutex = createMutex();

// ── Input validation ──
function _validateBuildParams({ keyword, description, sections, maxTokens }) {
    if (typeof keyword !== 'string' || keyword.trim().length === 0 || keyword.length > 500)
        return 'Keyword must be a non-empty string under 500 characters.';
    if (typeof description !== 'string' || description.length > 2000)
        return 'Description must be a string under 2000 characters.';
    if (!Array.isArray(sections) || sections.length < 2 || sections.length > 10)
        return 'Sections must be an array of 2–10 items.';
    for (const s of sections) {
        if (typeof s !== 'string' || s.trim().length === 0 || s.length > 100)
            return 'Each section name must be a non-empty string under 100 characters.';
    }
    if (maxTokens != null) {
        const n = parseInt(maxTokens);
        if (isNaN(n) || n < 1024 || n > 32768)
            return 'maxTokens must be between 1024 and 32768.';
    }
    return null;
}

// ── Non-streaming suggestions fetch ──
async function _fetchSuggestions(provider, key, model, keyword, description, sectionCount) {
    // Always use the fast model for suggestions regardless of the user's generation model
    const resolvedModel = _SUGGEST_MODELS[provider] ?? model;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SUGGEST_TIMEOUT_MS);

    try {
        const { rawText } = await callApi(provider, key, {
            model:     resolvedModel,
            system:    buildSuggesterSystem(sectionCount),
            messages:  [{ role: 'user', content: buildSuggesterMessage(keyword, description, sectionCount) }],
            maxTokens: 512,
            signal:    controller.signal,
        });
        return parseSuggestions(rawText, sectionCount);
    } finally {
        clearTimeout(timer);
    }
}

function register() {
    // ── build-generate ──
    ipcMain.handle('build-generate', async (e, { keyword, description, sections, maxTokens, provider: reqProvider }) => {
        // Validate before acquiring mutex — a bad payload must not block a valid subsequent call
        const validationError = _validateBuildParams({ keyword, description, sections, maxTokens });
        if (validationError) return { error: validationError };

        if (!_mutex.acquire()) return { error: 'generation_in_progress' };

        // Helper: send a streaming chunk to the renderer
        const sendChunk = (chunk) => {
            try {
                const win = BrowserWindow.fromWebContents(e.sender);
                if (win && !win.isDestroyed()) {
                    win.webContents.send('build-chunk', chunk);
                } else if (!e.sender.isDestroyed()) {
                    e.sender.send('build-chunk', chunk);
                }
            } catch { /* non-fatal — chunk display is best-effort */ }
        };

        try {
            // Use renderer-supplied provider if valid, otherwise fall back to saved setting
            const provider     = VALID_PROVIDERS.includes(reqProvider) ? reqProvider : (getSetting('provider') || 'anthropic');
            const cipher       = getSetting(`api_key_cipher_${provider}`);
            const key          = cipher ? decryptKey(cipher) : null;

            if (!key) return { ok: false, error: 'no_key' };

            const privacyMode  = getSetting('privacy_mode') === 'true';
            const modelKey     = provider === 'anthropic' ? 'anthropic_model' : 'openai_model';
            const defaultModel = PROVIDERS[provider]?.model ?? provider;
            const model        = getSetting(modelKey) || defaultModel;

            const resolvedMaxTokens = Math.max(1024, Math.min(32768,
                parseInt(maxTokens) || parseInt(getSetting('max_tokens')) || MAX_TOKENS_DEFAULT
            ));

            const trimmed  = sections.map(s => s.trim());
            const system   = buildBuilderSystem(trimmed);
            const messages = [{ role: 'user', content: buildBuilderMessage(keyword.trim(), description.trim(), trimmed) }];

            let rawBuffer    = '';
            let inputTokens  = 0;
            let outputTokens = 0;

            try {
                const usage = await streamWithRetry({
                    provider,
                    logPrefix:       '[build]',
                    isAborted:       () => _mutex.aborted,
                    timeoutMs:       GENERATE_TIMEOUT_MS,
                    abortController: _mutex.controller,
                    key, model,
                    maxTokens:  resolvedMaxTokens,
                    system, messages,
                    onChunk: (chunk) => { rawBuffer += chunk; },
                    win:        BrowserWindow.fromWebContents(e.sender),
                    chunkEvent: 'build-chunk',
                });
                inputTokens  = usage?.inputTokens  ?? 0;
                outputTokens = usage?.outputTokens ?? 0;
            } catch (err) {
                if (err.name !== 'AbortError') {
                    return { ok: false, error: apiErrorCode(err), rawText: rawBuffer };
                }
                _mutex.abort();
            }

            const partial   = _mutex.aborted;
            const costUsd   = calculateCost(provider, model, inputTokens, outputTokens);
            const skillName = keyword.trim();

            if (!partial && !privacyMode) {
                try {
                    insertHistory({
                        skill_name:         skillName,
                        framework:          'claude',
                        provider,
                        model,
                        input_payload_json: JSON.stringify({ keyword, description, sections }),
                        generated_md:       rawBuffer,
                        status:             'success',
                        input_tokens:       inputTokens,
                        output_tokens:      outputTokens,
                        cost_usd:           costUsd,
                    });
                } catch { /* DB write failure is non-fatal */ }
            }

            return { ok: !partial, partial, rawText: rawBuffer, skillName, inputTokens, outputTokens, costUsd };
        } finally {
            _mutex.release();
        }
    });

    // ── build-stop ──
    ipcMain.handle('build-stop', () => {
        _mutex.abort();
        return { ok: true };
    });

    // ── suggest-sections ──
    ipcMain.handle('suggest-sections', async (_e, { keyword, description, sectionCount }) => {
        const provider = getSetting('provider') || 'anthropic';
        if (!VALID_PROVIDERS.includes(provider)) return { error: 'invalid_provider' };
        if (typeof keyword !== 'string' || keyword.trim().length === 0 || keyword.length > 500)
            return { error: 'Invalid keyword.' };
        const count = Math.max(2, Math.min(10, parseInt(sectionCount) || 5));

        const cipher = getSetting(`api_key_cipher_${provider}`);
        const key    = cipher ? decryptKey(cipher) : null;
        if (!key) return { error: 'no_key' };

        const modelKey     = provider === 'anthropic' ? 'anthropic_model' : 'openai_model';
        const defaultModel = PROVIDERS[provider]?.model ?? provider;
        const model        = getSetting(modelKey) || defaultModel;

        try {
            const suggestions = await _fetchSuggestions(
                provider, key, model,
                keyword.trim(),
                (description || '').trim(),
                count
            );
            return { ok: true, suggestions };
        } catch {
            return { error: 'suggestion_failed' };
        }
    });
}

module.exports = { register };
