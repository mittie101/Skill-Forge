'use strict';

jest.mock('electron');
jest.mock('../../main/db/settings');
jest.mock('../../main/storage');

const { ipcMain, BrowserWindow } = require('electron');
const { getSetting }             = require('../../main/db/settings');
const { decryptKey }             = require('../../main/storage');

// ── Helpers ──

function invoke(channel, ...args) {
    return ipcMain._invoke(channel, { sender: { send: jest.fn() } }, ...args);
}

// Build a minimal valid ReviewResult JSON string
function _makeReviewJson(overrides = {}) {
    const cats = [
        { name: 'Trigger Accuracy',          score: 18, max: 20, issues: [],            verdict: 'Good' },
        { name: 'Instruction Precision',     score: 16, max: 20, issues: ['Too vague'], verdict: 'Needs work' },
        { name: 'Output Specificity',        score: 12, max: 15, issues: [],            verdict: 'OK' },
        { name: 'Hard Rule Quality',         score: 13, max: 15, issues: [],            verdict: 'Good' },
        { name: 'Example Request Coverage',  score:  9, max: 10, issues: [],            verdict: 'Good' },
        { name: 'Edge Case Utility',         score:  8, max: 10, issues: [],            verdict: 'OK' },
        { name: 'Readability & Frontmatter', score:  9, max: 10, issues: [],            verdict: 'Good' },
    ];
    return JSON.stringify({
        categories:      overrides.categories ?? cats,
        total:           overrides.total       ?? 85,
        overall_verdict: overrides.overall_verdict ?? 'Good skill.',
        perfect:         overrides.perfect     ?? false,
        improvements:    overrides.improvements ?? ['Improve instruction precision'],
    });
}

// Minimal valid skill markdown
const VALID_SKILL_MD = `---
name: test-skill
description: A test skill for integration tests.
version: 1
framework: claude
created_at: 2026-01-01T00:00:00.000Z
---

# test-skill

One-line purpose.

## When to use
- Always use before starting any task.
- Use when relevant.

## Example requests
- Example one
- Example two
- Example three
- Example four
- Example five

## Expected inputs
- User provides context.

## Expected outputs
- A structured result.

## Instructions
1. Read input.
2. Identify requirements.
3. Apply knowledge.
4. Produce output.
5. Verify.

## Hard rules
- ALWAYS follow the canonical schema.
- NEVER invent facts.
- ALWAYS verify output.

## Edge cases
- Scenario: Empty input.
  Mitigation: Return error.
- Scenario: Ambiguous input.
  Mitigation: Ask for clarification.
- Scenario: Oversized input.
  Mitigation: Truncate and warn.
`;

// Mock fetch to return a successful API response (non-streaming — used by review-skill)
function _mockFetchSuccess(responseText) {
    global.fetch = jest.fn(() =>
        Promise.resolve({
            ok:   true,
            status: 200,
            json: () => Promise.resolve({
                content: [{ text: responseText }],
                usage:   { input_tokens: 100, output_tokens: 200 },
            }),
        })
    );
}

// Build a mock ReadableStream body with Anthropic SSE format (used by fix-skill streaming)
function _makeStreamBody(chunks) {
    let i = 0;
    return {
        getReader() {
            return {
                read()   { return i < chunks.length
                    ? Promise.resolve({ done: false, value: chunks[i++] })
                    : Promise.resolve({ done: true,  value: undefined }); },
                cancel() { return Promise.resolve(); },
            };
        },
    };
}

function _mockFetchStreamSuccess(responseText) {
    const encoder = new TextEncoder();
    const sse = [
        `data: ${JSON.stringify({ type: 'message_start', message: { usage: { input_tokens: 100 } } })}`,
        `data: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: responseText } })}`,
        `data: ${JSON.stringify({ type: 'message_delta', usage: { output_tokens: 200 } })}`,
        'data: {"type":"message_stop"}',
        '',
    ].join('\n\n');
    global.fetch = jest.fn(() => Promise.resolve({
        ok: true, status: 200,
        body: _makeStreamBody([encoder.encode(sse)]),
    }));
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
    const reviewModule = require('../../ipc/review');
    reviewModule._setRetryDelayFn(() => 0); // zero-delay retries in tests
    reviewModule.register();
});

beforeEach(() => {
    jest.clearAllMocks();

    // Default: anthropic provider with a valid key
    getSetting.mockImplementation((key) => {
        if (key === 'provider')                        return 'anthropic';
        if (key === 'api_key_cipher_anthropic')        return 'encrypted_key';
        if (key === 'anthropic_model')                 return 'claude-sonnet-4-20250514';
        if (key === 'max_tokens')                      return '4096';
        return null;
    });
    decryptKey.mockReturnValue('sk-ant-test-key-123');

    // Reset global fetch
    global.fetch = undefined;
});

// ─────────────────────────────────────────────────────────────────────────────
// review-skill
// ─────────────────────────────────────────────────────────────────────────────

describe('review-skill', () => {
    it('returns normalised valid ReviewResult on success', async () => {
        _mockFetchSuccess(_makeReviewJson());

        const result = await invoke('review-skill', { content: VALID_SKILL_MD });
        expect(result.ok).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data.categories).toHaveLength(7);
        expect(typeof result.data.total).toBe('number');
        expect(typeof result.data.perfect).toBe('boolean');
        expect(Array.isArray(result.data.improvements)).toBe(true);
        expect(typeof result.costUsd).toBe('number');
        expect(result.costUsd).toBeGreaterThan(0);
    });

    it('recomputes total from category scores (ignores model total)', async () => {
        _mockFetchSuccess(_makeReviewJson({ total: 0 })); // model returns wrong total
        const result = await invoke('review-skill', { content: VALID_SKILL_MD });
        expect(result.ok).toBe(true);
        const expectedTotal = result.data.categories.reduce((s, c) => s + c.score, 0);
        expect(result.data.total).toBe(expectedTotal);
    });

    it('overwrites model max values with canonical values', async () => {
        const cats = JSON.parse(_makeReviewJson()).categories;
        cats[0].max = 999; // model lying
        _mockFetchSuccess(JSON.stringify({ categories: cats, total: 85, overall_verdict: '', perfect: false, improvements: ['fix'] }));
        const result = await invoke('review-skill', { content: VALID_SKILL_MD });
        expect(result.ok).toBe(true);
        expect(result.data.categories[0].max).toBe(20);
    });

    it('fails gracefully on completely malformed model output', async () => {
        _mockFetchSuccess('This is not JSON at all!!! The model went off rails.');
        const result = await invoke('review-skill', { content: VALID_SKILL_MD });
        expect(result.ok).toBe(false);
        expect(typeof result.error).toBe('string');
    });

    it('fails gracefully on model output with wrong category names', async () => {
        const bad = _makeReviewJson();
        const parsed = JSON.parse(bad);
        parsed.categories[0].name = 'Wrong Category Name';
        _mockFetchSuccess(JSON.stringify(parsed));
        const result = await invoke('review-skill', { content: VALID_SKILL_MD });
        expect(result.ok).toBe(false);
    });

    it('fails gracefully on provider HTTP 401 error', async () => {
        _mockFetchError(401);
        const result = await invoke('review-skill', { content: VALID_SKILL_MD });
        expect(result.ok).toBe(false);
        expect(result.error).toBe('api_401');
    });

    it('fails gracefully on provider HTTP 429 error', async () => {
        _mockFetchError(429);
        const result = await invoke('review-skill', { content: VALID_SKILL_MD });
        expect(result.ok).toBe(false);
        expect(result.error).toBe('api_429');
    });

    it('returns no_key error when no API key is set', async () => {
        getSetting.mockImplementation((key) => {
            if (key === 'provider') return 'anthropic';
            return null; // no cipher
        });
        const result = await invoke('review-skill', { content: VALID_SKILL_MD });
        expect(result.ok).toBe(false);
        expect(result.error).toBe('no_key');
    });

    it('returns error for empty content', async () => {
        const result = await invoke('review-skill', { content: '' });
        expect(result.ok).toBe(false);
    });

    it('returns error for missing content', async () => {
        const result = await invoke('review-skill', {});
        expect(result.ok).toBe(false);
    });

    it('serialises concurrent review calls via shared mutex', async () => {
        // Mock fetch with a slight delay
        let callCount = 0;
        global.fetch = jest.fn(() => new Promise(resolve => {
            callCount++;
            setTimeout(() => {
                resolve({
                    ok:     true,
                    status: 200,
                    json:   () => Promise.resolve({
                        content: [{ text: _makeReviewJson() }],
                        usage:   { input_tokens: 10, output_tokens: 20 },
                    }),
                });
            }, 10);
        }));

        // Fire two concurrent review calls
        const [r1, r2] = await Promise.all([
            invoke('review-skill', { content: VALID_SKILL_MD }),
            invoke('review-skill', { content: VALID_SKILL_MD }),
        ]);

        // One must succeed, the other must be blocked (mutex serialises)
        const results = [r1, r2];
        const successes = results.filter(r => r.ok);
        const blocked   = results.filter(r => !r.ok);
        expect(successes.length).toBe(1);
        expect(blocked.length).toBe(1);
        expect(blocked[0].error).toMatch(/in progress/i);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// fix-skill
// ─────────────────────────────────────────────────────────────────────────────

describe('fix-skill', () => {
    const IMPROVEMENTS    = ['Add more example requests', 'Prefix hard rules with ALWAYS/NEVER'];
    const SCORE_BREAKDOWN = [
        { name: 'Trigger Accuracy', score: 15, max: 20, issues: ['Too vague'], verdict: 'Needs work' },
    ];

    it('returns ok:true with processed content on success', async () => {
        _mockFetchStreamSuccess(VALID_SKILL_MD);

        const result = await invoke('fix-skill', {
            content:        VALID_SKILL_MD,
            improvements:   IMPROVEMENTS,
            scoreBreakdown: SCORE_BREAKDOWN,
        });

        expect(result.ok).toBe(true);
        expect(result.data.content).toBeTruthy();
        expect(typeof result.data.content).toBe('string');
        expect(typeof result.costUsd).toBe('number');
        expect(result.costUsd).toBeGreaterThanOrEqual(0);
    });

    it('injects created_at into returned content', async () => {
        const skillWithoutDate = VALID_SKILL_MD.replace(/^created_at:.*\n/m, '');
        _mockFetchStreamSuccess(skillWithoutDate);

        const result = await invoke('fix-skill', {
            content:        VALID_SKILL_MD,
            improvements:   IMPROVEMENTS,
            scoreBreakdown: SCORE_BREAKDOWN,
        });

        expect(result.ok).toBe(true);
        expect(result.data.content).toMatch(/created_at: "\d{4}-\d{2}-\d{2}T/);
    });

    it('bumps version in returned content', async () => {
        _mockFetchStreamSuccess(VALID_SKILL_MD); // version: 1 in mock response

        const result = await invoke('fix-skill', {
            content:        VALID_SKILL_MD,
            improvements:   IMPROVEMENTS,
            scoreBreakdown: SCORE_BREAKDOWN,
        });

        expect(result.ok).toBe(true);
        expect(result.data.content).toContain('version: 2');
    });

    it('sets version to 1 when model omits it', async () => {
        const noVersion = VALID_SKILL_MD.replace(/^version: \d+\n/m, '');
        _mockFetchStreamSuccess(noVersion);

        const result = await invoke('fix-skill', {
            content:        VALID_SKILL_MD,
            improvements:   IMPROVEMENTS,
            scoreBreakdown: SCORE_BREAKDOWN,
        });

        expect(result.ok).toBe(true);
        expect(result.data.content).toContain('version: 1');
    });

    it('fails gracefully on provider error', async () => {
        _mockFetchError(500);

        const result = await invoke('fix-skill', {
            content:        VALID_SKILL_MD,
            improvements:   IMPROVEMENTS,
            scoreBreakdown: SCORE_BREAKDOWN,
        });

        expect(result.ok).toBe(false);
        expect(result.error).toBe('api_5xx');
    });

    it('returns error when improvements array is empty', async () => {
        const result = await invoke('fix-skill', {
            content:        VALID_SKILL_MD,
            improvements:   [],
            scoreBreakdown: SCORE_BREAKDOWN,
        });
        expect(result.ok).toBe(false);
    });

    it('returns error when content is missing', async () => {
        const result = await invoke('fix-skill', {
            improvements:   IMPROVEMENTS,
            scoreBreakdown: SCORE_BREAKDOWN,
        });
        expect(result.ok).toBe(false);
    });

    it('sends fix-chunk to renderer window on success', async () => {
        _mockFetchStreamSuccess(VALID_SKILL_MD);

        const mockWin = BrowserWindow._mockWin;
        mockWin.webContents.send.mockClear();

        await invoke('fix-skill', {
            content:        VALID_SKILL_MD,
            improvements:   IMPROVEMENTS,
            scoreBreakdown: SCORE_BREAKDOWN,
        });

        expect(mockWin.webContents.send).toHaveBeenCalledWith('fix-chunk', expect.any(String));
    });

    it('cannot run concurrently with review-skill (shared mutex)', async () => {
        // Mock fetch with delay so review occupies mutex
        global.fetch = jest.fn(() => new Promise(resolve => {
            setTimeout(() => {
                resolve({
                    ok:     true,
                    status: 200,
                    json:   () => Promise.resolve({
                        content: [{ text: _makeReviewJson() }],
                        usage:   { input_tokens: 10, output_tokens: 20 },
                    }),
                });
            }, 20);
        }));

        const [reviewResult, fixResult] = await Promise.all([
            invoke('review-skill', { content: VALID_SKILL_MD }),
            invoke('fix-skill', {
                content:        VALID_SKILL_MD,
                improvements:   IMPROVEMENTS,
                scoreBreakdown: SCORE_BREAKDOWN,
            }),
        ]);

        // One of them must be blocked by the mutex
        const blocked = [reviewResult, fixResult].filter(r => !r.ok && /in progress/i.test(r.error ?? ''));
        expect(blocked.length).toBeGreaterThanOrEqual(1);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// review-stop
// ─────────────────────────────────────────────────────────────────────────────

describe('review-stop', () => {
    it('returns ok:true', async () => {
        const result = await invoke('review-stop');
        expect(result).toEqual({ ok: true });
    });

    it('is a harmless no-op after a completed review (mutex properly released)', async () => {
        _mockFetchSuccess(_makeReviewJson());
        await invoke('review-skill', { content: VALID_SKILL_MD });

        const stopResult = await invoke('review-stop');
        expect(stopResult).toEqual({ ok: true });

        // Mutex was properly released — another review should succeed
        _mockFetchSuccess(_makeReviewJson());
        const second = await invoke('review-skill', { content: VALID_SKILL_MD });
        expect(second.ok).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Re-Review flow
// ─────────────────────────────────────────────────────────────────────────────

describe('Re-Review flow', () => {
    it('review-skill accepts fixed skill content without transformation bugs', async () => {
        // Simulate the full loop: fix returns a skill, then review consumes it
        const FIXED_SKILL = VALID_SKILL_MD
            .replace(/^version: 1/m, 'version: 2')
            .replace(/^created_at:.*$/m, 'created_at: 2026-03-21T12:00:00.000Z');

        // First call: fix produces FIXED_SKILL
        _mockFetchStreamSuccess(VALID_SKILL_MD); // raw response, handler will bump version

        const fixResult = await invoke('fix-skill', {
            content:        VALID_SKILL_MD,
            improvements:   ['Improve instructions'],
            scoreBreakdown: [{ name: 'Trigger Accuracy', score: 15, max: 20, issues: [], verdict: '' }],
        });
        expect(fixResult.ok).toBe(true);

        const fixedContent = fixResult.data.content;

        // Second call: review uses the fixed content
        _mockFetchSuccess(_makeReviewJson({ total: 95, improvements: [] }));

        const reviewResult = await invoke('review-skill', { content: fixedContent });
        expect(reviewResult.ok).toBe(true);
        expect(reviewResult.data.total).toBeGreaterThanOrEqual(0);
        expect(reviewResult.data.categories).toHaveLength(7);
    });
});
