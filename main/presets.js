/**
 * Built-in hardcoded presets — no file loading in v1.
 * Each preset populates: skill_name, when_to_use, example_requests (3),
 * expected_inputs, expected_outputs, hard_rules (2).
 */
const PRESETS = [
    // ── Original presets ────────────────────────────────────────────────────
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

    // ── Writing & Content ────────────────────────────────────────────────────
    {
        id: 'email-drafter',
        label: 'Email Drafter',
        skill_name: 'Email Drafter',
        when_to_use: 'Use this skill when you need to write or rewrite a professional email from rough notes, bullet points, or a vague intent — producing a clear, appropriately toned message ready to send.',
        example_requests: [
            'Draft a follow-up email to a client who missed our meeting',
            'Write a cold outreach email to a potential enterprise customer',
            'Rewrite these rough bullet points as a polished project update email',
        ],
        expected_inputs: 'The intent or goal of the email, key points to include, recipient context (role, relationship), and desired tone (formal, friendly, assertive, etc.).',
        expected_outputs: 'A complete email with subject line, greeting, body paragraphs, and sign-off. Tone and length matched to the stated context.',
        hard_rules: [
            'Never invent facts, names, or figures not provided in the input',
            'Always match the requested tone — do not default to overly formal language unless specified',
        ],
    },
    {
        id: 'tone-adjuster',
        label: 'Tone Adjuster',
        skill_name: 'Tone Adjuster',
        when_to_use: 'Use this skill when you need to rewrite existing content to match a different tone — such as formal, casual, technical, persuasive, or empathetic — without changing the underlying meaning or information.',
        example_requests: [
            'Rewrite this support reply to sound warmer and less robotic',
            'Make this technical explanation accessible to a non-technical audience',
            'Adjust this sales copy to sound more authoritative and less pushy',
        ],
        expected_inputs: 'The original content to rewrite, the target tone or audience, and any constraints (word count, terms to keep, terms to avoid).',
        expected_outputs: 'The rewritten content in the target tone. No facts added or removed. A brief note on the key changes made.',
        hard_rules: [
            'Never change factual content — only tone, word choice, and sentence structure may change',
            'Preserve all technical terms, product names, and proper nouns exactly as provided',
        ],
    },
    {
        id: 'meeting-agenda-builder',
        label: 'Meeting Agenda Builder',
        skill_name: 'Meeting Agenda Builder',
        when_to_use: 'Use this skill when you need to structure a meeting agenda from a topic list, goals, or rough notes — producing a timed, actionable agenda that keeps meetings focused and on schedule.',
        example_requests: [
            'Build a 60-minute agenda for our quarterly product review',
            'Create an agenda for a project kickoff meeting with a new client',
            'Turn these discussion topics into a structured team standup agenda',
        ],
        expected_inputs: 'Meeting purpose, duration, list of topics or goals, number of attendees, and any known constraints (e.g., decision to be made, presenter names).',
        expected_outputs: 'A structured agenda with time-blocked sections, a stated goal for each item, who leads each section, and a clear meeting objective at the top.',
        hard_rules: [
            'Time allocations must sum to the total meeting duration — never exceed it',
            'Every agenda item must have a stated purpose: inform, decide, or discuss',
        ],
    },
    {
        id: 'release-notes-writer',
        label: 'Release Notes Writer',
        skill_name: 'Release Notes Writer',
        when_to_use: 'Use this skill when you need to turn raw developer notes, a git log, or a list of changes into polished, user-facing release notes that are clear and appropriately scoped for the audience.',
        example_requests: [
            'Write release notes for v2.1.0 from this git log',
            'Turn these internal dev notes into customer-facing release notes',
            'Create a changelog entry for this sprint\'s features and bug fixes',
        ],
        expected_inputs: 'Raw changes as git log output, dev notes, or a bullet list. Target audience (end users, developers, or internal team) and version number.',
        expected_outputs: 'Structured release notes with sections for new features, improvements, and bug fixes. User-benefit framing, not implementation detail.',
        hard_rules: [
            'Never expose internal ticket IDs, branch names, or dev jargon in user-facing output unless explicitly requested',
            'Group changes by type — never output a flat chronological dump',
        ],
    },

    // ── Data & Analysis ──────────────────────────────────────────────────────
    {
        id: 'data-interpreter',
        label: 'Data Interpreter',
        skill_name: 'Data Interpreter',
        when_to_use: 'Use this skill when you need to explain what a dataset, table, chart, or set of metrics means in plain language — identifying trends, outliers, and actionable insights without requiring statistical expertise.',
        example_requests: [
            'Explain what these monthly churn figures mean for the business',
            'Interpret this A/B test result table — which variant won and why?',
            'What does this sales funnel data tell us about where we are losing customers?',
        ],
        expected_inputs: 'A dataset, table, or chart description. Context about what the data represents, the time period, and what decision or question the interpretation should inform.',
        expected_outputs: 'Plain-language interpretation covering: what the data shows, notable trends or outliers, confidence level, and recommended actions or next questions.',
        hard_rules: [
            'Never state conclusions that the data does not support — flag uncertainty explicitly',
            'Always distinguish correlation from causation',
        ],
    },
    {
        id: 'sql-query-builder',
        label: 'SQL Query Builder',
        skill_name: 'SQL Query Builder',
        when_to_use: 'Use this skill when you need to generate, explain, or optimise SQL queries from a plain-language description — covering SELECT, INSERT, UPDATE, DELETE, JOINs, aggregations, and subqueries.',
        example_requests: [
            'Write a query to find all users who signed up in the last 30 days but never logged in',
            'Optimise this slow JOIN query on our orders and customers tables',
            'Explain what this complex subquery is doing in plain English',
        ],
        expected_inputs: 'A plain-language description of what data is needed, or an existing query to explain/optimise. Schema or table/column names where available. Target database (PostgreSQL, MySQL, SQLite, etc.).',
        expected_outputs: 'A complete, commented SQL query. For optimisations, a before/after comparison with explanation of changes. For explanations, a line-by-line breakdown.',
        hard_rules: [
            'Always use parameterised placeholders for user-supplied values — never interpolate raw strings',
            'Flag any query that could cause a full table scan on large datasets',
        ],
    },
    {
        id: 'anomaly-spotter',
        label: 'Anomaly Spotter',
        skill_name: 'Anomaly Spotter',
        when_to_use: 'Use this skill when you need to identify outliers, missing values, duplicate records, formatting inconsistencies, or suspicious patterns in tabular data or log output.',
        example_requests: [
            'Check this CSV export for duplicate records and missing required fields',
            'Spot any anomalies in this week\'s transaction log',
            'Find inconsistencies in this product data import before we load it to the database',
        ],
        expected_inputs: 'Tabular data as CSV, JSON, or a pasted table. Description of expected schema or valid value ranges where known.',
        expected_outputs: 'A categorised anomaly report: duplicates, nulls/missing values, out-of-range values, formatting issues, and suspicious patterns. Row references included for each finding.',
        hard_rules: [
            'Report all anomalies found — never silently drop or correct data',
            'Distinguish definite errors from potential issues that require human judgement',
        ],
    },

    // ── Support & Customer Success ────────────────────────────────────────────
    {
        id: 'support-reply-writer',
        label: 'Support Reply Writer',
        skill_name: 'Support Reply Writer',
        when_to_use: 'Use this skill when you need to draft empathetic, on-brand customer support responses to tickets, emails, or reviews — covering complaints, how-to questions, billing issues, and feature requests.',
        example_requests: [
            'Write a reply to a customer angry about a billing error',
            'Draft a helpful response to a how-to question about our export feature',
            'Respond to this negative App Store review professionally and constructively',
        ],
        expected_inputs: 'The customer message or ticket content, the correct resolution or information to convey, brand tone guidelines if available, and any constraints (e.g., no refund offered, escalation required).',
        expected_outputs: 'A complete support reply: acknowledgement of the issue, clear resolution or next steps, empathetic tone, and a closing that invites further contact if needed.',
        hard_rules: [
            'Never promise outcomes that cannot be guaranteed (e.g., "this will be fixed by Friday")',
            'Always acknowledge the customer\'s frustration before moving to resolution',
        ],
    },
    {
        id: 'faq-generator',
        label: 'FAQ Generator',
        skill_name: 'FAQ Generator',
        when_to_use: 'Use this skill when you need to extract or generate FAQ question-and-answer pairs from documentation, feature descriptions, support transcripts, or product content.',
        example_requests: [
            'Generate an FAQ from this product documentation page',
            'Extract common questions and answers from these support chat transcripts',
            'Create an FAQ section for our new billing feature based on this spec',
        ],
        expected_inputs: 'Source content (docs, transcripts, feature spec, or topic description), target audience, and desired number of FAQ items.',
        expected_outputs: 'Numbered FAQ pairs with concise questions and clear, accurate answers. Grouped by theme where there are more than 5 items.',
        hard_rules: [
            'Every answer must be fully answerable from the source material — never speculate',
            'Questions must be phrased as a real user would ask them, not as internal jargon',
        ],
    },
    {
        id: 'escalation-classifier',
        label: 'Escalation Classifier',
        skill_name: 'Escalation Classifier',
        when_to_use: 'Use this skill when you need to triage and classify incoming support tickets, bug reports, or issues by severity, type, and responsible team — to prioritise response and route correctly.',
        example_requests: [
            'Classify these 20 support tickets by severity and assign to the right team',
            'Triage this incoming bug report and assess its business impact',
            'Sort this batch of customer complaints by urgency and issue type',
        ],
        expected_inputs: 'One or more issue descriptions (tickets, emails, or bug reports). Classification taxonomy if available (severity levels, team names, issue types). SLA targets if relevant.',
        expected_outputs: 'For each issue: severity level, issue type, recommended team/owner, suggested priority, and a one-sentence rationale. Summary counts at the end for batch inputs.',
        hard_rules: [
            'When severity is ambiguous, always classify higher — flag for human review rather than under-escalate',
            'Never assign ownership without sufficient information — mark as needs-triage if routing cannot be determined',
        ],
    },

    // ── Technical ────────────────────────────────────────────────────────────
    {
        id: 'bug-report-writer',
        label: 'Bug Report Writer',
        skill_name: 'Bug Report Writer',
        when_to_use: 'Use this skill when you need to turn a vague bug description, error message, or user complaint into a structured, reproducible bug report ready for a development team.',
        example_requests: [
            'Write a proper bug report from this user complaint about the export button',
            'Structure this error log into a reproducible bug report for the dev team',
            'Turn these rough QA notes into a formatted bug report with steps to reproduce',
        ],
        expected_inputs: 'A vague description, error message, log output, or QA note. Environment details (OS, browser, app version) if available. Expected vs actual behaviour if known.',
        expected_outputs: 'A structured bug report: title, environment, steps to reproduce, expected behaviour, actual behaviour, severity, and any relevant logs or screenshots noted.',
        hard_rules: [
            'Steps to reproduce must be numbered and atomic — one action per step',
            'Never conflate multiple bugs in one report — flag if the input describes more than one issue',
        ],
    },
    {
        id: 'api-docs-writer',
        label: 'API Docs Writer',
        skill_name: 'API Docs Writer',
        when_to_use: 'Use this skill when you need to document an API endpoint, function, or SDK method from a signature, raw request/response, or code sample — producing clear, developer-ready reference documentation.',
        example_requests: [
            'Document this REST endpoint from the route handler and response shape',
            'Write reference docs for this Node.js SDK method from its source code',
            'Generate OpenAPI-style documentation for these three endpoints',
        ],
        expected_inputs: 'Function signature, route definition, or raw HTTP request/response. Code comments or inline notes if available. Authentication requirements and error codes if known.',
        expected_outputs: 'Complete endpoint or method documentation: description, parameters table (name, type, required, description), request example, response example, error codes, and usage notes.',
        hard_rules: [
            'Every parameter must have a type, required flag, and description — never leave these blank',
            'Include at least one realistic request and response example per endpoint',
        ],
    },
    {
        id: 'test-case-generator',
        label: 'Test Case Generator',
        skill_name: 'Test Case Generator',
        when_to_use: 'Use this skill when you need to produce unit, integration, or acceptance test cases from a function signature, feature description, or requirements document.',
        example_requests: [
            'Generate unit test cases for this validation function',
            'Create acceptance test cases for the user registration feature',
            'Write test scenarios for this payment processing flow including edge cases',
        ],
        expected_inputs: 'Function code or signature, feature description, or requirements. Testing framework preference (Jest, Mocha, pytest, etc.) and target coverage areas (happy path, edge cases, error handling).',
        expected_outputs: 'A set of named test cases each with: description, input/preconditions, expected output/postcondition, and test type (unit/integration/acceptance). Code stubs where a framework is specified.',
        hard_rules: [
            'Always include at least one negative test case and one boundary/edge case per function or feature',
            'Test case descriptions must be specific enough to implement without ambiguity',
        ],
    },
    {
        id: 'regex-builder',
        label: 'Regex Builder',
        skill_name: 'Regex Builder',
        when_to_use: 'Use this skill when you need to generate, explain, or debug a regular expression from a plain-language pattern description or example strings.',
        example_requests: [
            'Write a regex to validate UK postcodes',
            'Explain what this regex is doing: ^(?=.*[A-Z])(?=.*\\d).{8,}$',
            'Fix this regex — it matches too greedily and captures the wrong group',
        ],
        expected_inputs: 'A plain-language description of what the pattern should match, example strings that should and should not match, and the target language or engine (JavaScript, Python, PCRE, etc.).',
        expected_outputs: 'The regex pattern with a plain-English explanation of each component. Match/no-match examples. Flags used and why. Common edge cases noted.',
        hard_rules: [
            'Always provide at least three positive and two negative match examples to verify correctness',
            'Flag any pattern with catastrophic backtracking risk and suggest a safe alternative',
        ],
    },

    // ── Business ─────────────────────────────────────────────────────────────
    {
        id: 'job-description-writer',
        label: 'Job Description Writer',
        skill_name: 'Job Description Writer',
        when_to_use: 'Use this skill when you need to create a structured, inclusive job description from a role brief, responsibilities list, or hiring manager notes.',
        example_requests: [
            'Write a job description for a senior Node.js backend engineer',
            'Turn these hiring manager notes into a proper JD for a product designer role',
            'Create a job posting for a customer success manager with 2 years experience required',
        ],
        expected_inputs: 'Role title, key responsibilities, required and preferred skills, seniority level, employment type, location/remote policy, and any company culture notes.',
        expected_outputs: 'A complete job description: role summary, responsibilities (bulleted), required qualifications, preferred qualifications, and what the company offers. Inclusive language throughout.',
        hard_rules: [
            'Never include age, gender, or nationality requirements — flag if such inputs are provided',
            'Distinguish clearly between required and preferred qualifications — never merge them',
        ],
    },
    {
        id: 'prd-writer',
        label: 'PRD Writer',
        skill_name: 'PRD Writer',
        when_to_use: 'Use this skill when you need to turn a feature idea, customer request, or rough brief into a structured Product Requirements Document ready for engineering and design review.',
        example_requests: [
            'Write a PRD for a bulk export feature based on these customer requests',
            'Turn this rough feature idea into a proper requirements document',
            'Create a PRD for adding two-factor authentication to our app',
        ],
        expected_inputs: 'Feature idea or problem statement, target users, business goal, known constraints (technical, timeline, scope), and any existing solutions or prior art.',
        expected_outputs: 'A structured PRD covering: problem statement, goals and success metrics, user stories, functional requirements, non-functional requirements, out-of-scope items, and open questions.',
        hard_rules: [
            'Every functional requirement must be testable — avoid vague language like "fast" or "easy to use"',
            'Out-of-scope must be explicitly stated to prevent scope creep',
        ],
    },
    {
        id: 'competitor-analyser',
        label: 'Competitor Analyser',
        skill_name: 'Competitor Analyser',
        when_to_use: 'Use this skill when you need a structured comparison of your product or feature against a named competitor — covering strengths, weaknesses, gaps, and strategic positioning.',
        example_requests: [
            'Compare our onboarding flow against Intercom\'s based on these notes',
            'Analyse how our pricing stacks up against our three main competitors',
            'Do a feature gap analysis between our product and Notion',
        ],
        expected_inputs: 'Your product details and the competitor(s) to compare against. Comparison dimensions (features, pricing, UX, market positioning, integrations, etc.) and the decision this analysis should inform.',
        expected_outputs: 'A structured comparison covering: feature matrix, identified gaps, areas of advantage, areas of weakness, and strategic recommendations. Assumptions flagged where data is estimated.',
        hard_rules: [
            'Clearly separate verified facts from estimates or inferences — never present assumptions as facts',
            'Always include a "so what" strategic recommendation — never deliver a comparison without actionable conclusions',
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
