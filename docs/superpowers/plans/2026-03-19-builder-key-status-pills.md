# Builder Key Status Pills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two permanent pill badges (Anthropic / OpenAI) to the Builder view output toolbar showing green/red dots for API key presence, polling every 5 seconds.

**Architecture:** Pure renderer change — no new IPC. The existing `has-api-key` IPC handler is called from a new `_refreshKeyStatus()` function inside the existing `builder.js` IIFE. A module-level `keyStatusTimer` stores the interval handle. CSS is appended to `styles-views.css`.

**Tech Stack:** Vanilla JS, CSS custom properties, existing `window.skillforge.hasApiKey(provider)` preload API.

**Spec:** `docs/superpowers/specs/2026-03-19-builder-key-status-pills-design.md`

---

### Task 1: Add key status HTML + JS to builder.js

**Files:**
- Modify: `src/views/builder.js`

No automated tests exist for renderer JS in this codebase (browser IIFE, no Jest coverage). Verification is manual via `npm start`.

- [ ] **Step 1: Add `keyStatusTimer` module-level variable**

In `src/views/builder.js`, find the block of `let` declarations at the top of the IIFE (lines 5–14). Add after `let suggestTimer = null;`:

```js
let keyStatusTimer  = null;
```

- [ ] **Step 2: Add `b-key-status` div to the HTML template**

In `_html()`, find the `.output-meta` div (currently reads):
```html
      <div class="output-meta" style="padding-right:12px;">
        <button id="b-btn-copy" class="btn btn-ghost btn-sm" disabled>Copy</button>
        <button id="b-btn-save" class="btn btn-secondary btn-sm" disabled>Save…</button>
      </div>
```
Replace with:
```html
      <div class="output-meta" style="padding-right:12px;">
        <div id="b-key-status" class="key-status-bar"></div>
        <button id="b-btn-copy" class="btn btn-ghost btn-sm" disabled>Copy</button>
        <button id="b-btn-save" class="btn btn-secondary btn-sm" disabled>Save…</button>
      </div>
```

- [ ] **Step 3: Cache the keyStatus DOM ref**

In `mount()`, find the `_dom = { ... }` object literal. Add after the `statsCost` entry (the last entry in the object):
```js
keyStatus:    document.getElementById('b-key-status'),
```

- [ ] **Step 4: Start polling after `_bindAll()`**

In `mount()`, find the line `_bindAll();` (currently the last call in mount). Add immediately after it:
```js
        // Key status polling — guard clears any stale interval on hypothetical re-mount
        if (keyStatusTimer) clearInterval(keyStatusTimer);
        _refreshKeyStatus();
        keyStatusTimer = setInterval(_refreshKeyStatus, 5000);
```

- [ ] **Step 5: Add `_refreshKeyStatus` function**

Add the following function anywhere inside the IIFE, after `_cleanup()` and before the final `window.BuilderView = ...` export line:
```js
    // ── Refresh API key status pills ──
    async function _refreshKeyStatus() {
        const el = _dom.keyStatus;
        if (!el) return;
        try {
            const [hasAnthropic, hasOpenAI] = await Promise.all([
                window.skillforge.hasApiKey('anthropic'),
                window.skillforge.hasApiKey('openai'),
            ]);
            el.innerHTML =
                `<span class="key-pill ${hasAnthropic ? 'key-ok' : 'key-missing'}">` +
                `<span class="key-dot"></span>Anthropic</span> ` +
                `<span class="key-pill ${hasOpenAI ? 'key-ok' : 'key-missing'}">` +
                `<span class="key-dot"></span>OpenAI</span>`;
        } catch {
            // Silently swallow IPC errors — leave previous pill state unchanged
        }
    }
```

- [ ] **Step 6: Verify the app starts without errors**

```bash
cd C:/projects/skill-converter/skillforge-merged
npm start
```

Expected: App opens on Builder tab. Output toolbar shows two small pills — "Anthropic" and "OpenAI" — each with a dot to the left of the Copy and Save buttons. Dot is green if a key is saved for that provider, red if not.

---

### Task 2: Add CSS for key status pills

**Files:**
- Modify: `src/styles-views.css`

- [ ] **Step 1: Append pill styles to styles-views.css**

Open `src/styles-views.css` and append the following block at the very end of the file:

```css
/* ── Builder: API key status pills ── */
.key-status-bar {
    display: flex;
    gap: 6px;
    align-items: center;
    margin-right: 8px;
}

.key-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    padding: 2px 7px;
    border-radius: 10px;
    font-weight: 500;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    color: var(--text-muted);
    white-space: nowrap;
}

.key-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
}

.key-ok  .key-dot { background: var(--success); }
.key-missing .key-dot { background: var(--danger); }
.key-ok  { color: var(--text-primary); }
```

- [ ] **Step 2: Visual verification**

With the app running (`npm start`):
- Builder tab: pills render side-by-side, visually compact, not clashing with Copy/Save buttons
- Add a key in Settings → Anthropic pill turns green within 5 seconds
- Remove the key → pill turns red within 5 seconds

- [ ] **Step 3: Run the test suite to confirm no regressions**

```bash
cd C:/projects/skill-converter/skillforge-merged
npm test
```

Expected: all 284 tests pass (CSS/HTML changes don't affect Node.js tests).

- [ ] **Step 4: Commit**

```bash
cd C:/projects/skill-converter/skillforge-merged
git add src/views/builder.js src/styles-views.css
git commit -m "feat: add live API key status pills to Builder toolbar"
```
