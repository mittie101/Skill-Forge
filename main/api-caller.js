'use strict';

// ── Shared non-streaming API caller ──
// Single source of truth for ipc/build.js and ipc/review.js.
// Any fix to headers, endpoints, or body-read timeout applies everywhere.

const { apiErrorCode } = require('../main/stream');

/**
 * Resolves after `ms` milliseconds.
 * @param {number} ms
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Call the Anthropic or OpenAI messages API (non-streaming).
 *
 * @param {string} provider   'anthropic' | 'openai'
 * @param {string} key        Decrypted API key
 * @param {object} opts
 * @param {string}        opts.model
 * @param {string}        opts.system
 * @param {object[]}      opts.messages
 * @param {number}        opts.maxTokens
 * @param {AbortSignal}   opts.signal
 * @returns {Promise<{rawText: string, inputTokens: number, outputTokens: number}>}
 */
async function callApi(provider, key, { model, system, messages, maxTokens, signal }) {
    // Wrap response.json() in a race against the abort signal so a stalled
    // response body (headers sent, body delayed) doesn't block indefinitely.
    // Early-exit if the signal is already aborted before we even start the race —
    // the 'abort' event has already fired and will never fire again.
    function _jsonWithTimeout(response) {
        if (signal.aborted) return Promise.reject(new Error('Body read timed out'));
        return Promise.race([
            response.json(),
            new Promise((_, reject) => {
                signal.addEventListener('abort', () =>
                    reject(new Error('Body read timed out')), { once: true });
            }),
        ]);
    }

    let response;
    if (provider === 'openai') {
        response = await fetch('https://api.openai.com/v1/chat/completions', {
            method:  'POST',
            headers: { 'Authorization': `Bearer ${key}`, 'content-type': 'application/json' },
            body: JSON.stringify({
                model,
                max_tokens: maxTokens,
                // OpenAI takes system as a prefixed message
                messages: system ? [{ role: 'system', content: system }, ...messages] : messages,
                stream: false,
            }),
            signal,
        });
        if (!response.ok) { const e = new Error(`HTTP ${response.status}`); e.statusCode = response.status; throw e; }
        const data = await _jsonWithTimeout(response);
        return {
            rawText:      data.choices?.[0]?.message?.content ?? '',
            inputTokens:  data.usage?.prompt_tokens     ?? 0,
            outputTokens: data.usage?.completion_tokens ?? 0,
        };
    } else {
        response = await fetch('https://api.anthropic.com/v1/messages', {
            method:  'POST',
            headers: {
                'x-api-key':         key,
                'anthropic-version': '2023-06-01',
                'content-type':      'application/json',
            },
            body: JSON.stringify({
                model,
                max_tokens: maxTokens,
                system,    // Anthropic takes system as top-level field
                messages,
                stream: false,
            }),
            signal,
        });
        if (!response.ok) { const e = new Error(`HTTP ${response.status}`); e.statusCode = response.status; throw e; }
        const data = await _jsonWithTimeout(response);
        return {
            rawText:      data.content?.[0]?.text ?? '',
            inputTokens:  data.usage?.input_tokens  ?? 0,
            outputTokens: data.usage?.output_tokens ?? 0,
        };
    }
}

module.exports = { callApi, sleep, apiErrorCode };
