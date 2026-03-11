'use strict';

const { renderClaude }    = require('../../main/framework-renderers/claude');
const { renderChatGPT }   = require('../../main/framework-renderers/chatgpt');
const { renderLangChain } = require('../../main/framework-renderers/langchain');

const { validateClaudeOutput }    = require('../../main/validators/claude');
const { validateChatGPTOutput }   = require('../../main/validators/chatgpt');
const { validateLangChainOutput } = require('../../main/validators/langchain');

// ── Shared fixture ──────────────────────────────────────────────────────────

function validJson(fw) {
    return {
        name:             'Test Skill',
        description:      'A test skill for unit tests',
        when_to_use:      'Use this when you need to test things thoroughly and completely',
        example_requests: ['Do a test', 'Run another test'],
        expected_inputs:  'Input text',
        expected_outputs: 'Output text',
        instructions:     ['Step one: do the first thing', 'Step two: do the second thing'],
        hard_rules:       ['Never skip step two'],
        edge_cases:       ['Handle empty input gracefully'],
        metadata: {
            framework:  fw,
            provider:   'anthropic',
            model:      'claude-sonnet-4-20250514',
            created_at: '2025-01-01T00:00:00.000Z',
        },
    };
}

// ── renderClaude ────────────────────────────────────────────────────────────

describe('renderClaude', () => {
    test('returns a string', () => {
        expect(typeof renderClaude(validJson('claude'))).toBe('string');
    });

    test('output starts with YAML frontmatter ---', () => {
        expect(renderClaude(validJson('claude')).trimStart()).toMatch(/^---/);
    });

    test('frontmatter contains framework: claude', () => {
        expect(renderClaude(validJson('claude'))).toContain('framework: claude');
    });

    test('frontmatter contains name field', () => {
        expect(renderClaude(validJson('claude'))).toContain('name:');
    });

    test('output contains ## When to use section', () => {
        expect(renderClaude(validJson('claude'))).toContain('## When to use');
    });

    test('output contains ## Instructions section', () => {
        expect(renderClaude(validJson('claude'))).toContain('## Instructions');
    });

    test('output contains ## Hard rules when hard_rules non-empty', () => {
        expect(renderClaude(validJson('claude'))).toContain('## Hard rules');
    });

    test('omits ## Hard rules when hard_rules is empty', () => {
        const j = validJson('claude');
        j.hard_rules = [];
        expect(renderClaude(j)).not.toContain('## Hard rules');
    });

    test('output contains ## Edge cases when edge_cases non-empty', () => {
        expect(renderClaude(validJson('claude'))).toContain('## Edge cases');
    });

    test('escapes double quotes in name for YAML', () => {
        const j = validJson('claude');
        j.name = 'Skill with "quotes"';
        const out = renderClaude(j);
        expect(out).toContain('\\"quotes\\"');
    });

    test('numbered instructions', () => {
        const out = renderClaude(validJson('claude'));
        expect(out).toContain('1. Step one');
        expect(out).toContain('2. Step two');
    });

    test('example requests rendered as list items', () => {
        const out = renderClaude(validJson('claude'));
        expect(out).toContain('- Do a test');
    });
});

// ── validateClaudeOutput ────────────────────────────────────────────────────

describe('validateClaudeOutput', () => {
    test('valid Claude output passes', () => {
        const md = renderClaude(validJson('claude'));
        expect(validateClaudeOutput(md).valid).toBe(true);
    });

    test('empty string fails', () => {
        expect(validateClaudeOutput('').valid).toBe(false);
    });

    test('missing --- frontmatter fails', () => {
        const { valid, errors } = validateClaudeOutput('# Test\n\nContent here');
        expect(valid).toBe(false);
        expect(errors.some(e => /frontmatter/i.test(e))).toBe(true);
    });

    test('unclosed frontmatter fails', () => {
        const { valid, errors } = validateClaudeOutput('---\nname: "x"\nframework: claude\n');
        expect(valid).toBe(false);
        expect(errors.some(e => /closed|closing/i.test(e))).toBe(true);
    });

    test('frontmatter missing framework: claude fails', () => {
        const { valid, errors } = validateClaudeOutput('---\nname: "x"\n---\n# Body');
        expect(valid).toBe(false);
        expect(errors.some(e => /framework/i.test(e))).toBe(true);
    });
});

// ── renderChatGPT ───────────────────────────────────────────────────────────

describe('renderChatGPT', () => {
    test('returns a string', () => {
        expect(typeof renderChatGPT(validJson('chatgpt'))).toBe('string');
    });

    test('output contains # Role section', () => {
        expect(renderChatGPT(validJson('chatgpt'))).toContain('# Role');
    });

    test('output contains # Rules section', () => {
        expect(renderChatGPT(validJson('chatgpt'))).toContain('# Rules');
    });

    test('output contains # Instructions section', () => {
        expect(renderChatGPT(validJson('chatgpt'))).toContain('# Instructions');
    });

    test('uses hard_rules in Rules section', () => {
        const out = renderChatGPT(validJson('chatgpt'));
        expect(out).toContain('Never skip step two');
    });

    test('falls back to default rule when hard_rules is empty', () => {
        const j = validJson('chatgpt');
        j.hard_rules = [];
        const out = renderChatGPT(j);
        expect(out).toContain('Always follow');
    });

    test('contains metadata footer with date', () => {
        const out = renderChatGPT(validJson('chatgpt'));
        expect(out).toContain('Generated for ChatGPT');
    });
});

// ── validateChatGPTOutput ───────────────────────────────────────────────────

describe('validateChatGPTOutput', () => {
    test('valid ChatGPT output passes', () => {
        const md = renderChatGPT(validJson('chatgpt'));
        expect(validateChatGPTOutput(md).valid).toBe(true);
    });

    test('empty string fails', () => {
        expect(validateChatGPTOutput('').valid).toBe(false);
    });

    test('missing # Role fails', () => {
        const { valid, errors } = validateChatGPTOutput('# Rules\n\nSome rules');
        expect(valid).toBe(false);
        expect(errors.some(e => /role/i.test(e))).toBe(true);
    });

    test('missing # Rules fails', () => {
        const { valid, errors } = validateChatGPTOutput('# Role\n\nSome role');
        expect(valid).toBe(false);
        expect(errors.some(e => /rules/i.test(e))).toBe(true);
    });

    test('case-insensitive heading check', () => {
        expect(validateChatGPTOutput('# ROLE\n\n# RULES\n\nContent').valid).toBe(true);
    });
});

// ── renderLangChain ─────────────────────────────────────────────────────────

describe('renderLangChain', () => {
    test('returns a string', () => {
        expect(typeof renderLangChain(validJson('langchain'))).toBe('string');
    });

    test('output contains {input} placeholder', () => {
        expect(renderLangChain(validJson('langchain'))).toContain('{input}');
    });

    test('output contains {context} placeholder', () => {
        expect(renderLangChain(validJson('langchain'))).toContain('{context}');
    });

    test('output contains {format_instructions} placeholder', () => {
        expect(renderLangChain(validJson('langchain'))).toContain('{format_instructions}');
    });

    test('output contains ## Prompt template section', () => {
        expect(renderLangChain(validJson('langchain'))).toContain('## Prompt template');
    });

    test('output contains ## System instructions section', () => {
        expect(renderLangChain(validJson('langchain'))).toContain('## System instructions');
    });

    test('contains metadata footer', () => {
        expect(renderLangChain(validJson('langchain'))).toContain('Generated for LangChain');
    });

    test('includes hard_rules when non-empty', () => {
        const out = renderLangChain(validJson('langchain'));
        expect(out).toContain('## Rules');
        expect(out).toContain('Never skip step two');
    });

    test('omits ## Rules when hard_rules is empty', () => {
        const j = validJson('langchain');
        j.hard_rules = [];
        expect(renderLangChain(j)).not.toContain('## Rules');
    });
});

// ── validateLangChainOutput ─────────────────────────────────────────────────

describe('validateLangChainOutput', () => {
    test('valid LangChain output passes', () => {
        const md = renderLangChain(validJson('langchain'));
        expect(validateLangChainOutput(md).valid).toBe(true);
    });

    test('empty string fails', () => {
        expect(validateLangChainOutput('').valid).toBe(false);
    });

    test('output without {variable} placeholder fails', () => {
        const { valid, errors } = validateLangChainOutput('# Test\n\nNo placeholders here.');
        expect(valid).toBe(false);
        expect(errors.some(e => /placeholder/i.test(e))).toBe(true);
    });

    test('output with any {word} placeholder passes', () => {
        expect(validateLangChainOutput('Process {question} and return answer.').valid).toBe(true);
    });

    test('render → validate round-trip is valid', () => {
        const md = renderLangChain(validJson('langchain'));
        const { valid, errors } = validateLangChainOutput(md);
        expect(valid).toBe(true);
        expect(errors).toHaveLength(0);
    });
});
