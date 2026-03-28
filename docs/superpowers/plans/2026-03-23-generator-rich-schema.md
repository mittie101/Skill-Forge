# Generator Rich Schema Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Generator tab to produce specialist-based skill files with Persona, named specialist sections, Decision Points, Output Format, and Constraints blocks — matching the quality of the reference cpp-expert SKILL.md.

**Architecture:** The JSON intermediate schema is extended with optional new fields (`persona`, `specialists[]`, `decision_points[]`, `output_format[]`, `constraints[]`). The validator accepts them when present but treats them as optional so existing skills remain valid. The Claude renderer branches on `specialists` presence: specialist format when populated, legacy flat format as fallback. Builder, Review, Install tabs are untouched.

**Tech Stack:** Node.js (main process), Jest (tests), vanilla JS renderer — no bundler, no external dependencies.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `tests/unit/validators.test.js` | Modify | Add 8 new test cases for optional new schema fields |
| `main/validators/common.js` | Modify | Add optional-field validation for specialists, decision_points, output_format, constraints |
| `main/prompts.js` | Modify | Replace JSON_SCHEMA constant + buildSkillPrompt system prompt |
| `main/framework-renderers/claude.js` | Modify | Replace renderClaude with specialist-aware renderer + legacy fallback |

Do NOT touch: `ipc/build.js`, `ipc/generate.js`, `ipc/review.js`, `src/views/review.js`, `src/views/builder.js`, `main/validators/skill.js`, chatgpt.js, langchain.js, database, settings.

---

## Task 1: Add failing tests for new validator fields

**Files:**
- Modify: `tests/unit/validators.test.js`

- [ ] **Step 1: Verify current tests pass**

```powershell
npx jest tests/unit/validators.test.js --forceExit
```
Expected: all existing tests PASS

- [ ] **Step 2: Append the 8 new test cases to the `validateJson` describe block**

Open `tests/unit/validators.test.js` and append inside the `describe('validateJson', ...)` block, after the last existing `it(...)`:

```js
it('accepts a valid specialists array', () => {
    const r = validateJson({
        ...VALID_JSON,
        specialists: [{ name: 'Class Designer', when: 'routes here', inputs: 'code', outputs: 'refactored code', hard_rules: ['ALWAYS do x'] }],
    });
    expect(r.valid).toBe(true);
});

it('rejects specialists that is not an array', () => {
    const r = validateJson({ ...VALID_JSON, specialists: 'not an array' });
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => /specialists/i.test(e))).toBe(true);
});

it('rejects specialist missing name', () => {
    const r = validateJson({ ...VALID_JSON, specialists: [{ hard_rules: ['ALWAYS x'] }] });
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => /specialists\[0\]\.name/i.test(e))).toBe(true);
});

it('rejects specialist with empty hard_rules', () => {
    const r = validateJson({ ...VALID_JSON, specialists: [{ name: 'Test', hard_rules: [] }] });
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => /hard_rules/i.test(e))).toBe(true);
});

it('accepts decision_points as array of strings', () => {
    const r = validateJson({ ...VALID_JSON, decision_points: ['Thread safety → Concurrency Helper'] });
    expect(r.valid).toBe(true);
});

it('rejects decision_points that is not an array', () => {
    const r = validateJson({ ...VALID_JSON, decision_points: 'not array' });
    expect(r.valid).toBe(false);
});

it('accepts constraints as array of strings', () => {
    const r = validateJson({ ...VALID_JSON, constraints: ['No database schema design'] });
    expect(r.valid).toBe(true);
});

it('accepts valid json without instructions field (specialist-format skills)', () => {
    const { instructions, ...noInstructions } = VALID_JSON;
    const r = validateJson({
        ...noInstructions,
        specialists: [{ name: 'Test Spec', hard_rules: ['ALWAYS do x'] }],
    });
    expect(r.valid).toBe(true);
});
```

- [ ] **Step 3: Run the new tests — expect them to FAIL**

```powershell
npx jest tests/unit/validators.test.js --forceExit
```
Expected: the 8 new tests FAIL (validators don't yet accept the new fields / still require instructions).
Existing tests must still PASS.

---

## Task 2: Implement new optional-field validation

**Files:**
- Modify: `main/validators/common.js`

- [ ] **Step 1: Make `instructions` optional and add new optional-field checks**

**1a.** In `main/validators/common.js`, update the `required` array (line 80–81) — remove `'instructions'` from it:

```js
// BEFORE:
const required = ['name', 'description', 'when_to_use', 'example_requests',
                  'expected_inputs', 'expected_outputs', 'instructions'];

// AFTER:
const required = ['name', 'description', 'when_to_use', 'example_requests',
                  'expected_inputs', 'expected_outputs'];
```

**1b.** Replace the `instructions` minimum-count check (lines 93–95) with an optional guard:

```js
// BEFORE:
if (!Array.isArray(json.instructions) || json.instructions.length < 2) {
    errors.push('"instructions" must contain at least 2 items');
}

// AFTER:
if (json.instructions !== undefined &&
    (!Array.isArray(json.instructions) || json.instructions.length < 2)) {
    errors.push('"instructions" must contain at least 2 items');
}
```

**1c.** Insert the new optional-field checks immediately before the closing `return { valid: errors.length === 0, errors };` line:

```js
// specialists — optional but if present must be a non-empty array of valid objects
if (json.specialists !== undefined) {
    if (!Array.isArray(json.specialists) || json.specialists.length < 1) {
        errors.push('specialists must be a non-empty array if present');
    } else {
        json.specialists.forEach((s, i) => {
            if (typeof s !== 'object' || s === null)
                errors.push(`specialists[${i}] must be an object`);
            else if (!s.name || typeof s.name !== 'string')
                errors.push(`specialists[${i}].name must be a non-empty string`);
            else if (!Array.isArray(s.hard_rules) || s.hard_rules.length < 1)
                errors.push(`specialists[${i}].hard_rules must be a non-empty array`);
        });
    }
}

// decision_points — optional array of strings
if (json.decision_points !== undefined) {
    if (!Array.isArray(json.decision_points))
        errors.push('decision_points must be an array if present');
}

// output_format — optional array of strings
if (json.output_format !== undefined) {
    if (!Array.isArray(json.output_format))
        errors.push('output_format must be an array if present');
}

// constraints — optional array of strings
if (json.constraints !== undefined) {
    if (!Array.isArray(json.constraints))
        errors.push('constraints must be an array if present');
}
```

- [ ] **Step 2: Syntax check**

```powershell
node --check main\validators\common.js
```
Expected: no output (syntax OK)

- [ ] **Step 3: Run validator tests — all must PASS**

```powershell
npx jest tests/unit/validators.test.js --forceExit
```
Expected: all tests PASS (including the 7 new ones)

- [ ] **Step 4: Commit**

```powershell
git add main\validators\common.js tests\unit\validators.test.js
git commit -m "feat: add optional specialist/decision_points/output_format/constraints validation"
```

---

## Task 3: Update JSON schema and system prompt in prompts.js

**Files:**
- Modify: `main/prompts.js`

- [ ] **Step 1: Replace the `JSON_SCHEMA` constant (lines 4–20)**

Replace from `const JSON_SCHEMA = \`` through the closing `\`.trim();` with:

```js
const JSON_SCHEMA = `
{
  "name": "string",
  "description": "string — precision trigger sentence naming specific task types and constructs",
  "persona": "string — 2-3 sentences defining communication style and authority level",
  "when_to_use": "string — minimum 30 characters, starts with Always use before X",
  "example_requests": ["string (5-8 items spanning beginner, expert, and edge-case phrasings)"],
  "expected_inputs": "string — lists specific artefacts: code files, error messages, version numbers",
  "expected_outputs": "string — names format, structure, annotation level",
  "specialists": [
    {
      "name": "string — 2-4 word title-cased specialist name",
      "when": "string — 1-2 sentences: what routes here and what does NOT",
      "inputs": "string — specific artefacts required",
      "outputs": "string — exactly what this specialist produces",
      "hard_rules": ["string — ALWAYS/NEVER + specific construct/pattern/command (7-10 items)"]
    }
  ],
  "decision_points": ["string — explicit if/then routing rule between specialists (3-6 items)"],
  "output_format": ["string — numbered steps describing exactly how responses are structured"],
  "constraints": ["string — explicit out-of-scope items this skill will NOT handle"],
  "metadata": {
    "framework": "claude | chatgpt | langchain",
    "provider": "anthropic | openai",
    "model": "string"
  }
}`.trim();
```

- [ ] **Step 2: Replace the `system` string inside `buildSkillPrompt` (lines 72–115)**

Replace from `const system = \`You are an expert...` through `...All string values must be non-empty\``;` with:

```js
    const system = `You are an expert AI prompt engineer. The user has provided a brief describing a skill they want to build. Your job is to write a complete, detailed, production-quality skill definition from that brief.

CRITICAL: Output ONLY a single valid JSON object. No markdown fences, no explanations, no commentary. Never refuse. Always generate the JSON.

Output schema:
${JSON_SCHEMA}

Framework guidance:
${guidance}

Field-by-field instructions:

"name"
Use the skill name exactly as provided.

"description"
Write a PRECISION TRIGGER — one sentence that fires this skill at exactly the right moment
and suppresses it on unrelated requests. Must name specific task types, constructs, or phrases.
Bad: "Helps with Python code."
Good: "Triggers when the user asks to optimise, refactor, debug, or review Python functions,
async patterns, or memory management — not for Django/Flask web framework tasks."

"persona"
2-3 sentences. Name the expert role (e.g. "Senior C++ Architect"), communication style
(authoritative, precise, educational), and decision-making basis (standards, best practices).

"when_to_use"
2-3 sentences. Start with "Always use before X". Name exact trigger situations AND at least
one situation where this skill should NOT be loaded.

"example_requests"
5-8 items. Span: beginner phrasing, expert phrasing, edge-case phrasing. No near-duplicates.

"expected_inputs"
Name the specific artefacts: code files, error messages, config snippets, version numbers.
Not "relevant information" or "the code".

"expected_outputs"
Name format, structure, and annotation level.
Bad: "Improved code."
Good: "Refactored code with inline comments explaining each change and the minimum language
version required for each feature used."

"specialists"
3-8 specialist objects. Each covers a distinct sub-domain that warrants different hard rules.
Examples for cpp-expert: Class Designer, CMake Builder, Concurrency Helper, Memory Debugger.
For each specialist:
- "name": 2-4 words, title-cased
- "when": 1-2 sentences — what routes here AND what does NOT
- "inputs": specific artefacts needed
- "outputs": exactly what this specialist produces
- "hard_rules": 7-10 items. Each MUST use ALWAYS or NEVER and name a specific construct,
  command, flag, pattern, or failure mode. Not broad principles.
  Bad: "ALWAYS follow thread safety best practices."
  Good: "ALWAYS use std::scoped_lock when acquiring multiple mutexes — never use separate
  lock_guard calls on multiple locks, which creates deadlock risk."

"decision_points"
3-6 routing rules. Each maps a keyword or situation to a specialist.
Format: "Keyword/situation → Specialist Name (reason)."
Example: "Thread safety, data races, mutex → Concurrency Helper (requires lock analysis)."

"output_format"
3-6 numbered steps describing exactly how the model structures its response:
specialist identification, root cause section, annotated code, tooling commands, alternatives.

"constraints"
4-8 items. Explicit out-of-scope items. Start each with "No " or "Never ".
Example: "No database schema design unless the problem is specifically in the C++ ORM code."

Anti-patterns — NEVER produce these:
- Instructions that describe thinking rather than doing ("Consider...", "Think about...")
- Hard rules restating obvious good practice without naming a construct
  ("ALWAYS write clean code", "NEVER introduce bugs")
- Specialists with hard rules that could apply to any skill
- Constraints so vague they are meaningless ("No unrelated tasks")

Minimum counts (enforce these — the renderer will display all of them):
- "specialists": at least 3 objects
- each specialist "hard_rules": at least 7 items
- "decision_points": at least 3 items
- "output_format": at least 3 items
- "constraints": at least 4 items
- "example_requests": at least 5 items

Rules:
- "metadata.framework" must be exactly: ${framework}
- All string values must be non-empty
- Write as a domain expert — the brief is a starting point, not the ceiling`;
```

- [ ] **Step 3: Syntax check**

```powershell
node --check main\prompts.js
```
Expected: no output (syntax OK)

- [ ] **Step 4: Run the full test suite (prompts tests + validators)**

```powershell
npx jest tests/unit/prompts.test.js tests/unit/validators.test.js --forceExit
```
Expected: all PASS

- [ ] **Step 5: Commit**

```powershell
git add main\prompts.js
git commit -m "feat: upgrade Generator JSON schema to specialist-based format"
```

---

## Task 4: Replace renderClaude with specialist-aware renderer

**Files:**
- Modify: `main/framework-renderers/claude.js`

- [ ] **Step 1: Replace the entire `renderClaude` function body (lines 20–93)**

Keep `_esc` (lines 96–98) and `module.exports` (line 100) unchanged. Replace only the `renderClaude` function:

```js
function renderClaude(json) {
    const lines = [];

    // ── YAML frontmatter ──
    lines.push('---');
    lines.push(`name: "${_esc(String(json.name).toLowerCase())}"`);
    lines.push(`description: "${_esc(json.description)}"`);
    lines.push(`version: ${json.metadata?.version ?? 1}`);
    lines.push('framework: claude');
    lines.push('created_at: ' + (json.metadata?.created_at ?? new Date().toISOString()));
    lines.push('---');
    lines.push('');

    // ── Title ──
    lines.push(`# ${String(json.name).toLowerCase()}`);
    lines.push('');
    lines.push(json.description);
    lines.push('');

    // ── Persona ──
    if (json.persona) {
        lines.push('## Persona');
        lines.push('');
        lines.push(json.persona);
        lines.push('');
    }

    // ── When to use ──
    lines.push('## When to use');
    lines.push('');
    lines.push(json.when_to_use);
    lines.push('');

    // ── Example requests ──
    lines.push('## Example requests');
    lines.push('');
    (json.example_requests ?? []).forEach(ex => lines.push(`- ${ex}`));
    lines.push('');

    // ── Expected inputs ──
    lines.push('## Expected inputs');
    lines.push('');
    lines.push(json.expected_inputs);
    lines.push('');

    // ── Expected outputs ──
    lines.push('## Expected outputs');
    lines.push('');
    lines.push(json.expected_outputs);
    lines.push('');

    const hasSpecialists = Array.isArray(json.specialists) && json.specialists.length > 0;

    if (hasSpecialists) {
        // ── Decision Points ──
        if (Array.isArray(json.decision_points) && json.decision_points.length > 0) {
            lines.push('## Decision Points');
            lines.push('');
            json.decision_points.forEach(dp => lines.push(`- ${dp}`));
            lines.push('');
        }

        // ── Specialist sections ──
        json.specialists.forEach(spec => {
            lines.push(`## ${spec.name}`);
            lines.push('');

            if (spec.when) {
                lines.push('**When to use this section:**');
                lines.push(spec.when);
                lines.push('');
            }
            if (spec.inputs) {
                lines.push('**Expected inputs:**');
                lines.push(spec.inputs);
                lines.push('');
            }
            if (spec.outputs) {
                lines.push('**Expected outputs:**');
                lines.push(spec.outputs);
                lines.push('');
            }
            if (Array.isArray(spec.hard_rules) && spec.hard_rules.length > 0) {
                lines.push('**Hard rules:**');
                spec.hard_rules.forEach(r => lines.push(`- ${r}`));
                lines.push('');
            }
        });

        // ── Output Format ──
        if (Array.isArray(json.output_format) && json.output_format.length > 0) {
            lines.push('## Output Format');
            lines.push('');
            json.output_format.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
            lines.push('');
        }

        // ── Constraints ──
        if (Array.isArray(json.constraints) && json.constraints.length > 0) {
            lines.push('## Constraints');
            lines.push('');
            json.constraints.forEach(c => lines.push(`- ${c}`));
            lines.push('');
        }

    } else {
        // ── Legacy flat format fallback ──
        if (Array.isArray(json.instructions) && json.instructions.length > 0) {
            lines.push('## Instructions');
            lines.push('');
            json.instructions.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
            lines.push('');
        }
        if (Array.isArray(json.hard_rules) && json.hard_rules.length > 0) {
            lines.push('## Hard rules');
            lines.push('');
            json.hard_rules.forEach(r => lines.push(`- ${r}`));
            lines.push('');
        }
        if (Array.isArray(json.edge_cases) && json.edge_cases.length > 0) {
            lines.push('## Edge cases');
            lines.push('');
            json.edge_cases.forEach(ec => lines.push(`- ${ec}`));
            lines.push('');
        }
    }

    return lines.join('\n');
}
```

- [ ] **Step 2: Syntax check**

```powershell
node --check main\framework-renderers\claude.js
```
Expected: no output (syntax OK)

- [ ] **Step 3: Run full test suite**

```powershell
npm test
```
Expected: all tests PASS

- [ ] **Step 4: Commit**

```powershell
git add main\framework-renderers\claude.js
git commit -m "feat: render specialist-based skill format in Claude renderer (legacy fallback retained)"
```

---

## Task 5: Final verification

- [ ] **Step 1: Syntax check all 4 changed files**

```powershell
node --check main\prompts.js
node --check main\validators\common.js
node --check main\framework-renderers\claude.js
```
Expected: no output from any command

- [ ] **Step 2: Run full test suite**

```powershell
npm test
```
Expected: all tests PASS, zero failures

- [ ] **Step 3: Smoke-test the app (optional but recommended)**

```powershell
npm start
```
Open the Generator tab, fill in a skill, generate — confirm the output contains `## Persona`, `## Decision Points`, and at least one specialist section heading.
