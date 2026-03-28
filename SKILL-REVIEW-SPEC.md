# Skill Review & Scorer — Final Build Spec

## Overview

A new **Review** view (6th nav item). The user pastes or loads a skill `.md`, sends it through
the existing provider pipeline, receives a strict scored review out of 100, inspects
category-level failures and ordered fixes, clicks **Fix It** to rewrite the skill targeting
100/100, then immediately **Re-Reviews** the rewritten version to verify the result.
Auto-fix is honest — it targets 100/100 but the Re-Review confirms whether it got there.

---

## Scoring Rubric (100pts total)

| Category                  | Points | What's measured |
|---------------------------|--------|-----------------|
| Trigger Accuracy          | 20     | Does `description` fire the skill at the right moment and suppress it when irrelevant? Specific, not vague. |
| Instruction Precision     | 20     | Steps numbered, sequential, unambiguous. Each maps to exactly one action. No "consider", "think about", "may". |
| Output Specificity        | 15     | `Expected outputs` concrete and measurable — format, structure, length hints. |
| Hard Rule Quality         | 15     | `Hard rules` are genuine non-negotiables with CAPS-prefixed imperatives covering the most dangerous failure modes. |
| Example Request Coverage  | 10     | Examples span the realistic trigger space — beginner, advanced, edge-case phrasings. No duplicates or near-duplicates. |
| Edge Case Utility         | 10     | Edge cases specific, named, actionable. Generic entries score zero. |
| Readability & Frontmatter | 10     | Frontmatter valid YAML, correct fields. Consistent imperative voice. No filler prose. Headers match canonical schema exactly. |

---

## Canonical Skill Schema

Frozen exactly. Scorer and fixer both reference this. Any deviation is a defect.

```markdown
---
name: ...
description: ...
version: 1
framework: ...
created_at: 2026-03-21T14:22:05.123Z
---

# Skill Name

One-line purpose statement.

## When to use
- ...

## Example requests
- ...

## Expected inputs
- ...

## Expected outputs
- ...

## Instructions
1. ...

## Hard rules
- ALWAYS ...
- NEVER ...

## Edge cases
- Scenario: ...
  Mitigation: ...
```

**Schema rules:**
- Frontmatter must be first, no exceptions
- No extra top-level sections permitted
- Section order must match canonical order exactly
- Title (`# Skill Name`) must equal frontmatter `name`
- `version` must be a positive integer; parse with `parseInt(version, 10)` — if missing,
  non-numeric, or NaN after parse, treat as `1`
- `created_at` must be full ISO 8601 e.g. `2026-03-21T14:22:05.123Z`; if missing, add it
- `description` must be ≤280 chars
- `When to use` must include at least one "Always use before X" bullet
- `Example requests` must have 5–8 items
- `Hard rules` must have ≥3 entries, each prefixed ALWAYS or NEVER
- `Edge cases` must have ≥3 named scenarios each with a mitigation

---

## Review JSON Contract

Exact locked schema. Parser normalises to this before anything reaches the UI.

```json
{
  "categories": [
    { "name": "Trigger Accuracy",          "score": 0, "max": 20, "issues": ["..."], "verdict": "..." },
    { "name": "Instruction Precision",     "score": 0, "max": 20, "issues": [],      "verdict": "..." },
    { "name": "Output Specificity",        "score": 0, "max": 15, "issues": [],      "verdict": "..." },
    { "name": "Hard Rule Quality",         "score": 0, "max": 15, "issues": [],      "verdict": "..." },
    { "name": "Example Request Coverage",  "score": 0, "max": 10, "issues": [],      "verdict": "..." },
    { "name": "Edge Case Utility",         "score": 0, "max": 10, "issues": [],      "verdict": "..." },
    { "name": "Readability & Frontmatter", "score": 0, "max": 10, "issues": [],      "verdict": "..." }
  ],
  "total": 0,
  "overall_verdict": "...",
  "perfect": false,
  "improvements": ["..."]
}
```

**Contract invariants — all enforced by the normaliser, never trusted from model:**
- `categories.length` === 7, names must match rubric exactly (used as renderer keys)
- `max` values are overwritten by the normaliser from hard-coded canonical values —
  never trust the model's `max` field
- All scores coerced: `score = clamp(parseInt(score, 10), 0, canonicalMax[name])`
- `total` recomputed from sum of category scores
- `perfect` recomputed as `(total === 100)`
- Categories reordered to canonical order silently during normalisation
- `improvements` non-empty when `perfect === false`; empty when `perfect === true`
- `improvements` normalised before dedup:
  `trim().toLowerCase().replace(/[.,;]$/, '')` — deduplicate on normalised form,
  preserve original casing in output

---

## IPC Contracts

**`review-skill`**
```js
// Request
{ content: string, provider?: string, model?: string }
// Success
{ ok: true, data: ReviewResult }
// Failure
{ ok: false, error: string }
```

**`fix-skill`**
```js
// Request
{ content: string, improvements: string[], scoreBreakdown: ReviewResult['categories'], provider?: string, model?: string }
// Success — streams chunks, then resolves with full content
{ ok: true, data: { content: string } }
// Failure
{ ok: false, error: string }
```

Both handlers re-use `streamWithRetry` and `apiErrorCode` from `main/stream.js`.
Both re-use `getSetting` / `decryptKey` / `PROVIDERS` patterns from `ipc/generate.js`.

**Mutex:** one shared mutex instance for the entire `ipc/review.js` module, covering
both `review-skill` and `fix-skill`. One operation at a time across both handlers.

**AbortController cleanup:** Null the `AbortController` reference *before* resolving the
handler (not only in `finally`). This ensures that a `openclaw-stop` signal arriving after
completion produces a silent no-op rather than aborting an already-settled request. The
`finally` block handles the null-safety check: `if (controller) controller.abort()`.

---

## Parser / Normaliser (`ipc/review.js`)

Applied to the raw concatenated stream buffer after the review stream ends.
Steps in order — halt and return `{ ok: false, error }` on any unrecoverable failure:

1. Strip wrapping code fences if present
2. Extract the **largest** valid JSON object by character length (not first) — handles
   models that output an explanation block followed by the real result
3. Attempt lenient recovery if initial parse fails:
   - Remove trailing commas
   - Strip `//` and `/* */` comments
   - Attempt brace-balancing on truncated JSON
   - If still invalid → `{ ok: false, error: 'Model returned unparseable output' }`
4. Validate `categories` is array of exactly 7 with correct names in any order —
   return friendly error if not
5. Reorder categories to canonical order silently
6. Overwrite each category's `max` with the canonical hard-coded value — discard model value
7. Coerce all `score` values: `clamp(parseInt(score, 10), 0, canonicalMax)`
8. Recompute `total` from category scores
9. Recompute `perfect` from `(total === 100)`
10. Enforce `improvements` rules based on recomputed `perfect`
11. Normalise and deduplicate `improvements`

---

## Shared Utility — `main/validators/skill.js`

**Location is locked to `main/validators/skill.js`.** Do not place in `common.js`.

```js
function validateCanonicalSkillStructure(markdown) {
  // returns { valid: boolean, errors: string[] }
}
```

Checks:
- Frontmatter present and parseable as YAML
- All required section headers present in canonical order
- `Example requests` has ≥5 items
- `Hard rules` has ≥3 items, each starting with ALWAYS or NEVER
- `Edge cases` has ≥3 named scenarios
- `version` is positive integer after `parseInt(version, 10)`
- `created_at` is valid ISO 8601
- `description` ≤280 chars
- Title (`# name`) matches frontmatter `name`

Used in: post-fix validation, future features (editor, publisher).

---

## AI Prompt Strategy — Review (`buildSkillReviewPrompt`)

**Non-streaming.** Uses `streamWithRetry` but collects the full concatenated output into
a buffer. Parser runs once the stream ends. No mid-stream parsing.

Prompt must include:
- Full canonical rubric with exact category names and max scores
- Full canonical markdown schema with exact section headers
- Instruction: output JSON only — no prose, no fences
- Instruction: *"Score the skill as it is written, not as you infer it was intended."*
- Instruction: *"Do not reward intent, only observable compliance with the schema and rubric."*
- Instruction: *"A score of 100 is achievable only when every sub-criterion is fully met.
  Partial credit is permitted within categories. Do not round up."*
- Instruction: cite specific defects in `issues` — not general commentary
- Instruction: `improvements` ordered highest-impact first, written as imperatives

---

## AI Prompt Strategy — Fix It (`buildSkillFixPrompt`)

**Streaming** raw markdown — same `streamWithRetry` pattern as `ipc/generate.js`.

Fix buffer reset to empty at the start of each retry attempt within `streamWithRetry`.
Fix buffer capped at `FIX_BUFFER_LIMIT_BYTES` (add to `main/config.js`, suggested 512KB).
If buffer cap exceeded: abort stream, surface error toast, preserve buffered content.

`created_at` is **not** set by the prompt or by Claude. The `fix-skill` IPC handler
injects `new Date().toISOString()` into the returned markdown after the stream completes,
via regex replace on the frontmatter block. Claude has no real-time clock.

`version` bump is performed by the IPC handler post-stream, not by the prompt:
`parseInt(existingVersion, 10) + 1` — if NaN, set to `1`.

Prompt must include:
- Original skill content
- Ordered `improvements[]`
- Full `scoreBreakdown` with issues and verdicts per category
- Full canonical schema with frozen section headers and order
- Instruction: *"Rewrite completely, but preserve the skill's underlying purpose and
  operating scope."*
- Instruction: *"Ensure every required minimum count constraint in the schema is satisfied
  explicitly."*
- Instruction: output raw `.md` only — no explanation prose, no wrapping fences
- Hard constraints:
  - Preserve original `name` and `framework` exactly
  - Do not set `version` or `created_at` — these are injected by the application
  - Do not invent capabilities the original skill did not have
  - Do not broaden allowed inputs beyond original intent
  - Do not add tools, integrations, or dependencies unless already implied
  - Improve only within the existing capability envelope

**Input size guard:** Before sending to the model, measure `skillContent.length`.
If it exceeds `20_000` characters, truncate to 20 000 chars and append:
```
[Body truncated for analysis — original skill exceeds safe prompt length]
```
Apply to *both* review and fix prompts. This prevents token overflow and ensures the
model always receives a well-formed prompt window.

---

## Post-Fix Processing (IPC handler, after stream ends)

In order:
1. Inject `created_at: <new Date().toISOString()>` via frontmatter regex — add if missing
2. Inject bumped `version` via frontmatter regex — `parseInt(existing, 10) + 1` or `1`
3. Run `validateCanonicalSkillStructure()` on the result
4. If invalid: set `fixWarning` — do not reject the content

### YAML Reconstruction Rules

When re-serialising frontmatter fields (e.g. during `created_at`/`version` injection or
any field rewrite), apply these quoting rules:

**Simple scalar test (quote everything that fails it):**
```js
const isSimple = /^[a-zA-Z0-9._-]+$/.test(str);
// If NOT simple → wrap in double quotes, escape internal " and \
```
Do not maintain a regex of "dangerous YAML characters" — it will always be incomplete.
Quote unless provably simple. This is the safe default.

**Metadata field:** Always serialise as a quoted JSON string — never raw inline JSON:
```yaml
metadata: "{\"openclaw\":{...}}"   ✓
metadata: {"openclaw":{...}}       ✗  (parser-dependent, unsafe)
```
Use the same quoting helper so internal quotes and backslashes are escaped.

**Frontmatter reconstruction guard:**  
When scanning for `\n---\n` to detect a closing frontmatter delimiter, only scan
between index 0 and the *end* of the frontmatter block — not the full file body.
Track the closing `---` position explicitly and never check beyond it. This avoids
false-positives if the skill body legitimately contains a `---` HR separator.

---

## Streaming Failure Recovery (Fix It)

If stream errors mid-output:
- Buffer and keep partial content visible — do not wipe panel
- Show error toast: *"Fix interrupted — partial result available"*
- Re-Review, Copy, and Save remain available on partial content
- Re-Review button shows warning tooltip when `fixWarning` is set:
  *"This skill may be incomplete — review result may be inaccurate."*

---

## Renderer State Shape

```js
{
  inputContent: string,        // content in left panel
  fileName: string | null,     // label if loaded from disk
  reviewLoading: boolean,
  reviewResult: ReviewResult | null,
  reviewError: string | null,
  previousTotal: number | null, // score before most recent Fix It — for soft hint guard
  fixLoading: boolean,
  fixedContent: string,         // streams in
  fixWarning: string | null,    // post-fix validation warning or stream interruption
  fixError: string | null,
  selectedProvider: string,
  selectedModel: string
}
```

`previousTotal` is set from `reviewResult.total` immediately before firing the fix request.
It is not reset by Re-Review — it persists to enable the delta calculation after re-review
completes.

---

## UI Layout

### Left panel — Input
- Textarea (paste) + drag-drop zone for `.md` files
- Open file button
- File name label when loaded from disk
- Character count; soft warning if >50KB:
  *"Large skills may produce slower or less reliable reviews"*
- Provider/model selector (re-uses existing settings default)
- Estimated cost display — formatted to **4 decimal places**, never scientific notation
  (guard: `if (cost < 0.0001) display '< $0.0001'`; otherwise `$${cost.toFixed(4)}`)
- **Review Skill** CTA — disabled when content empty or any request active

Pre-populated when opened via a **"Review this skill"** button added to Builder and
Install views.

### Right panel — Results (renders after review returns)

In order top to bottom:

1. Overall score badge — red <70, amber 70–89, green 90–99, gold ring 100
2. Overall verdict string
3. Per-category cards with score progress bars — issues listed beneath failing categories only
4. Improvement Actions — collapsible accordion, numbered, per-item copy-to-clipboard
5. Soft hint — shown when `reviewResult.total >= 90` AND
   `previousTotal !== null` AND `(reviewResult.total - previousTotal) < 3`:
   *"Further improvements may require manual refinement."*
6. **Fix It** button — hidden until first successful review completes;
   disabled with tooltip *"Skill is already perfect"* when `perfect === true`

### Fixed Skill panel (streams in below results after Fix It clicked)
- Read-only code block, streams using same pattern as `generator.js`
- Warning banner if `fixWarning` is set
- **Copy** — raw `.md` to clipboard
- **Save to File** — `dialog.showSaveDialog`, enforces `.md` extension,
  atomic write using `crypto.randomUUID()` for temp filename (not `Date.now()`),
  blocks empty file writes. File saving is renderer-only — the IPC handler never
  touches the filesystem for save operations.
- **Re-Review** — replaces input panel content with fixed skill, auto-triggers fresh review.
  Button shows warning tooltip if `fixWarning` is set.

### Button states
| Button        | Condition                                | State    |
|---------------|------------------------------------------|----------|
| Review Skill  | content empty or any request active      | disabled |
| Fix It        | before first successful review           | hidden   |
| Fix It        | `perfect === true`                       | disabled |
| Re-Review     | review in progress                       | disabled |
| Re-Review     | `fixWarning` set                         | enabled with warning tooltip |

---

## Files Affected

| File                                   | Change |
|----------------------------------------|--------|
| `src/index.html`                       | Add 6th nav button `data-view="review"`, add `<div id="view-review">` |
| `src/views/review.js`                  | New — full view logic, state, results renderer, Fix It, streaming fixed panel, Re-Review |
| `ipc/review.js`                        | New — shared module mutex; `review-skill` handler (collect-then-parse); `fix-skill` handler (streaming + post-stream inject) |
| `ipc/index.js`                         | Register `review-skill` and `fix-skill` |
| `preload.js`                           | Expose `window.electronAPI.reviewSkill` and `window.electronAPI.fixSkill` |
| `main/prompts.js`                      | Add `buildSkillReviewPrompt(skillContent)` and `buildSkillFixPrompt(skillContent, improvements[], scoreBreakdown)` |
| `main/validators/skill.js`             | New — `validateCanonicalSkillStructure(markdown)` |
| `main/config.js`                       | Add `FIX_BUFFER_LIMIT_BYTES = 512 * 1024` |
| `src/views/builder.js`                 | Add "Review this skill" button → opens Review view |
| `src/views/install.js`                 | Add "Review this skill" button → opens Review view |

**Installed skills IPC contract (normalise in IPC, not renderer):**  
The `list-installed-skills` (or equivalent) handler must return objects with a canonical
`filePath` property (not `path`). The handler must:
- Filter out directory entries
- Filter to `.md` files only
- Return `{ name, filePath }` — renderer never re-derives the path
| `tests/unit/review.test.js`            | Unit tests — prompt builders, parser/normaliser, skill validator |
| `tests/integration/ipc-review.test.js` | Integration tests — both handlers including adversarial model output |

---

## Test Plan

### Unit — `main/prompts.js`
- Review prompt includes all 7 exact category names
- Review prompt includes canonical max scores
- Review prompt demands JSON-only output
- Review prompt includes score-as-written instruction
- Review prompt includes do-not-reward-intent instruction
- Fix prompt includes ordered improvements
- Fix prompt requires raw markdown only
- Fix prompt instructs no `version` or `created_at` in output

### Unit — parser/normaliser
- Parses clean JSON
- Parses JSON wrapped in code fences
- Parses adversarial prose-wrapped JSON (`"Sure! Here's your review: ...json... Let me know..."`)
- Selects largest JSON object when multiple present
- Recovers from trailing commas
- Recovers from JS-style comments
- Rejects missing categories with friendly error
- Rejects duplicate categories
- Rejects wrong category names
- Reorders categories to canonical order
- Overwrites model `max` values with canonical values
- Clamps scores to `[0, canonicalMax]` correctly
- Recomputes `total` from category scores
- Sets `perfect` from recomputed total
- Normalises and deduplicates improvements
- Returns `{ ok: false, error }` with friendly message on unrecoverable failure

### Unit — `main/validators/skill.js`
- Detects missing frontmatter
- Detects wrong section order
- Detects missing sections
- Detects insufficient example request count (<5)
- Detects insufficient hard rule count (<3)
- Detects insufficient edge case count (<3)
- Detects hard rules missing ALWAYS/NEVER prefix
- Detects invalid version (non-integer after parseInt)
- Detects malformed `created_at`
- Detects `description` >280 chars
- Detects title/name mismatch
- Passes a fully compliant skill

### Unit — post-stream injection
- `created_at` injected correctly when present
- `created_at` added when missing
- `version` bumped by 1 from integer string
- `version` set to 1 when missing
- `version` set to 1 when non-numeric
- `version` set to 1 when `"2"` (string-typed) parses correctly to 3 via parseInt
- YAML scalar not matching `/^[a-zA-Z0-9._-]+$/` is double-quoted in output
- YAML scalar matching simple pattern is written unquoted
- Metadata field is always serialised as a quoted JSON string
- Frontmatter `---` delimiter scan does not false-positive on HR separators in skill body
- AbortController is nulled before handler resolves (verify via stub: abort not called post-resolve)
- Review prompt truncates `skillContent` at 20 000 chars and appends truncation notice
- Fix prompt truncates `skillContent` at 20 000 chars and appends truncation notice
- Cost display uses `.toFixed(4)`; values below `0.0001` show `< $0.0001` (not scientific notation)

### Integration — `ipc-review.test.js`
- `review-skill` returns normalised valid ReviewResult
- `review-skill` fails gracefully on malformed model output
- `review-skill` serialises concurrent calls via shared mutex
- `fix-skill` cannot run concurrently with `review-skill` (shared mutex)
- `fix-skill` returns correctly post-processed markdown (version bumped, created_at injected)
- `fix-skill` fails gracefully on provider error
- Re-Review flow consumes fixed content without transformation bugs

---

## Implementation Order

1. `main/config.js` — add `FIX_BUFFER_LIMIT_BYTES`
2. `main/validators/skill.js` — `validateCanonicalSkillStructure`
3. `buildSkillReviewPrompt` and `buildSkillFixPrompt` in `main/prompts.js`
4. JSON parser/normaliser (unit test in parallel)
5. Both IPC handlers in `ipc/review.js` with shared mutex, post-stream injection
6. Register handlers in `ipc/index.js`
7. Expose via `preload.js`
8. Review view shell and input panel in `src/views/review.js`
9. Score results renderer (badge, category cards, improvements accordion)
10. Fix It streaming panel with post-fix validation and failure recovery
11. Re-Review loop with soft hint guard and `previousTotal` tracking
12. "Review this skill" button in Builder and Install views
13. Unit and integration tests

---

## Out of Scope for v1
- Batch reviewing multiple skills in one pass
- Saving review history to SQLite
- Side-by-side diff of original vs fixed skill
- Provider auto-fallback on failure
