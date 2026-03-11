// ── JSON intermediate schema reminder (injected into every prompt) ──
const JSON_SCHEMA = `
{
  "name": "string",
  "description": "string",
  "when_to_use": "string (minimum 30 characters)",
  "example_requests": ["string", "..."],
  "expected_inputs": "string",
  "expected_outputs": "string",
  "instructions": ["string", "string (minimum 2 items)"],
  "hard_rules": ["string"],
  "edge_cases": ["string"],
  "metadata": {
    "framework": "claude | chatgpt | langchain",
    "provider": "anthropic | openai",
    "model": "string",
  }
}`.trim();

// ── Framework-specific rendering guidance ──
const FRAMEWORK_GUIDANCE = {
    claude: `
Style the content for a Claude SKILL.md file (rendered with YAML frontmatter):
- Instructions must be actionable, numbered, imperative steps ("Read the code before...", "Identify the...", "Apply...")
- Hard rules should use "NEVER" / "ALWAYS" language where appropriate
- Edge cases should describe specific situations and how to handle them`.trim(),

    chatgpt: `
Style the content for a ChatGPT Custom Instructions / System Prompt (rendered with a # Role section):
- Instructions should be written in second person ("You are...", "You must...", "When the user...")
- Hard rules should be direct imperatives
- Avoid Claude-specific phrasing`.trim(),

    langchain: `
Style the content for a LangChain prompt template:
- Instructions should describe how to process the input variables
- At least one instruction should reference an {input}, {context}, or other {variable} placeholder
- Edge cases should cover unexpected or empty input scenarios`.trim(),
};

/**
 * Fence user-supplied input to prevent prompt injection.
 * Wraps content in XML-like delimiters so the model treats it as data.
 * @param {string} content
 * @returns {string}
 */
function fenceUserInput(content) {
    // Escape any closing tag within the content so it cannot break out of the fence
    const safe = String(content).replace(/<\/user_input>/gi, '<\\/user_input>');
    return `<user_input>\n${safe}\n</user_input>`;
}

/**
 * Build the system + user messages for skill generation.
 * All user-supplied values are fenced before inclusion.
 *
 * @param {'claude'|'chatgpt'|'langchain'} framework
 * @param {object} formData
 * @param {string}   formData.skillName
 * @param {string}   formData.whenToUse
 * @param {string[]} formData.exampleRequests
 * @param {string}   formData.expectedInputs
 * @param {string}   formData.expectedOutputs
 * @param {string}   formData.constraints
 * @returns {{ system: string, user: string }}
 */
function buildSkillPrompt(framework, formData) {
    const guidance = FRAMEWORK_GUIDANCE[framework] ?? FRAMEWORK_GUIDANCE.claude;

    const system = `You are an expert AI prompt engineer. The user has provided a brief describing a skill they want to build. Your job is to write a complete, detailed, production-quality skill definition from that brief.

CRITICAL: You must output ONLY a single valid JSON object. No markdown fences, no explanations, no validation messages, no commentary — just the raw JSON object and nothing else. Never refuse, never explain formatting rules, never ask for clarification. Always generate the JSON.

Output schema:
${JSON_SCHEMA}

Framework guidance:
${guidance}

How to generate each field:
- "name": use the skill name exactly as provided — spaces and capitals are fine, the renderer handles formatting
- "description": write a single crisp sentence describing what the skill does
- "when_to_use": expand the user's description into 2-3 sentences covering the exact situations where this skill is the right choice
- "example_requests": use the provided examples or write 4 realistic user requests that would trigger this skill
- "expected_inputs": write a clear sentence describing what the user must provide
- "expected_outputs": write a clear sentence describing exactly what the skill produces
- "instructions": THIS IS THE CORE OF THE SKILL. Write 6-10 detailed, actionable, numbered steps that tell an AI model exactly how to execute this skill. Each step must describe a specific, concrete action — never a generic step like "research background" or "gather context". Think: what does a skilled practitioner actually DO, step by step? Every step must earn its place.
- "hard_rules": write 3-5 firm constraints using NEVER/ALWAYS language, covering the most important things that must or must not happen
- "edge_cases": write 2-4 specific edge cases and how to handle them

Rules:
- "instructions" must contain at least 6 substantive items — this is where the real value is
- "when_to_use" must be at least 30 characters
- "metadata.framework" must be exactly: ${framework}
- Write as an expert in the domain — the brief is a starting point, not the ceiling
- All string values must be non-empty`;

    const lines = [];

    lines.push(`Skill name: ${fenceUserInput(formData.skillName ?? '')}`);
    lines.push(`When to use: ${fenceUserInput(formData.whenToUse ?? '')}`);

    const examples = Array.isArray(formData.exampleRequests)
        ? formData.exampleRequests
        : [];
    lines.push(`Example requests:\n${examples.map((e, i) => `${i + 1}. ${fenceUserInput(e)}`).join('\n')}`);

    lines.push(`Expected inputs: ${fenceUserInput(formData.expectedInputs ?? '')}`);
    lines.push(`Expected outputs: ${fenceUserInput(formData.expectedOutputs ?? '')}`);

    if (formData.constraints && formData.constraints.trim()) {
        lines.push(`Constraints / hard rules: ${fenceUserInput(formData.constraints)}`);
    }

    const user = lines.join('\n\n');

    return { system, user };
}

module.exports = { buildSkillPrompt, fenceUserInput };

