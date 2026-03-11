# SkillForge

A Windows desktop app for generating structured LLM skill/prompt files using the Anthropic or OpenAI API.

Fill out a form describing the skill you want to build, watch it stream in token by token, then save the result as a ready-to-use `.md` file.

---

## What it does

- **Generate** — Describe a skill via a form UI and let Claude or GPT-4o write a complete, structured skill definition
- **Stream** — Output streams in real time with a live token counter
- **Validate** — Four-layer validation (form → JSON → render → format markers) with a visual checklist
- **Preview** — Switch between raw JSON and rendered markdown preview tabs
- **Save** — Save as a package folder (`skill-name/SKILL.md`) or flat file (`skill-name.md`)
- **History** — Browse, search, and reopen past generations
- **Test** — Inline test panel to try the skill against a sample message without leaving the app
- **Import** — Load an existing `.md` file to refine it

## Supported frameworks

| Framework | Output format |
|-----------|--------------|
| Claude | YAML frontmatter + markdown sections |
| ChatGPT | `# Role` / `# Rules` system prompt |
| LangChain | Prompt template with `{variable}` placeholders |

---

## Stack

- **Electron** — contextIsolation, sandbox, webSecurity, CSP enforced
- **Vanilla HTML/CSS/JS** — no React, no bundler
- **better-sqlite3** — WAL mode, versioned migrations
- **safeStorage** — OS-level API key encryption (key never leaves main process)
- **electron-builder** — NSIS installer for Windows

---

## Getting started

### Prerequisites

- Node.js 18+
- Windows (safeStorage and NSIS installer are Windows-targeted)

### Install

```bash
git clone https://github.com/mittie101/Skill-Forge.git
cd Skill-Forge
npm install
npm run rebuild   # rebuilds better-sqlite3 for your Electron version
```

### Run

```bash
npm start
```

### Build installer

```bash
npm run build
# Output: dist/SkillForge Setup 0.1.0.exe
```

### Tests

```bash
npm test
```

158 tests across unit, integration, and security regression suites.

---

## Security

- API key encrypted via Electron `safeStorage` — never stored in plaintext
- No `getApiKey` IPC handler exists — the key cannot be retrieved from the renderer
- File writes use exclusive `{ flag: 'wx' }` mode — no silent overwrites
- Imported files are size-capped (50 KB), UTF-8 validated, and fenced before AI inclusion
- Saved file paths are validated to stay within the configured output folder
- Markdown preview only renders validated output — raw stream buffer is never passed to `innerHTML`

---

## Settings

| Setting | Description |
|---------|-------------|
| Provider | Anthropic or OpenAI |
| API Key | One-way paste, synthetic masked display, OS-encrypted storage |
| Output folder | Default: `~/Documents/skills` |
| Save mode | Package or flat file |
| Default framework | Claude / ChatGPT / LangChain |
| Privacy mode | Disables all SQLite writes for generation sessions |

---

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` | Generate |
| `Ctrl+S` | Save |
| `Ctrl+N` | Clear form |

---

## License

MIT
