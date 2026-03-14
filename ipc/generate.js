'use strict';

const { ipcMain, BrowserWindow } = require('electron');
const { validateJson }            = require('../main/validators/common');
const { validateClaudeOutput }    = require('../main/validators/claude');
const { validateChatGPTOutput }   = require('../main/validators/chatgpt');
const { validateLangChainOutput } = require('../main/validators/langchain');
const { renderClaude }    = require('../main/framework-renderers/claude');
const { renderChatGPT }   = require('../main/framework-renderers/chatgpt');
const { renderLangChain } = require('../main/framework-renderers/langchain');
const { buildSkillPrompt } = require('../main/prompts');
const { getSetting }       = require('../main/db/settings');
const { decryptKey }       = require('../main/storage');
const { insertHistory }    = require('../main/db/history');
const { PROVIDERS }        = require('../main/config');
const { calculateCost }    = require('../main/pricing');

// ── Global mutex — one stream at a time ──
let _generating      = false;
let _aborted         = false;
let _abortController = null;

// Hard timeout: if the stream produces no bytes for 90 s, abort.
const STREAM_TIMEOUT_MS = 90_000;

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

// ── Anthropic streaming ──
// Returns { inputTokens, outputTokens } from SSE usage events.
async function _streamAnthropic(win, key, system, messages, chunkEvent, onChunk) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method:  'POST',
        headers: {
            'x-api-key':         key,
            'anthropic-version': '2023-06-01',
            'content-type':      'application/json',
        },
        body: JSON.stringify({
            model:      PROVIDERS.anthropic.model,
            max_tokens: 4096,
            system,
            messages,
            stream: true,
        }),
        signal: AbortSignal.any([
            _abortController.signal,
            AbortSignal.timeout(STREAM_TIMEOUT_MS),
        ]),
    });

    if (!response.ok) {
        const err = new Error(`HTTP ${response.status}`);
        err.statusCode = response.status;
        throw err;
    }

    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let sseBuffer    = '';
    let inputTokens  = 0;
    let outputTokens = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });

        const lines = sseBuffer.split('\n');
        sseBuffer   = lines.pop(); // keep incomplete line

        for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            try {
                const parsed = JSON.parse(data);

                if (parsed.type === 'message_start') {
                    // Exact input token count from the API
                    inputTokens = parsed.message?.usage?.input_tokens ?? 0;
                } else if (parsed.type === 'message_delta' && parsed.usage) {
                    // Final output token count on stream completion
                    outputTokens = parsed.usage.output_tokens ?? 0;
                } else if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                    const chunk = parsed.delta.text;
                    onChunk(chunk);
                    if (win && !win.isDestroyed()) win.webContents.send(chunkEvent, chunk);
                }
            } catch { /* malformed SSE line — skip */ }
        }
    }

    return { inputTokens, outputTokens };
}

// ── OpenAI streaming ──
// Returns { inputTokens, outputTokens } from the final usage chunk.
async function _streamOpenAI(win, key, system, messages, chunkEvent, onChunk) {
    const allMessages = system
        ? [{ role: 'system', content: system }, ...messages]
        : messages;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method:  'POST',
        headers: {
            'Authorization': `Bearer ${key}`,
            'content-type':  'application/json',
        },
        body: JSON.stringify({
            model:          PROVIDERS.openai.model,
            max_tokens:     4096,
            messages:       allMessages,
            stream:         true,
            stream_options: { include_usage: true }, // enables final usage chunk
        }),
        signal: AbortSignal.any([
            _abortController.signal,
            AbortSignal.timeout(STREAM_TIMEOUT_MS),
        ]),
    });

    if (!response.ok) {
        const err = new Error(`HTTP ${response.status}`);
        err.statusCode = response.status;
        throw err;
    }

    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let sseBuffer    = '';
    let inputTokens  = 0;
    let outputTokens = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });

        const lines = sseBuffer.split('\n');
        sseBuffer   = lines.pop();

        for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue; // sentinel — compile AFTER loop, never here
            try {
                const parsed = JSON.parse(data);

                // Final usage chunk (stream_options.include_usage = true)
                if (parsed.usage) {
                    inputTokens  = parsed.usage.prompt_tokens     ?? 0;
                    outputTokens = parsed.usage.completion_tokens ?? 0;
                }

                const chunk = parsed.choices?.[0]?.delta?.content;
                if (chunk) {
                    onChunk(chunk);
                    if (win && !win.isDestroyed()) win.webContents.send(chunkEvent, chunk);
                }
            } catch { /* malformed SSE line — skip */ }
        }
    }

    return { inputTokens, outputTokens };
}

// ── Map HTTP status to error code ──
function _apiErrorCode(err) {
    const s = err.statusCode;
    if (s === 401) return 'api_401';
    if (s === 429) return 'api_429';
    if (s >= 500)  return 'api_5xx';
    return 'network_error';
}

// ── Retryable codes ──
const _RETRYABLE = new Set(['api_429', 'api_5xx', 'network_error']);
const _MAX_RETRIES   = 2;
const _BACKOFF_MS    = [2000, 6000]; // delay before attempt 2 and 3

function _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Returns { inputTokens, outputTokens } on success.
async function _streamWithRetry(provider, win, key, system, messages, chunkEvent, onChunk) {
    let attempt = 0;
    while (true) {
        try {
            if (provider === 'openai') {
                return await _streamOpenAI(win, key, system, messages, chunkEvent, onChunk);
            } else {
                return await _streamAnthropic(win, key, system, messages, chunkEvent, onChunk);
            }
        } catch (err) {
            if (err.name === 'AbortError') throw err; // user stop — don't retry

            const code = _apiErrorCode(err);
            if (!_RETRYABLE.has(code) || attempt >= _MAX_RETRIES) throw err;

            const delay = _BACKOFF_MS[attempt] ?? 6000;
            console.warn(`[generate] Retrying after ${delay}ms (attempt ${attempt + 1}/${_MAX_RETRIES}): ${err.message}`);
            await _sleep(delay);
            attempt++;

            // Check if user aborted during sleep
            if (_aborted) throw Object.assign(new Error('AbortError'), { name: 'AbortError' });
        }
    }
}

function register() {
    ipcMain.handle('generate', async (e, formData) => {
        if (_generating) return { error: 'generation_in_progress' };
        _generating      = true;
        _aborted         = false;
        _abortController = new AbortController();

        const win    = BrowserWindow.fromWebContents(e.sender);
        const isTest = !!formData.isTest;

        const chunkEvent = isTest ? 'test-stream-chunk' : 'stream-chunk';
        const endEvent   = isTest ? 'test-stream-end'   : 'stream-end';

        // ── Resolve key + provider ──
        const provider = getSetting('provider') || 'anthropic';
        const cipher   = getSetting('api_key_cipher');
        const key      = cipher ? decryptKey(cipher) : null;

        if (!key) {
            _generating = false;
            if (win && !win.isDestroyed()) {
                win.webContents.send(endEvent, { ok: false, error: 'no_key', isTest });
            }
            return { ok: true };
        }

        // ── Read privacy mode before stream starts ──
        const privacyMode = getSetting('privacy_mode') === 'true';

        // ── Build prompt ──
        let system, messages;
        if (isTest) {
            // Test panel: use compiled skill as system, test message as user
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
            const usage  = await _streamWithRetry(provider, win, key, system, messages, chunkEvent, onChunk);
            inputTokens  = usage?.inputTokens  ?? 0;
            outputTokens = usage?.outputTokens ?? 0;
        } catch (err) {
            if (err.name !== 'AbortError') {
                // Real API / network error
                const errorCode = _apiErrorCode(err);
                console.warn(`[generate] API error: ${err.message}`);
                if (win && !win.isDestroyed()) {
                    win.webContents.send(endEvent, {
                        ok: false, error: errorCode, rawText: rawBuffer, isTest,
                    });
                }
                _generating = false;
                _abortController = null;
                return { ok: true };
            }
            // AbortError = user pressed Stop — fall through to partial handling
            _aborted = true;
        }

        // ── Post-stream: calculate cost ──
        const model   = PROVIDERS[provider]?.model ?? provider;
        const costUsd = calculateCost(provider, model, inputTokens, outputTokens);

        // ── Post-stream: compile (runs ONLY after reader loop exits) ──
        const partial  = _aborted;
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
                } catch (dbErr) {
                    console.warn('[generate] History insert failed:', dbErr.message);
                }
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

        _generating      = false;
        _abortController = null;
        return { ok: true };
    });

    ipcMain.handle('stop-generation', () => {
        _aborted = true;
        _abortController?.abort();
        return { ok: true };
    });

    ipcMain.handle('get-presets', () => {
        return require('../main/presets').getPresets();
    });
}

// Exposed for test isolation — resets module-level mutex state between tests
function _resetForTesting() {
    _generating      = false;
    _aborted         = false;
    _abortController = null;
}

module.exports = { register, _resetForTesting };
