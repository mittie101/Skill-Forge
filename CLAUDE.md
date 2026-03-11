# SkillForge — Claude Code Build Brief

## What you are building

A Windows Electron desktop app (.exe, NSIS installer) that generates LLM skill/prompt `.md` files using either the Anthropic or OpenAI API. The user fills a form, AI generates a structured skill file, the app validates it, and saves it to a user-chosen folder.

---

## Stack

- Electron (latest) + contextIsolation + sandbox + CSP
- Vanilla HTML/CSS/JS (no React, no bundler)
- better-sqlite3 (WAL mode, migrations)
- safeStorage for API key encryption
- electron-builder NSIS installer
- marked.js (CDN) for markdown preview
- Jest for tests

---

## File structure to create

```
skillforge/
├── CLAUDE.md                        ← this file
├── package.json
├── main.js                          ← thin entry point
├── preload.js
├── main/
│   ├── config.js                    ← constants, paths, CSP, caps
│   ├── window.js                    ← BrowserWindow + CSP headers
│   ├── storage.js                   ← safeStorage encrypt/decrypt
│   ├── providers.js                 ← PROVIDERS config, detectProvider()
│   ├── prompts.js                   ← system prompt library per framework
│   ├── presets.js                   ← 5 hardcoded built-in presets
│   ├── slug.js                      ← slug sanitiser + Windows reserved name check
│   └── db/
│       ├── index.js                 ← getDb(), WAL, migrations runner
│       ├── migrations.js            ← ordered SQL migration array
│       ├── history.js               ← CRUD + 100-row cap enforcement
│       └── settings.js              ← key/value settings table
├── ipc/
│   ├── index.js                     ← registerAllIpcHandlers()
│   ├── api-keys.js                  ← setApiKey, hasApiKey, getProvider, clearApiKey
│   ├── generate.js                  ← generation + streaming IPC + global mutex
│   ├── history.js                   ← list, reopen, delete, search
│   ├── settings.js                  ← load, save settings
│   └── file.js                      ← save skill, import skill, open in editor
├── main/
│   ├── framework-renderers/
│   │   ├── claude.js                ← JSON intermediate → Claude SKILL.md
│   │   ├── chatgpt.js               ← JSON intermediate → ChatGPT instructions.md
│   │   └── langchain.js             ← JSON intermediate → LangChain prompt.md
│   └── validators/
│       ├── common.js                ← form + JSON layer validation
│       ├── claude.js
│       ├── chatgpt.js
│       └── langchain.js
├── src/
│   ├── index.html                   ← shell with sidebar nav
│   ├── styles.css                   ← design tokens + base reset + components
│   ├── app.js                       ← view router, global state, unsaved-changes guard
│   ├── views/
│   │   ├── generator.js             ← form, streaming output, validation checklist
│   │   ├── history.js               ← list, search, filter, reopen
│   │   └── settings.js              ← provider, key, folder, privacy, shortcuts
│   └── lib/
│       └── toast.js                 ← toast notification component
└── tests/
    ├── unit/
    │   ├── providers.test.js
    │   ├── prompts.test.js
    │   ├── slug.test.js
    │   ├── validators.test.js
    │   └── history-cap.test.js
    ├── integration/
    │   └── ipc.test.js
    └── security/
        └── regression.test.js
```

---

## Build order — follow this sequence exactly, do not skip phases

### Phase 1 — Scaffold
- package.json with all dependencies
- main.js thin entry point
- main/window.js with nodeIntegration:false, contextIsolation:true, sandbox:true, webSecurity:true, CSP headers
- preload.js with contextBridge (stub all channels)
- ipc/index.js stub
- src/index.html shell, styles.css with design tokens, app.js stub
- Verify: app opens with no console errors

### Phase 2 — Data & State
- main/db/index.js — getDb(), WAL pragma, foreign_keys pragma
- main/db/migrations.js — schema_version, settings, skills tables, created_at index
- main/db/history.js — insert, list, delete, search, 100-row cap
- main/db/settings.js — get, set, getAll
- main/storage.js — encryptKey, decryptKey using safeStorage
- main/config.js — all constants including INPUT_CAPS
- Seed test data, verify schema with console.log

### Phase 3 — Core Logic (no UI, no real API calls)
- main/providers.js — PROVIDERS config for anthropic + openai, detectProvider()
- main/prompts.js — buildSkillPrompt(framework, formData) per framework, fenceUserInput()
- main/presets.js — 5 hardcoded presets array
- main/slug.js — sanitise(), WINDOWS_RESERVED blocklist, -skill suffix fallback
- main/framework-renderers/ — all three renderers (JSON → markdown)
- main/validators/ — all four validators (form, JSON layer, framework-specific)
- Test every function with hardcoded inputs via console.log
- Stub streaming functions — return hardcoded JSON after 500ms

### Phase 4 — UI Shell
- src/styles.css — full dark-ui-components design tokens and component styles
- src/index.html — sidebar nav (Generator / History / Settings), three view panels
- src/views/generator.js — form layout with all fields, char counters, output panel, checklist, static data
- src/views/history.js — table layout, search input, framework filter, static rows
- src/views/settings.js — provider dropdown, key field, folder picker, toggles
- Verify layout correct at 1280×800, no console errors

### Phase 5 — Wire Logic to UI
- src/app.js — view router, global state (currentView, hasUnsavedOutput, isGenerating)
- Unsaved changes guard — checkUnsavedChanges() called before ALL state-replacing actions:
  - tab navigation, history reopen, preset apply, framework switch, Ctrl+N, app close, import
  - import via file dialog is intentional — skip guard for import specifically
- ipc/api-keys.js — setApiKey (one-way), hasApiKey, getProvider, clearApiKey
- ipc/settings.js — load, save
- ipc/history.js — list, search (debounced 200ms, sequence counter), delete
- ipc/file.js — saveSkill (wx flag, EEXIST → modal), importSkill (50KB cap, UTF-8 validate, fence content), openInEditor (check shell.openPath return value)
- Keyboard shortcuts via keydown on renderer (NOT globalShortcut):
  - Ctrl+Enter → generate (routes through checkUnsavedChanges if needed)
  - Ctrl+S → save
  - Ctrl+N → clear form (routes through checkUnsavedChanges)
- Window state persistence — save/restore bounds, validate against screen.getAllDisplays() on restore, fall back to centered primary if off-screen
- Wire all form fields with input caps enforced live (char counters, disable at max)
- Wire preset dropdown — populates form fields from presets array
- Wire framework tabs
- All working with stubbed AI responses

### Phase 6 — API Integration
- ipc/generate.js — global mutex (one active stream at a time), returns {error:'generation_in_progress'} if busy
- Anthropic streaming — main process only, key read from storage never passed via IPC
- OpenAI streaming — same pattern
- Raw text buffer maintained separately from JSON parse attempt throughout stream
- Compilation (JSON parse → validate → render) runs ONLY after stream fully closed (reader exhausted), never on sentinel event alone
- Stop handler — aborts stream, preserves partial raw buffer, sets state to PARTIAL
- Framework tab switch during active stream → prompt to stop first → abort → then switch
- Retry — re-runs with same form state
- Test panel — uses same ipc/generate.js path, same mutex, responses never written to history, ephemeral only
- Verify end-to-end with real API keys

### Phase 7 — Error Handling
- All error states from spec wired to toast or modal
- Stream interruption: partial output banner, Save disabled, Copy enabled
- JSON parse failure: banner with retry
- shell.openPath failure: toast with copy-path fallback
- presets.js load: hardcoded only in v1, no file loading
- File collision (EEXIST): Overwrite / Save as copy / Cancel modal
- DB migration failure: surface error code, do not corrupt existing DB
- History LIKE search: escape % and _ before query
- Import: ENOENT and EBUSY caught explicitly
- API 401, 429, 5xx: all handled per error state table

### Phase 8 — Polish & UX
- Streaming cursor animation (blinking purple bar)
- Marked.js render for preview tab — cached, only re-renders when fullResponse changes
- Token estimate display labelled "~tokens (estimate)" with tooltip
- Validation checklist — items turn green as layers pass, red on fail
- Partial output banner styling
- Synthetic masked key display (sk-ant-••••••••) — never derived from stored value
- Privacy mode banner in history view
- Soft warning at 80 history rows
- Path preview before save updates live
- Save as copy auto-increments slug suffix

### Phase 9 — Persistence
- All settings survive app restart
- Window bounds survive restart (with off-screen guard)
- History loads on app open
- Last used framework and save mode restored
- Verify by closing and reopening app fully

### Phase 10 — Tests + Distribution
- All unit tests passing (slug, validators, providers, prompts, history cap)
- Security regression tests:
  - nodeIntegration false
  - contextIsolation true
  - sandbox true
  - webSecurity true
  - CSP set
  - getApiKey IPC handler DOES NOT EXIST (assert)
  - preload listeners return unsubscribe functions
- electron-builder NSIS config
- npm run build produces installable .exe
- Test on clean Windows machine

---

## Hard rules — never violate these

### API key security
- Plaintext key NEVER leaves main process
- preload exposes ONLY: setApiKey(key), hasApiKey(), getProvider()
- NO getApiKey() IPC handler — if you write one, delete it
- Key never in: logs, IPC responses, error objects, history rows, crash reports
- Masked UI display is synthetic string, not derived from stored value
- No clipboard copy of stored keys

### Privacy mode
- When active: zero SQLite writes related to generation sessions
- The INSERT is skipped entirely — no partial or nulled rows
- No temp files, no autosave drafts, nothing written to disk for that generation

### Generation mutex
- One streaming call active at a time across the entire app
- Test panel and generator share the same mutex
- Subsequent calls while busy return {error:'generation_in_progress'}

### Stream compilation timing
- JSON parse + validation + render runs AFTER reader loop exits (stream fully closed)
- Never trigger compilation inside SSE line parser or on [DONE] sentinel
- This prevents last-chunk-dropped bugs on OpenAI

### Keyboard shortcuts
- Use keydown event listeners on renderer
- NEVER use Electron globalShortcut for in-app shortcuts

### File write
- Use { flag: 'wx' } for exclusive create
- Catch EEXIST and present modal — no pre-check race condition

### Import security
- Imported file content treated as user data
- Must be fenced via fenceUserInput() before inclusion in any AI prompt
- Max 50KB file size, UTF-8 validated

### History search
- Escape % and _ in search terms before LIKE query
- Debounce 200ms
- Sequence counter to discard stale results

### Test panel
- Uses same IPC generate path as main generator
- Responses are ephemeral — never written to history, never persisted
- Respect privacy mode (no writes)

---

## Design system — apply consistently

```css
--bg-base:      #0a0a14
--bg-surface:   #0d0d1a
--bg-elevated:  #12122a
--bg-hover:     #1a1a35
--border:       #1e1e3a
--border-focus: #7c3aed
--text-primary: #e0e0e0
--text-muted:   #888
--text-dim:     #555
--accent:       #7c3aed
--accent-hover: #6d28d9
--accent-glow:  rgba(124,58,237,0.15)
--success:      #22c55e
--warning:      #f59e0b
--danger:       #ef4444
--info:         #3b82f6
--radius-sm:    6px
--radius-md:    10px
--radius-lg:    14px
```

Font: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif, 14px base.
Dark everywhere. No light mode. No white backgrounds.

---

## Input size caps (enforce at field level, hard stop)

| Field | Cap |
|---|---|
| Skill Name | 80 chars |
| When should this be used? | 1000 chars |
| Example requests | 10 items, 200 chars each |
| Expected inputs | 500 chars |
| Expected outputs | 500 chars |
| Constraints / hard rules | 1500 chars |

---

## Structured intermediate model (JSON generated first, always)

```json
{
  "name": "string",
  "description": "string",
  "when_to_use": "string (min 30 chars)",
  "example_requests": ["string"],
  "expected_inputs": "string",
  "expected_outputs": "string",
  "instructions": ["string", "string (min 2 items)"],
  "hard_rules": ["string"],
  "edge_cases": ["string"],
  "metadata": {
    "framework": "claude | chatgpt | langchain",
    "provider": "anthropic | openai",
    "model": "string",
    "created_at": "ISO string"
  }
}
```

Unknown fields dropped. Missing required fields fail validation. Partial JSON → partial raw output state, Save disabled.

---

## Validation order (all 4 layers before Save enables)

1. Form validation — required fields, within caps, min 1 example
2. JSON intermediate — schema present, instructions ≥2, when_to_use ≥30 chars
3. Framework render — JSON → markdown
4. Framework-specific markers present (Claude: frontmatter; ChatGPT: role + rules; LangChain: {variable})

---

## Built-in presets (hardcoded in main/presets.js — no file loading in v1)

1. Summarise Notes
2. Workflow Runner
3. Format Enforcer
4. Research Assistant
5. Code Review Helper

Each preset populates: skill name, when_to_use, 3 example requests, expected_inputs, expected_outputs, 2 hard_rules.

---

## SQLite schema

```sql
CREATE TABLE schema_version (version INTEGER NOT NULL);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE skills (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  skill_name        TEXT,
  framework         TEXT,
  provider          TEXT,
  model             TEXT,
  input_payload_json TEXT,
  generated_md      TEXT,
  file_path         TEXT,
  status            TEXT,
  error_code        TEXT,
  error_message     TEXT,
  version           INTEGER DEFAULT 1,
  created_at        TEXT,
  updated_at        TEXT
);

CREATE INDEX idx_skills_created ON skills(created_at DESC);
```

History cap: on INSERT, if COUNT(*) >= cap (default 100), DELETE oldest row by created_at.
Privacy mode: skip INSERT entirely — no partial rows.

---

## Error states

| Scenario | UI response |
|---|---|
| No provider set | Banner: "Select a provider in Settings" |
| API key missing | Banner: "Add your API key in Settings" |
| API 401 | Toast error: "Key rejected — verify in Settings" |
| API 429 | Toast warning: "Rate limited" + manual Retry button |
| API 5xx / network | Toast error: "Generation failed" + Retry |
| Generation in progress | Buttons disabled, toast: "Generation already running" |
| Stop pressed | Partial output banner, Save disabled, Copy enabled |
| JSON parse fail | Banner: "Output could not be parsed. Try regenerating." |
| Validation fail | Checklist items red, Save disabled |
| EEXIST on save | Modal: Overwrite / Save as copy / Cancel |
| Slug reserved/empty | Auto-append -skill, update path preview |
| shell.openPath fail | Toast: "No app registered for .md files" + copy path button |
| Import file too large | Toast: "File exceeds 50KB limit" |
| Import file unreadable | Toast: "File could not be read — moved or in use" |
| Save folder missing | Toast: "Output folder missing — update in Settings" |
| Window off-screen on restore | Silent: centre on primary display |
| DB migration fail | Toast error with code: "Storage error: migration failed (vN). Data is safe." |
| History search stale result | Silently discarded via sequence counter |
| Privacy mode active | History view: privacy mode banner only |

---

## Providers

### Anthropic
- Endpoint: https://api.anthropic.com/v1/messages
- Model: claude-sonnet-4-20250514
- Headers: x-api-key, anthropic-version: 2023-06-01
- Streaming: stream:true, event type content_block_delta → delta.text
- Completion: message_stop event (but compile AFTER reader loop exits, not on this event)

### OpenAI  
- Endpoint: https://api.openai.com/v1/chat/completions
- Model: gpt-4o
- Headers: Authorization: Bearer {key}
- Streaming: stream:true, choices[0].delta.content
- Completion: [DONE] sentinel (but compile AFTER reader loop exits, not on this sentinel)

Key detection (advisory badge only, never routes calls):
- sk-ant- → Anthropic (green badge)
- sk- → OpenAI (blue badge)
- other → Unknown (yellow badge)

---

## Views

### Generator (main view)
Left panel 42%:
- Skill Name field (80 char cap + counter)
- Framework tabs: Claude | ChatGPT | LangChain
- "When should this skill be used?" textarea (1000 char)
- Example requests tag input (max 10, 200 chars each)
- Expected inputs textarea (500 char)
- Expected outputs textarea (500 char)
- Constraints / hard rules textarea (1500 char)
- Presets dropdown
- Generate / Stop / Retry button

Right panel 58%:
- Output tabs: Raw | Preview
- Validation checklist (4 items, green tick / red cross)
- Partial output / parse error banner (when applicable)
- Copy button (always enabled when output exists)
- Save mode toggle: Package (skill-name/SKILL.md) | Flat (skill-name.md)
- Path preview (live, updates on name/mode change)
- Save button (disabled until all 4 validation layers pass)
- Token estimate (labelled "~tokens (estimate)")

Test panel (below output or collapsible):
- Test message input
- Send button (disabled if isGenerating)
- Response display (ephemeral, never stored)

### History
- Search input (debounced 200ms)
- Framework filter dropdown
- Chronological list rows: skill name, framework, provider, date
- Row actions: Re-open (triggers unsaved-changes guard), Delete
- Soft warning at 80 rows
- Privacy mode: banner only

### Settings
- Provider selector dropdown (required, explicit)
- API Key: one-way paste input, show/hide toggle, advisory badge, synthetic mask once set, Clear button
- Default output folder (folder picker, default ~/Documents/skills)
- Save mode default
- Default framework
- Privacy mode toggle (with warning: "History and generation data will not be saved")
- History count + "Clear all history" button

---

## Keyboard shortcuts (renderer keydown only)

| Shortcut | Action | Guard |
|---|---|---|
| Ctrl+Enter | Generate | If isGenerating: no-op |
| Ctrl+S | Save | If Save disabled: no-op |
| Ctrl+N | Clear form | checkUnsavedChanges() first |

---

## Slug sanitiser rules (main/slug.js)

1. Lowercase
2. Replace spaces with hyphens
3. Remove all chars except a-z, 0-9, hyphen
4. Collapse multiple hyphens to one
5. Trim leading/trailing hyphens
6. Check against WINDOWS_RESERVED: CON, PRN, AUX, NUL, COM1-COM9, LPT1-LPT9 (case-insensitive)
7. If reserved or empty after sanitisation: append -skill
8. Truncate to 80 chars

---

## Window state

Save on close: { x, y, width, height }
Restore on open:
- Load saved bounds
- Call screen.getAllDisplays()
- Check if bounds intersect any display (partial overlap is fine)
- If no intersection found: ignore saved bounds, centre on primary display at 1280x800
- Default first launch: 1280x800 centred

---

## Test requirements

Security regression (must all pass):
- nodeIntegration === false
- contextIsolation === true  
- sandbox === true
- webSecurity === true
- CSP header is set
- No ipcMain.handle('get-api-key') exists anywhere in codebase
- preload listeners return unsubscribe functions

Unit tests:
- slug.js: reserved names, empty input, special chars, truncation
- validators/common.js: missing fields, short when_to_use, empty instructions
- providers.js: detectProvider all cases
- history-cap.js: insert at 100 prunes oldest
- prompts.js: output contracts, fenceUserInput injection resistance

---

## What success looks like

A user can:
1. Open app, set provider + API key in Settings
2. Fill the generator form, pick a framework
3. Click Generate, watch skill stream in token by token
4. See the validation checklist turn green
5. Preview rendered markdown
6. Save to their chosen folder
7. Reopen from history and refine
8. Test the skill inline in the test panel
9. Import an existing .md file to improve it
10. Use Ctrl+Enter and Ctrl+S throughout

All of the above works without the API key ever leaving the main process.
