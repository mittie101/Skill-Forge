# Builder View — API Key Status Pills

**Date:** 2026-03-19
**Status:** Approved
**Scope:** `src/views/builder.js`, `src/styles-views.css`

---

## Problem

The Builder (Outliner) view gives no feedback about whether API keys are configured. Users discover missing keys only after clicking "Create Outline" and receiving an error toast.

---

## Solution

Add two permanent pill badges in the output toolbar — one for Anthropic, one for OpenAI — each showing a coloured dot indicating key presence. Polls every 5 seconds so the status stays live without requiring re-mount.

---

## UI Placement

Inside the existing `.output-meta` div in the output toolbar, **before** the Copy and Save buttons:

```
[● Anthropic]  [● OpenAI]   [Copy]  [Save…]
```

- Green dot (`var(--success)`) = key is saved
- Red dot (`var(--danger)`) = key is missing
- Both pills are always visible (not conditional on provider selection)

---

## Implementation

### `src/views/builder.js`

`builder.js` already exists as a module-level IIFE. It has a module-level `let _dom = {}` object (populated in `mount()`) and a module-level `let _mounted = false` flag. All additions follow this existing pattern.

**1. New module-level variable** — add alongside the other `let` declarations at the top of the IIFE:
```js
let keyStatusTimer = null;
```

**2. DOM cache** — add to the `_dom` object populated in `mount()`:
```js
keyStatus: document.getElementById('b-key-status'),
```

**3. HTML** — the existing `.output-meta` div in `_html()` currently reads:
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

**4. Start polling in `mount()`** — after the `_bindAll()` call:
```js
// Start key-status polling (guard prevents double-interval on hypothetical re-mount)
if (keyStatusTimer) clearInterval(keyStatusTimer);
_refreshKeyStatus();
keyStatusTimer = setInterval(_refreshKeyStatus, 5000);
```

**5. New function** — add alongside other private functions:
```js
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

### `src/styles-views.css`

Append inside the existing `/* Builder */` section (or at the end of the file):

```css
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

All CSS variables (`--bg-elevated`, `--border`, `--text-muted`, `--text-primary`, `--success`, `--danger`) are confirmed present in `src/styles.css`.

---

## Behaviour Notes

- `keyStatusTimer` is stored at module level and cleared before starting a new interval — defends against any future re-mount scenario.
- `_refreshKeyStatus()` fires immediately on mount so there is no blank-state flash.
- On IPC error, the catch block silently does nothing — pills retain their last rendered state (or remain empty on first call failure).
- Both providers are always checked regardless of which provider is selected in the toggle. This lets users see at a glance whether either key is missing.
- The 5-second poll catches keys added or cleared in the Settings view without requiring navigation.

---

## Files Changed

| File | Change |
|---|---|
| `src/views/builder.js` | Add `keyStatusTimer` module var; add `b-key-status` div to HTML; cache `keyStatus` DOM ref; start interval after `_bindAll()`; add `_refreshKeyStatus()` function |
| `src/styles-views.css` | Append `.key-status-bar`, `.key-pill`, `.key-dot`, `.key-ok`, `.key-missing` styles |

---

## Out of Scope

- No changes to other views (Generator, Install, History, Settings)
- No new IPC channels — uses existing `has-api-key` handler
- No changes to the provider toggle behaviour
