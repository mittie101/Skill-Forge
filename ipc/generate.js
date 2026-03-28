'use strict';

const { ipcMain, BrowserWindow }     = require('electron');
const { validateForm, validateJson } = require('../main/validators/common');
const { validateClaudeOutput }       = require('../main/validators/claude');
const { validateChatGPTOutput }      = require('../main/validators/chatgpt');
const { validateLangChainOutput }    = require('../main/validators/langchain');
const { renderClaude }    = require('../main/framework-renderers/claude');
const { renderChatGPT }   = require('../main/framework-renderers/chatgpt');
const { renderLangChain } = require('../main/framework-renderers/langchain');
const { buildSkillPrompt } = require('../main/prompts');
const { getSetting }       = require('../main/db/settings');
const { decryptKey }       = require('../main/storage');
const { insertHistory }    = require('../main/db/history');
const { PROVIDERS, GENERATE_TIMEOUT_MS } = require('../main/config');
const { calculateCost }    = require('../main/pricing');
const { streamWithRetry, apiErrorCode } = require('../main/stream');
const { createMutex } = require('./_mutex');

// ── Global mutex — one generate stream at a time ──
const _mutex = createMutex();

// ── Compilation (runs ONLY after reader loop exits) ──
function _compile(rawText, framework) {
    let parsed;
    try   { parsed = JSON.parse(rawText); }
    catch { return { parseError: true, validation: null, compiledMd: null }; }

    const layer2 = validateJson(parsed);
    if (!layer2.valid) {
        return { parseError: false, validation: { layer2, layer3: null, layer4: null }, compiledMd: null };
    }

    let compiledMd, layer3, layer4;
    const fw = framework || parsed.metadata?.framework || 'claude';
    try {
        if      (fw === 'chatgpt')   compiledMd = renderChatGPT(parsed);
        else if (fw === 'langchain') compiledMd = renderLangChain(parsed);
        else                         compiledMd = renderClaude(parsed);
        layer3 = { valid: true, errors: [] };
    } catch (err) {
        layer3 = { valid: false, errors: [err.message] };
        return { parseError: false, validation: { layer2, layer3, layer4: null }, compiledMd: null };
    }

    if      (fw === 'chatgpt')   layer4 = validateChatGPTOutput(compiledMd);
    else if (fw === 'langchain') layer4 = validateLangChainOutput(compiledMd);
    else                         layer4 = validateClaudeOutput(compiledMd);

    return { parseError: false, validation: { layer2, layer3, layer4 }, compiledMd: layer4.valid ? compiledMd : null };
}

function register() {
    ipcMain.handle('generate', async (e, formData) => {
        if (!formData || typeof formData !== 'object') return { error: 'invalid_params' };

        // IPC-level form validation — runs before acquiring mutex so a bad payload
        // doesn't block a subsequent valid call
        if (!formData.isTest) {
            const formValidation = validateForm(formData);
            if (!formValidation.valid) {
                return { error: 'validation_failed', errors: formValidation.errors };
            }
        }

        if (!_mutex.acquire()) return { error: 'generation_in_progress' };

        try {
            const win    = BrowserWindow.fromWebContents(e.sender);
            const isTest = !!formData.isTest;

            const chunkEvent = isTest ? 'test-stream-chunk' : 'stream-chunk';
            const endEvent   = isTest ? 'test-stream-end'   : 'stream-end';

            // ── Resolve provider, model (FIX: read user's chosen model from settings) ──
            const provider     = getSetting('provider') || 'anthropic';
            const modelKey     = provider === 'anthropic' ? 'anthropic_model' : 'openai_model';
            const defaultModel = PROVIDERS[provider]?.model ?? provider;
            const model        = getSetting(modelKey) || defaultModel;
            const cipher       = getSetting(`api_key_cipher_${provider}`);
            const key          = cipher ? decryptKey(cipher) : null;

            if (!key) {
                win.webContents.send(endEvent, { ok: false, error: 'no_key' });
                return { ok: true };
            }

            const privacyMode = getSetting('privacy_mode') === 'true';

            // ── Build prompt ──
            let system, messages;
            if (isTest) {
                system   = (formData.systemPrompt ?? '').trim();
                messages = [{ role: 'user', content: (formData.testMessage ?? '').trim() }];
            } else {
                const prompt = buildSkillPrompt(formData.framework, formData);
                system       = prompt.system;
                messages     = [{ role: 'user', content: prompt.user }];
            }

            let rawBuffer    = '';
            let inputTokens  = 0;
            let outputTokens = 0;
            const onChunk = chunk => { rawBuffer += chunk; };

            try {
                const usage = await streamWithRetry({
                    provider,
                    logPrefix:       '[generate]',
                    isAborted:       () => _mutex.aborted,
                    timeoutMs:       GENERATE_TIMEOUT_MS,
                    abortController: _mutex.controller,
                    key, model,
                    maxTokens:  4096,
                    system, messages,
                    onChunk, win, chunkEvent,
                });
                inputTokens  = usage?.inputTokens  ?? 0;
                outputTokens = usage?.outputTokens ?? 0;
            } catch (err) {
                if (err.name !== 'AbortError') {
                    const errorCode = apiErrorCode(err);
                    if (win && !win.isDestroyed()) {
                        win.webContents.send(endEvent, {
                            ok: false, error: errorCode, rawText: rawBuffer, isTest,
                        });
                    }
                    return { ok: true };
                }
                _mutex.abort();
            }

            // ── Post-stream ──
            const costUsd  = calculateCost(provider, model, inputTokens, outputTokens);
            const partial  = _mutex.aborted;
            const compiled = (!partial && !isTest) ? _compile(rawBuffer, formData.framework) : null;

            // ── Save to history (skip for test, partial, privacy mode) ──
            let historyId = null;
            if (!partial && !isTest && compiled && !compiled.parseError) {
                if (!privacyMode) {
                    try {
                        historyId = insertHistory({
                            skill_name:         formData.skillName,
                            framework:          formData.framework,
                            provider,
                            model,
                            input_payload_json: JSON.stringify(formData),
                            generated_md:       compiled.compiledMd,
                            status:             compiled.validation?.layer4?.valid ? 'success' : 'partial',
                            input_tokens:       inputTokens,
                            output_tokens:      outputTokens,
                            cost_usd:           costUsd,
                        });
                    } catch { /* DB write failure is non-fatal — generation still succeeded */ }
                }
            }

            // ── Notify renderer ──
            if (win && !win.isDestroyed()) {
                if (isTest) {
                    win.webContents.send(endEvent, {
                        ok: !partial, partial, rawText: rawBuffer, isTest,
                    });
                } else {
                    win.webContents.send(endEvent, {
                        ok:           !partial,
                        partial,
                        rawText:      rawBuffer,
                        compiledMd:   compiled?.compiledMd  ?? null,
                        validation:   compiled?.validation  ?? null,
                        parseError:   compiled?.parseError  ?? false,
                        skillName:    formData.skillName,
                        framework:    formData.framework,
                        historyId,
                        isTest:       false,
                        inputTokens,
                        outputTokens,
                        costUsd,
                    });
                }
            }

            return { ok: true };
        } finally {
            _mutex.release();
        }
    });

    ipcMain.handle('stop-generation', () => {
        _mutex.abort();
        return { ok: true };
    });

    ipcMain.handle('get-presets', () => {
        return require('../main/presets').getPresets();
    });
}

// Exposed for test isolation — resets mutex state between tests
function _resetForTesting() {
    _mutex.release();
}

module.exports = { register, _resetForTesting };
