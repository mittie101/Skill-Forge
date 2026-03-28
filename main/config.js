'use strict';
const path = require('path');

const INPUT_CAPS = {
    SKILL_NAME:       80,
    WHEN_TO_USE:      1000,
    EXAMPLE_REQUEST:  200,
    EXAMPLE_MAX:      10,
    EXPECTED_INPUTS:  3000,
    EXPECTED_OUTPUTS: 3000,
    CONSTRAINTS:      3000,
    KEYWORD:          500,
    DESCRIPTION:      2000,
    SECTION_NAME:     100,
};
const HISTORY_CAP     = 100;
const HISTORY_WARN_AT = 80;
const IMPORT_MAX_BYTES = 50 * 1024;
const DEFAULT_WINDOW  = { width: 1280, height: 800 };
const GENERATE_TIMEOUT_MS   = 120_000;
const SUGGEST_TIMEOUT_MS    =   8_000;
const DEFAULT_SECTION_COUNT = 5;
const MAX_TOKENS_DEFAULT    = 8192;
const VALID_PROVIDERS = ['anthropic', 'openai'];
const VALID_MODELS = {
    anthropic: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-haiku-4-5-20251001'], // claude-haiku-4-5-20251001 uses different version date format — this is correct
    openai:    ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini'],
};
const PROVIDERS = {
    anthropic: {
        id:       'anthropic',
        label:    'Anthropic',
        endpoint: 'https://api.anthropic.com/v1/messages',
        model:    'claude-sonnet-4-20250514',
    },
    openai: {
        id:       'openai',
        label:    'OpenAI',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        model:    'gpt-4o',
    },
};
const FIX_BUFFER_LIMIT_BYTES = 512 * 1024;
const WINDOWS_RESERVED = new Set([
    'CON','PRN','AUX','NUL',
    'COM1','COM2','COM3','COM4','COM5','COM6','COM7','COM8','COM9',
    'LPT1','LPT2','LPT3','LPT4','LPT5','LPT6','LPT7','LPT8','LPT9',
]);
function getDbPath() {
    const { app } = require('electron');
    return path.join(app.getPath('userData'), 'skillforge.db');
}
function getDefaultOutputDir() {
    const { app } = require('electron');
    return path.join(app.getPath('documents'), 'skills');
}
module.exports = {
    INPUT_CAPS, HISTORY_CAP, HISTORY_WARN_AT, IMPORT_MAX_BYTES,
    DEFAULT_WINDOW, GENERATE_TIMEOUT_MS, SUGGEST_TIMEOUT_MS,
    DEFAULT_SECTION_COUNT, MAX_TOKENS_DEFAULT,
    VALID_PROVIDERS, VALID_MODELS, PROVIDERS, WINDOWS_RESERVED,
    FIX_BUFFER_LIMIT_BYTES,
    getDbPath, getDefaultOutputDir,
};
