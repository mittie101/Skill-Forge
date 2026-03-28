# Tooltips Design Spec
**Date:** 2026-03-19
**Status:** Approved

---

## Overview

Add contextual ⓘ info icons to form fields and action buttons across the SkillForge merged app, revealing floating card tooltips on hover. Goal: help users understand what each field does without cluttering the UI.

---

## Scope

Tooltips appear on:
- **Form fields** — field label rows in Generator, Builder, and Install views
- **Action buttons** — Generate, Suggest Names, Install, Import

Tooltips do **not** appear on: Settings view (intentionally excluded — settings fields are self-labelled and the view has its own section headings that serve as orientation), nav items, tab selectors, output panels, history entries, or status rows.

---

## Trigger & Style

- **Trigger:** Hover over the ⓘ icon (not the whole field)
- **Style:** Floating card — elevated surface, accent-coloured title, no arrow pointer
- **Implementation:** Pure CSS hover (`:hover` on `.tooltip-wrap` parent reveals `.tooltip-card` child) — zero JavaScript

---

## Architecture

### HTML pattern — fields

The `.tooltip-wrap` is inserted inside the existing `.field-header` flex container (which already exists in all three target views). The `.tooltip-wrap` sits after the field label, before the char-counter if one is present:

```html
<div class="field-header">
  <label class="field-label" for="skill-name">Skill Name</label>
  <span class="tooltip-wrap">
    <i class="info-icon" aria-label="More information">i</i>
    <div class="tooltip-card">
      <div class="tooltip-title">Skill Name</div>
      A short display name — becomes the filename stem and Claude Code command name.
    </div>
  </span>
  <span class="char-counter" id="name-counter">0 / 80</span>
</div>
```

**Exception — Framework tabs field:** The framework field in `generator.js` has no `.field-header` wrapper (label is a direct child of `.field`). When adding a tooltip here, wrap the label in a new `.field-header` div:

```html
<!-- Before (existing) -->
<div class="field">
  <label class="field-label">Framework</label>
  <div class="fw-tabs" role="tablist">…</div>
</div>

<!-- After (with tooltip) -->
<div class="field">
  <div class="field-header">
    <label class="field-label">Framework</label>
    <span class="tooltip-wrap">
      <i class="info-icon" aria-label="More information">i</i>
      <div class="tooltip-card">
        <div class="tooltip-title">Target Framework</div>
        Which AI platform to generate the skill file for. Claude uses SKILL.md format; ChatGPT and LangChain use their own conventions.
      </div>
    </span>
  </div>
  <div class="fw-tabs" role="tablist">…</div>
</div>
```

### HTML pattern — buttons

The `.tooltip-wrap` wraps the button entirely. The hover zone is the button's full area, so the tooltip appears naturally when the user hovers the button:

```html
<span class="tooltip-wrap">
  <button id="btn-generate" class="btn btn-primary">
    <svg>…</svg>
    Generate
  </button>
  <div class="tooltip-card below">
    <div class="tooltip-title">Generate</div>
    Sends your form to the AI and streams back a complete skill file. Requires an API key in Settings.
  </div>
</span>
```

Note the `.below` modifier on button tooltips — buttons sit at the bottom of the form panel, so the card opens downward to avoid clipping (see Overflow section below).

### Overflow clipping — `.below` modifier

The form panels (`.gen-left`, `.builder-left`, `.install-layout`) use `overflow-y: auto`, which clips `position: absolute` children that extend beyond the container boundary. The `.tooltip-card` appears **above** the icon by default (`bottom: calc(100% + 8px)`). To prevent clipping:

- Use the default (above) for fields in the **middle or lower portion** of the form — the card extends upward into visible scroll area
- Apply `.tooltip-card.below` for fields at the **very top** of the panel (e.g. Skill Name, Keyword) and for all **buttons** at the bottom — the card extends downward into visible scroll area

This is an authoring-time decision made when writing `_html()` — no JS required. The implementer adds or omits `.below` per field based on its vertical position in the layout.

### Files changed

| File | Change |
|---|---|
| `src/styles.css` | Append tooltip CSS block |
| `src/views/generator.js` | Add ⓘ icons to `_html()` |
| `src/views/builder.js` | Add ⓘ icons to `_html()` |
| `src/views/install.js` | Add ⓘ icons to `_html()` |

No new files. No IPC changes. No JS changes.

---

## CSS (append to `src/styles.css`)

```css
/* ============================================================
   Tooltip (ⓘ info icon + floating card)
   ============================================================ */
.tooltip-wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
}

.info-icon {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--bg-hover);
    border: 1px solid var(--border);
    color: var(--text-dim);
    font-size: 9px;
    font-weight: 700;
    font-style: normal;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: default;
    flex-shrink: 0;
    transition: border-color 0.15s, color 0.15s;
    line-height: 1;
    user-select: none;
}

.tooltip-wrap:hover .info-icon {
    border-color: var(--accent);
    color: var(--accent);
}

.tooltip-card {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 0;
    width: 240px;
    background: var(--bg-hover);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 10px 12px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--text-primary);
    box-shadow: 0 8px 24px rgba(0,0,0,0.6);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s;
    z-index: 200;
    white-space: normal;
}

.tooltip-wrap:hover .tooltip-card { opacity: 1; }

.tooltip-title {
    font-size: 11px;
    font-weight: 600;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 4px;
}

/* Open downward — for fields at the top of a panel and for all buttons */
.tooltip-card.below {
    bottom: auto;
    top: calc(100% + 8px);
}
```

---

## Tooltip Copy

### Generator view (`src/views/generator.js`)

| Element | `.below`? | Title | Body |
|---|---|---|---|
| Skill Name | yes (top of panel) | Skill Name | A short display name — becomes the filename stem and Claude Code command name. |
| Framework tabs | no | Target Framework | Which AI platform to generate the skill file for. Claude uses SKILL.md format; ChatGPT and LangChain use their own conventions. |
| When to Use | no | When to Use | Describe the situations that should trigger this skill. Be specific — this becomes the core routing instruction for the AI. |
| Example Requests | no | Example Requests | Sample phrases a user might say to invoke this skill. Press Enter after each one. Up to 10 examples. |
| Expected Inputs | no | Expected Inputs | What data or content will be passed to this skill at runtime — e.g. "a block of Python code" or "a GitHub issue URL". |
| Expected Outputs | no | Expected Outputs | What the skill should produce — e.g. "a numbered list of review comments" or "a corrected code block". |
| Constraints | no | Constraints | Hard rules the AI must always or never do — e.g. "never suggest deleting files" or "always include a rationale". |
| Generate button | yes (bottom) | Generate | Sends your form to the AI and streams back a complete skill file. Requires an API key in Settings. |

### Builder view (`src/views/builder.js`)

| Element | `.below`? | Title | Body |
|---|---|---|---|
| Keyword | yes (top of panel) | Keyword | The topic or capability this skill covers. Used to suggest section names and guide generation. |
| Description | no | Description | A fuller explanation of what this skill does. More detail here produces better section suggestions. |
| Section Count | no | Section Count | How many sections the generated skill file should have. Between 2 and 10. |
| Suggest Names | no | Suggest Section Names | Asks the AI to propose section headings based on your keyword and description. |
| Generate button | yes (bottom) | Generate | Streams a complete skill file using your keyword, description, and section names. |

### Install view (`src/views/install.js`)

| Element | `.below`? | Title | Body |
|---|---|---|---|
| Drop zone | yes (top of panel) | Drop a Skill File | Drag a `.md` skill file here or click Browse to pick one. The file will be parsed and previewed before install. |
| Skill mode button | no | Skill Mode | Installs to `~/.claude/skills/<name>/SKILL.md`. Invoked in Claude Code as `/<name>`. Recommended for complex, multi-step skills. |
| Command mode button | no | Command Mode | Installs to `~/.claude/commands/<name>.md`. Invoked as `/user:<name>`. Better for simple one-shot commands. |
| Install button | yes (bottom) | Install to Claude Code | Writes the processed file to your Claude Code config directory. Will warn if a file already exists. |

---

## Constraints

- No JavaScript involved — pure CSS hover only
- No new files created
- No IPC or main-process changes
- Tooltip z-index: 200 (above views at 0, below toasts at 1000 and modals at 900)
- Tooltip text content lives in each view's `_html()` function
- CSS uses design tokens (`var(--bg-hover)`, `var(--border)`) — no hardcoded hex colours
- `prefers-reduced-motion` already handled globally in `styles.css` — the opacity transition collapses to near-instant automatically
- `.info-icon` elements carry `aria-label="More information"` for screen reader accessibility
