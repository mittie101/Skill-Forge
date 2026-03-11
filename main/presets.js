/**
 * Built-in hardcoded presets — no file loading in v1.
 * Each preset populates: skill_name, when_to_use, example_requests (3),
 * expected_inputs, expected_outputs, hard_rules (2).
 */
const PRESETS = [
    {
        id: 'summarise-notes',
        label: 'Summarise Notes',
        skill_name: 'Summarise Notes',
        when_to_use: 'Use this skill when you need to condense long meeting notes, research documents, or articles into clear, structured summaries that highlight the key points, decisions, and action items.',
        example_requests: [
            'Summarise these meeting notes from our Q1 planning session',
            'Give me a summary of this research paper on transformer architectures',
            'Condense this 10-page requirements document into bullet points',
        ],
        expected_inputs: 'Raw text content such as meeting notes, documents, articles, or transcripts. Plain text or lightly formatted markdown.',
        expected_outputs: 'A structured summary with key points, decisions made, and action items. Uses headers and bullet points for scanability.',
        hard_rules: [
            'Never add information not present in the source material',
            'Preserve all action items and decisions verbatim',
        ],
    },
    {
        id: 'workflow-runner',
        label: 'Workflow Runner',
        skill_name: 'Workflow Runner',
        when_to_use: 'Use this skill when you need to execute a defined multi-step workflow, following a strict sequence of operations and producing structured output at each stage.',
        example_requests: [
            'Run the content approval workflow for this blog post draft',
            'Execute the onboarding checklist workflow for a new employee',
            'Process this support ticket through the triage workflow',
        ],
        expected_inputs: 'A workflow definition or name, plus the data payload to process through the workflow steps.',
        expected_outputs: 'Step-by-step execution log with the result of each stage, final status (complete/blocked/failed), and next recommended action.',
        hard_rules: [
            'Do not skip steps — complete each stage in sequence before proceeding',
            'If a step cannot be completed, report blocked status and halt',
        ],
    },
    {
        id: 'format-enforcer',
        label: 'Format Enforcer',
        skill_name: 'Format Enforcer',
        when_to_use: 'Use this skill when you need to reformat content to match a specific structure, template, or style guide — without changing the underlying meaning or information.',
        example_requests: [
            'Reformat this job description to match our standard template',
            'Convert these API docs to our internal documentation format',
            'Apply our changelog format to these release notes',
        ],
        expected_inputs: 'Source content to reformat, plus either a named format or an example template to match.',
        expected_outputs: 'The input content reformatted to exactly match the target structure. No content added or removed.',
        hard_rules: [
            'Do not alter meaning — only structure and formatting may change',
            'If content cannot be mapped to the target format, flag the gap explicitly',
        ],
    },
    {
        id: 'research-assistant',
        label: 'Research Assistant',
        skill_name: 'Research Assistant',
        when_to_use: 'Use this skill when you need structured research on a topic, including background context, key findings, competing viewpoints, and source recommendations — especially for unfamiliar domains.',
        example_requests: [
            'Research the current state of vector database technology for our architecture decision',
            'Give me background on GDPR compliance requirements for SaaS products',
            'Research best practices for onboarding enterprise customers',
        ],
        expected_inputs: 'A research topic or question, optional scope constraints (e.g., date range, geography, technical level), and the intended use of the research.',
        expected_outputs: 'Structured research brief with: overview, key findings, competing viewpoints, knowledge gaps, and recommended next steps or sources.',
        hard_rules: [
            'Clearly distinguish established facts from opinions or contested claims',
            'Flag when knowledge may be outdated and recommend verification',
        ],
    },
    {
        id: 'code-review-helper',
        label: 'Code Review Helper',
        skill_name: 'Code Review Helper',
        when_to_use: 'Use this skill when you need a thorough code review covering correctness, security, performance, readability, and adherence to best practices for the relevant language or framework.',
        example_requests: [
            'Review this Python function for security issues and edge cases',
            'Do a code review on this React component for performance and accessibility',
            'Check this SQL query for injection vulnerabilities and optimisation opportunities',
        ],
        expected_inputs: 'Code snippet or file content, the programming language/framework, and optionally the review focus (security, performance, style, etc.).',
        expected_outputs: 'Structured review with sections for: critical issues, warnings, suggestions, and positive notes. Each item includes line reference and recommended fix.',
        hard_rules: [
            'Always check for security vulnerabilities first before other concerns',
            'Provide concrete fix suggestions — never just flag issues without guidance',
        ],
    },
];

/**
 * Returns the full presets array.
 * @returns {object[]}
 */
function getPresets() {
    return PRESETS;
}

/**
 * Find a preset by id.
 * @param {string} id
 * @returns {object|null}
 */
function getPresetById(id) {
    return PRESETS.find(p => p.id === id) ?? null;
}

module.exports = { getPresets, getPresetById, PRESETS };
