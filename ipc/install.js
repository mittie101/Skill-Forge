'use strict';

const { ipcMain, dialog, shell, BrowserWindow } = require('electron');
const fs     = require('fs');
const path   = require('path');
const os     = require('os');
const crypto = require('crypto');
const { parseFrontmatter } = require('../main/frontmatter');

/**
 * Write content atomically: write to a UUID-named temp file then rename.
 * Guarantees the destination is never left in a partial state on crash.
 * @param {string} filePath   Final destination path
 * @param {string} content    UTF-8 string content
 * @param {{ exclusive?: boolean }} [opts]
 * @returns {{ ok: true, filePath: string } | { error: string, filePath?: string, message?: string }}
 */
function _atomicWrite(filePath, content, { exclusive = false } = {}) {
    if (exclusive && fs.existsSync(filePath)) {
        return { error: 'EEXIST', filePath };
    }
    const tmpPath = filePath + '.' + crypto.randomUUID() + '.tmp';
    try {
        fs.writeFileSync(tmpPath, content, { encoding: 'utf8' });
        fs.renameSync(tmpPath, filePath);
        return { ok: true, filePath };
    } catch (err) {
        try { fs.unlinkSync(tmpPath); } catch {}
        if (exclusive && err.code === 'EEXIST') return { error: 'EEXIST', filePath };
        return { error: err.code ?? 'write_failed', message: err.message };
    }
}

// Sanitise name → safe Windows filename stem (same rules as C++ makeSafeName)
function _makeSafeName(name) {
    let s = (name ?? '').replace(/[^a-zA-Z0-9\-_]/g, '-');
    s = s.replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '');
    const RESERVED = new Set([
        'CON','PRN','AUX','NUL',
        'COM1','COM2','COM3','COM4','COM5','COM6','COM7','COM8','COM9',
        'LPT1','LPT2','LPT3','LPT4','LPT5','LPT6','LPT7','LPT8','LPT9',
    ]);
    if (!s || RESERVED.has(s.toUpperCase())) s = s ? `${s}-skill` : 'skill';
    return s;
}

// Extract a ## Section from body (case-insensitive)
function _extractSection(body, heading) {
    const lbody = body.toLowerCase();
    const pat   = `## ${heading.toLowerCase()}`;
    const idx   = lbody.indexOf(pat);
    if (idx === -1) return '';
    const start = body.indexOf('\n', idx);
    if (start === -1) return '';
    const next  = lbody.indexOf('\n## ', start + 1);
    return (next === -1 ? body.slice(start + 1) : body.slice(start + 1, next)).trim();
}

// Build the output file content (mirrors C++ buildCommand)
function _buildInstallContent(meta, body, modeSkill) {
    const get = (k) => meta[k] ?? '';
    const desc    = get('description');
    const when    = _extractSection(body, 'when to use');
    const instr   = _extractSection(body, 'instructions');
    const outputs = _extractSection(body, 'expected outputs');
    const rules   = _extractSection(body, 'hard rules');
    const edges   = _extractSection(body, 'edge cases');

    let out = '';
    if (modeSkill) {
        out += `---\nname: ${get('name')}\n`;
        if (desc) out += `description: ${desc}\n`;
        out += `---\n\n`;
    }
    if (desc)    out += `${desc}\n\n`;
    if (when)    out += `## When to Use\n\n${when}\n\n`;
    if (instr)   out += `## Instructions\n\n${instr}\n\n`;
    if (outputs) out += `## Expected Outputs\n\n${outputs}\n\n`;
    if (rules)   out += `## Hard Rules\n\n${rules}\n\n`;
    if (edges)   out += `## Edge Cases\n\n${edges}\n\n`;
    out += `## Task\n\n$ARGUMENTS`;
    return out;
}

function _loadSkillFile(filePath) {
    // Reject any path that isn't a .md file — prevents renderer from exfiltrating
    // arbitrary files by supplying a non-markdown path.
    if (path.extname(filePath).toLowerCase() !== '.md') return { error: 'invalid_extension' };

    let stat;
    try { stat = fs.statSync(filePath); }
    catch (err) { return { error: err.code ?? 'stat_failed' }; }
    if (stat.size > 1024 * 1024) return { error: 'TOO_LARGE' };

    let raw;
    try { raw = fs.readFileSync(filePath, { encoding: 'utf8' }); }
    catch (err) { return { error: err.code ?? 'read_failed' }; }

    // Strip BOM + normalise CRLF
    raw = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');

    const { meta, body } = parseFrontmatter(raw);
    const name     = (meta['name'] || path.basename(filePath, '.md')).trim();
    const safeName = _makeSafeName(name);
    if (!safeName) return { error: 'invalid_name' };

    const warnNoSections =
        !_extractSection(body, 'when to use') &&
        !_extractSection(body, 'instructions') &&
        !_extractSection(body, 'expected outputs') &&
        !_extractSection(body, 'hard rules') &&
        !_extractSection(body, 'edge cases');

    return { ok: true, name, safeName, meta, body, filePath, warnNoSections };
}

function register() {

    // Open file dialog — returns parsed skill info or null/error
    ipcMain.handle('install-open-file', async (e) => {
        const win = BrowserWindow.fromWebContents(e.sender);
        const result = await dialog.showOpenDialog(win, {
            filters: [{ name: 'Markdown', extensions: ['md'] }],
            properties: ['openFile'],
        });
        if (result.canceled || !result.filePaths.length) return null;
        return _loadSkillFile(result.filePaths[0]);
    });

    // Load a skill file from a path (also used for drag/drop — renderer passes the path)
    ipcMain.handle('install-load-file', (_e, filePath) => {
        if (typeof filePath !== 'string') return { error: 'invalid_path' };
        return _loadSkillFile(filePath);
    });

    // Install skill to ~/.claude/ — returns { ok, installPath, command } or { error }
    ipcMain.handle('install-skill', (_e, { filePath, modeSkill }) => {
        // Re-parse file at install time (don't trust renderer state)
        const loaded = _loadSkillFile(filePath);
        if (loaded.error) return loaded;

        const userProfile = os.homedir();
        const safeName    = loaded.safeName;
        const installPath = modeSkill
            ? path.join(userProfile, '.claude', 'skills', safeName, 'SKILL.md')
            : path.join(userProfile, '.claude', 'commands', `${safeName}.md`);

        const content = _buildInstallContent(loaded.meta, loaded.body, modeSkill);

        // Collision check
        if (fs.existsSync(installPath)) {
            return { error: 'EEXIST', installPath };
        }

        try {
            fs.mkdirSync(path.dirname(installPath), { recursive: true });
        } catch (err) {
            return { error: err.code ?? 'mkdir_failed', message: err.message };
        }
        const writeResult = _atomicWrite(installPath, content, { exclusive: true });
        if (!writeResult.ok) return writeResult;

        const command = modeSkill ? `/${safeName}` : `/user:${safeName}`;
        return { ok: true, installPath, command };
    });

    // Overwrite install (user confirmed)
    ipcMain.handle('install-skill-overwrite', (_e, { filePath, modeSkill }) => {
        const loaded = _loadSkillFile(filePath);
        if (loaded.error) return loaded;

        const userProfile = os.homedir();
        const safeName    = loaded.safeName;
        const installPath = modeSkill
            ? path.join(userProfile, '.claude', 'skills', safeName, 'SKILL.md')
            : path.join(userProfile, '.claude', 'commands', `${safeName}.md`);

        const content = _buildInstallContent(loaded.meta, loaded.body, modeSkill);

        try {
            fs.mkdirSync(path.dirname(installPath), { recursive: true });
        } catch (err) {
            return { error: err.code ?? 'mkdir_failed', message: err.message };
        }
        const writeResult = _atomicWrite(installPath, content);
        if (!writeResult.ok) return writeResult;

        const command = modeSkill ? `/${safeName}` : `/user:${safeName}`;
        return { ok: true, installPath, command };
    });

    // Open the install folder in Explorer
    ipcMain.handle('install-open-folder', async (_e, { safeName, modeSkill }) => {
        // FIX: re-validate safeName — renderer-supplied value must not be trusted for path construction
        const safe = _makeSafeName(safeName);
        if (!safe) return { error: 'invalid_name' };
        const userProfile = os.homedir();
        const folderPath  = modeSkill
            ? path.join(userProfile, '.claude', 'skills', safe)
            : path.join(userProfile, '.claude', 'commands');
        const errMsg = await shell.openPath(folderPath);
        if (errMsg) return { error: errMsg };
        return { ok: true };
    });

    // Preview: get install path without writing
    ipcMain.handle('install-preview-path', (_e, { safeName, modeSkill }) => {
        // FIX: re-validate safeName — renderer-supplied value must not be trusted for path construction
        const safe = _makeSafeName(safeName);
        if (!safe) return { error: 'invalid_name' };
        const userProfile = os.homedir();
        return modeSkill
            ? path.join(userProfile, '.claude', 'skills', safe, 'SKILL.md')
            : path.join(userProfile, '.claude', 'commands', `${safe}.md`);
    });

    // List all installed skills and commands in ~/.claude/
    ipcMain.handle('list-installed-skills', () => {
        const base    = path.join(os.homedir(), '.claude');
        const results = [];

        // Slash commands: ~/.claude/commands/*.md
        const commandsDir = path.join(base, 'commands');
        if (fs.existsSync(commandsDir)) {
            try {
                fs.readdirSync(commandsDir).forEach(f => {
                    if (f.endsWith('.md')) {
                        results.push({
                            name:     path.basename(f, '.md'),
                            filePath: path.join(commandsDir, f),
                            type:     'command',
                        });
                    }
                });
            } catch {}
        }

        // Skills: ~/.claude/skills/<name>/SKILL.md
        const skillsDir = path.join(base, 'skills');
        if (fs.existsSync(skillsDir)) {
            try {
                fs.readdirSync(skillsDir).forEach(entry => {
                    const skillFile = path.join(skillsDir, entry, 'SKILL.md');
                    if (fs.existsSync(skillFile)) {
                        results.push({
                            name:     entry,
                            filePath: skillFile,
                            type:     'skill',
                        });
                    }
                });
            } catch {}
        }

        return results.slice(0, 200);
    });
}

// Re-export parseFrontmatter under the legacy underscore name for test compatibility
const _parseFrontmatter = parseFrontmatter;

module.exports = { register, _makeSafeName, _parseFrontmatter, _extractSection, _buildInstallContent };
