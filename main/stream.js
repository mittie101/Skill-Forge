'use strict';

// ── Shared streaming helpers ──
// Single source of truth for generate.js and build.js.
// Any fix to SSE parsing, retry logic, or header formats applies everywhere.

const RETRYABLE   = new Set(['api_429', 'api_5xx', 'network_error']);
const MAX_RETRIES = 2;
const BACKOFF_MS  = [2000, 6000];

function _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Map an HTTP error to a stable error code string.
 * @param {Error} err
 * @returns {string}
 */
function apiErrorCode(err) {
    const s = err.statusCode;
    if (s === 401) return 'api_401';
    if (s === 429) return 'api_429';
    if (s >= 500)  return 'api_5xx';
    return 'network_error';
}

/**
 * Stream from the Anthropic messages API (SSE).
 * @param {object} opts
 * @param {AbortSignal} opts.signal
 * @param {string}      opts.key
 * @param {string}      opts.model
 * @param {number}      opts.maxTokens
 * @param {string}      opts.system
 * @param {object[]}    opts.messages
 * @param {Function}    opts.onChunk      Called with each text chunk string
 * @param {object}      [opts.win]        BrowserWindow for IPC forwarding
 * @param {string}      [opts.chunkEvent] IPC event name
 * @returns {Promise<{inputTokens: number, outputTokens: number}>}
 */
async function streamAnthropic({ signal, key, model, maxTokens, system, messages, onChunk, win, chunkEvent }) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key':         key,
            'anthropic-version': '2023-06-01',
            'content-type':      'application/json',
        },
        body: JSON.stringify({ model, max_tokens: maxTokens, system, messages, stream: true }),
        signal,
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

    try {
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
                        inputTokens = parsed.message?.usage?.input_tokens ?? 0;
                    } else if (parsed.type === 'message_delta' && parsed.usage) {
                        outputTokens = parsed.usage.output_tokens ?? 0;
                    } else if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                        const chunk = parsed.delta.text;
                        onChunk(chunk);
                        if (win && !win.isDestroyed() && chunkEvent) {
                            win.webContents.send(chunkEvent, chunk);
                        }
                    }
                } catch { /* malformed SSE line — skip */ }
            }
        }
        // Flush any final unterminated line left in the buffer (network-drop recovery)
        if (sseBuffer.trim() && sseBuffer.startsWith('data: ')) {
            const data = sseBuffer.slice(6).trim();
            try {
                const parsed = JSON.parse(data);
                if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                    const chunk = parsed.delta.text;
                    onChunk(chunk);
                    if (win && !win.isDestroyed() && chunkEvent) {
                        win.webContents.send(chunkEvent, chunk);
                    }
                }
            } catch { /* malformed final line — skip */ }
        }
    } finally {
        try { reader.cancel(); } catch {}
    }

    return { inputTokens, outputTokens };
}

/**
 * Stream from the OpenAI chat completions API (SSE).
 * Uses stream_options.include_usage to capture exact token counts.
 */
async function streamOpenAI({ signal, key, model, maxTokens, system, messages, onChunk, win, chunkEvent }) {
    const allMessages = system
        ? [{ role: 'system', content: system }, ...messages]
        : messages;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${key}`,
            'content-type':  'application/json',
        },
        body: JSON.stringify({
            model,
            max_tokens:     maxTokens,
            messages:       allMessages,
            stream:         true,
            stream_options: { include_usage: true },
        }),
        signal,
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

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            sseBuffer += decoder.decode(value, { stream: true });

            const lines = sseBuffer.split('\n');
            sseBuffer   = lines.pop();

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const data = line.slice(6).trim();
                if (data === '[DONE]') continue; // sentinel — compile AFTER loop
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.usage) {
                        inputTokens  = parsed.usage.prompt_tokens     ?? 0;
                        outputTokens = parsed.usage.completion_tokens ?? 0;
                    }
                    const chunk = parsed.choices?.[0]?.delta?.content;
                    if (chunk) {
                        onChunk(chunk);
                        if (win && !win.isDestroyed() && chunkEvent) {
                            win.webContents.send(chunkEvent, chunk);
                        }
                    }
                } catch { /* malformed SSE line — skip */ }
            }
        }
        // Flush any final unterminated line left in the buffer (network-drop recovery)
        if (sseBuffer.trim() && sseBuffer.startsWith('data: ')) {
            const data = sseBuffer.slice(6).trim();
            if (data !== '[DONE]') {
                try {
                    const parsed = JSON.parse(data);
                    const chunk = parsed.choices?.[0]?.delta?.content;
                    if (chunk) {
                        onChunk(chunk);
                        if (win && !win.isDestroyed() && chunkEvent) {
                            win.webContents.send(chunkEvent, chunk);
                        }
                    }
                } catch { /* malformed final line — skip */ }
            }
        }
    } finally {
        try { reader.cancel(); } catch {}
    }

    return { inputTokens, outputTokens };
}

/**
 * Stream with exponential backoff retry on transient errors.
 *
 * @param {object}   opts
 * @param {string}   opts.provider         'anthropic' | 'openai'
 * @param {string}   opts.logPrefix        e.g. '[generate]'
 * @param {Function} opts.isAborted        Returns true if user stopped
 * @param {number}   [opts.timeoutMs]      Hard per-attempt timeout (default 90s)
 * @param {AbortController} opts.abortController  Caller-managed abort controller
 * @param {...}      ...streamOpts         Forwarded to streamAnthropic/streamOpenAI
 * @returns {Promise<{inputTokens: number, outputTokens: number}>}
 */
async function streamWithRetry({ provider, logPrefix, isAborted, timeoutMs, abortController, ...streamOpts }) {
    let attempt = 0;

    while (true) {
        const signal = AbortSignal.any([
            abortController.signal,
            AbortSignal.timeout(timeoutMs ?? 90_000),
        ]);

        try {
            const fn = provider === 'openai' ? streamOpenAI : streamAnthropic;
            return await fn({ signal, ...streamOpts });
        } catch (err) {
            if (err.name === 'AbortError') throw err; // user stop or timeout — don't retry

            const code = apiErrorCode(err);
            if (!RETRYABLE.has(code) || attempt >= MAX_RETRIES) throw err;

            const delay = BACKOFF_MS[attempt] ?? 6000;
            await _sleep(delay);
            attempt++;

            if (isAborted()) throw Object.assign(new Error('AbortError'), { name: 'AbortError' });
        }
    }
}

module.exports = { streamWithRetry, apiErrorCode, streamAnthropic, streamOpenAI };
