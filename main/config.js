const path = require('path');

// ── Input field caps (hard limits enforced at field level) ──
const INPUT_CAPS = {
    SKILL_NAME:       80,
    WHEN_TO_USE:      1000,
    EXAMPLE_REQUEST:  200,   // per item
    EXAMPLE_MAX:      10,    // max number of items
    EXPECTED_INPUTS:  500,
    EXPECTED_OUTPUTS: 500,
    CONSTRAINTS:      1500,
};

// ── History ──
const HISTORY_CAP     = 100;   // max rows before oldest pruned
const HISTORY_WARN_AT = 80;    // soft warning threshold

// ── Import ──
const IMPORT_MAX_BYTES = 50 * 1024;   // 50 KB

// ── Default window size ──
const DEFAULT_WINDOW = { width: 1280, height: 800 };

// ── File paths (lazy — requires Electron app to be ready) ──
function getDbPath() {
    const { app } = require('electron');
    return path.join(app.getPath('userData'), 'skillforge.db');
}

function getDefaultOutputDir() {
    const { app } = require('electron');
    return path.join(app.getPath('documents'), 'skills');
}

// ── Providers ──
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

// ── Windows reserved filename stems ──
const WINDOWS_RESERVED = new Set([
    'CON','PRN','AUX','NUL',
    'COM1','COM2','COM3','COM4','COM5','COM6','COM7','COM8','COM9',
    'LPT1','LPT2','LPT3','LPT4','LPT5','LPT6','LPT7','LPT8','LPT9',
]);

module.exports = {
    INPUT_CAPS,
    HISTORY_CAP,
    HISTORY_WARN_AT,
    IMPORT_MAX_BYTES,
    DEFAULT_WINDOW,
    getDbPath,
    getDefaultOutputDir,
    PROVIDERS,
    WINDOWS_RESERVED,
};
