# SkillForge — Claude Code Build Context

## Project

**App:** SkillForge — AI skill file generator, builder, and installer  
**Author:** Antony Morrison / Walking Fish Software  
**Path:** `C:\projects\skill-converter\skillforge-merged`  
**Stack:** Electron 35, vanilla HTML/CSS/JS (renderer), Node.js (main), better-sqlite3, Express not used here  
**Target:** Windows x64, NSIS installer + portable  

---

## Environment

- **IDE:** Visual Studio Pro 2022
- **Shell:** PowerShell (always — never assume bash paths)
- **Node:** via system PATH in PowerShell
- **Electron rebuild:** `npm run rebuild` (uses `@electron/rebuild` via electron-builder)
- **Tests:** `npm test` → Jest with `--forceExit`

**PowerShell path style:** always use `C:\...` backslash paths in commands.  
**Never** use Unix-style `/c/projects/...` paths in generated commands.

---

## Key Commands

```powershell
# Run app
npm start

# Run tests
npm test

# Run single test file
npx jest tests/unit/review.test.js --forceExit

# Build installer
npm run build

# Rebuild native modules after Electron version change
npm run rebuild

# Syntax check a file without running it
node --check src/views/review.js
```

---

## Architecture

```
main.js                  ← Electron entry, creates BrowserWindow, loads ipc/index.js
preload.js               ← contextBridge — only way renderer touches Node APIs
ipc/index.js             ← registers all ipcMain handlers by requiring each ipc/*.js
ipc/*.js                 ← one handler file per feature domain
main/stream.js           ← shared streamWithRetry + apiErrorCode (used by all IPC handlers)
main/prompts.js          ← all AI prompt builders
main/validators/         ← input validators (common.js) and skill structure (skill.js)
main/db/                 ← better-sqlite3 wrappers (history, settings, migrations)
main/config.js           ← app-wide constants (timeouts, limits, provider names)
main/pricing.js          ← token cost calculation
main/storage.js          ← electron safeStorage for API key encryption
src/index.html           ← single HTML shell, loads all view scripts
src/views/*.js           ← one view file per nav tab (no bundler, plain JS modules)
src/lib/                 ← vendored libs (marked.min.js, toast.js)
```

---

## IPC Pattern (follow exactly for new handlers)

Every IPC handler follows this shape — do not deviate:

```js
'use strict';
const { ipcMain } = require('electron');
const { getSetting } = require('../main/db/settings');
const { decryptKey }  = require('../main/storage');
const { streamWithRetry, apiErrorCode } = require('../main/stream');
const { PROVIDERS } = require('../main/config');
const { createMutex } = require('./_mutex');

const _mutex = createMutex(); // one mutex per module

ipcMain.handle('my-channel', async (_event, args) => {
    const release = await _mutex.acquire();
    try {
        // ... handler logic
        return { ok: true, data: result };
    } catch (err) {
        return { ok: false, error: err.message };
    } finally {
        release();
    }
});
```

Register in `ipc/index.js`:
```js
require('./review');
```

Expose in `preload.js`:
```js
myAction: (args) => ipcRenderer.invoke('my-channel', args),
```

---

## Renderer Pattern (follow exactly for new views)

Views are plain JS files — no bundler, no import/export. Each view:
- Declares a single init function called by `src/app.js` on nav switch
- Manages its own DOM — never touches another view's elements
- Communicates with main process only via `window.electronAPI.*`
- Uses `window.toast` from `src/lib/toast.js` for user feedback

---

## Streaming Pattern

All AI calls use `streamWithRetry` from `main/stream.js`.

For **review** (collect-then-parse): buffer every chunk, parse the full buffer after stream ends.  
For **fix** (stream-to-UI): send each chunk to renderer via `BrowserWindow.webContents.send`.

Buffer must be reset to empty at the start of each retry attempt inside `streamWithRetry`.

---

## Database

`better-sqlite3` — synchronous, no async/await needed for DB calls.  
Schema migrations run at startup via `main/db/migrations.js`.  
New tables require a migration entry — never alter schema directly.

---

## Quality Rules (non-negotiable)

- Target rubric score: 95–100/100 across Security, Reliability, Maintainability,
  Data Safety, Performance, Tests
- No `console.log` left in production paths — use structured error returns
- All IPC handlers return `{ ok: boolean, data?, error? }` — never throw across IPC
- All user-facing file writes use atomic pattern: write to temp with `crypto.randomUUID()`
  filename, then `fs.renameSync` to final path
- Never trust model output without parsing and normalising first
- Mutex required on any handler that touches shared state or makes API calls

---

## Active Feature Being Built

**Skill Review & Scorer** — see `SKILL-REVIEW-SPEC.md` in project root.

New files to create:
- `src/views/review.js`
- `ipc/review.js`
- `main/validators/skill.js`
- `tests/unit/review.test.js`
- `tests/integration/ipc-review.test.js`

Files to modify:
- `src/index.html` — add 6th nav item + view div
- `ipc/index.js` — register review handlers
- `preload.js` — expose reviewSkill + fixSkill
- `main/prompts.js` — add review and fix prompt builders
- `main/config.js` — add FIX_BUFFER_LIMIT_BYTES
- `src/views/builder.js` — add Review this skill button
- `src/views/install.js` — add Review this skill button

**Build order:**
1. `main/config.js`
2. `main/validators/skill.js`
3. `main/prompts.js`
4. Parser/normaliser logic (part of `ipc/review.js`)
5. `ipc/review.js` (both handlers + shared mutex)
6. `ipc/index.js` + `preload.js`
7. `src/views/review.js`
8. Button additions to builder.js + install.js
9. Tests
