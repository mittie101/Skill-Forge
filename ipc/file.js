'use strict';

const { ipcMain, dialog, shell, BrowserWindow } = require('electron');
const fs   = require('fs');
const path = require('path');
const { getSetting }      = require('../main/db/settings');
const { fenceUserInput }  = require('../main/prompts');
const { sanitise }        = require('../main/slug');
const { getDefaultOutputDir } = require('../main/config');

function _folder() {
    return getSetting('output_folder') ?? getDefaultOutputDir();
}

// Verify that filePath is safely within the configured output folder.
// Prevents a compromised renderer from writing to arbitrary paths.
function _isWithinFolder(filePath, folder) {
    const resolved = path.resolve(filePath);
    const base     = path.resolve(folder);
    return resolved === base || resolved.startsWith(base + path.sep);
}

function _buildPath(folder, slug, mode) {
    return mode === 'flat'
        ? path.join(folder, `${slug}.md`)
        : path.join(folder, slug, 'SKILL.md');
}

function register() {
    // Exclusive create — returns { error: 'EEXIST', filePath } on collision
    ipcMain.handle('save-skill', (_e, { slug, content, mode }) => {
        const folder   = _folder();
        if (!fs.existsSync(folder)) return { error: 'folder_missing' };
        const safeSlug = sanitise(slug || 'skill');
        const filePath = _buildPath(folder, safeSlug, mode);
        try {
            if (mode !== 'flat') fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, content, { flag: 'wx', encoding: 'utf8' });
            return { ok: true, filePath };
        } catch (err) {
            if (err.code === 'EEXIST') return { error: 'EEXIST', filePath };
            return { error: err.code ?? 'write_failed', message: err.message };
        }
    });

    // Overwrite confirmed by user
    ipcMain.handle('save-skill-overwrite', (_e, { filePath, content }) => {
        const folder = _folder();
        if (!_isWithinFolder(filePath, folder)) return { error: 'invalid_path' };
        try {
            fs.writeFileSync(filePath, content, { encoding: 'utf8' });
            return { ok: true, filePath };
        } catch (err) {
            return { error: err.code ?? 'write_failed', message: err.message };
        }
    });

    // Auto-increment slug suffix until an unused path is found
    ipcMain.handle('save-skill-as-copy', (_e, { slug, content, mode }) => {
        const folder   = _folder();
        const safeSlug = sanitise(slug || 'skill');
        let suffix = 2;
        let filePath;
        while (suffix <= 999) {
            filePath = _buildPath(folder, `${safeSlug}-${suffix}`, mode);
            if (!fs.existsSync(filePath)) break;
            suffix++;
        }
        if (suffix > 999) return { error: 'copy_limit_exceeded' };
        try {
            if (mode !== 'flat') fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, content, { flag: 'wx', encoding: 'utf8' });
            return { ok: true, filePath };
        } catch (err) {
            return { error: err.code ?? 'write_failed', message: err.message };
        }
    });

    ipcMain.handle('import-skill', async (e) => {
        const win = BrowserWindow.fromWebContents(e.sender);
        const result = await dialog.showOpenDialog(win, {
            filters: [{ name: 'Markdown', extensions: ['md'] }],
            properties: ['openFile'],
        });
        if (result.canceled || !result.filePaths.length) return null;

        const filePath = result.filePaths[0];
        let stat;
        try { stat = fs.statSync(filePath); }
        catch (err) {
            return { error: err.code === 'ENOENT' ? 'ENOENT' : err.code === 'EBUSY' ? 'EBUSY' : 'unreadable' };
        }

        if (stat.size > 50 * 1024) return { error: 'TOO_LARGE' };

        let content;
        try { content = fs.readFileSync(filePath, { encoding: 'utf8' }); }
        catch (err) {
            return { error: err.code === 'ENOENT' ? 'ENOENT' : err.code === 'EBUSY' ? 'EBUSY' : 'unreadable' };
        }

        // Explicit UTF-8 validation: Node decodes with replacement chars (U+FFFD) on invalid sequences
        if (content.includes('\uFFFD')) return { error: 'invalid_utf8' };

        // Fence before any potential AI inclusion
        const fenced = fenceUserInput(content);
        return { ok: true, content, fenced, filePath };
    });

    ipcMain.handle('open-in-editor', async (_e, filePath) => {
        const folder = _folder();
        if (!_isWithinFolder(filePath, folder)) return { error: 'invalid_path' };
        const errStr = await shell.openPath(filePath);
        if (errStr) return { error: errStr };
        return { ok: true };
    });
}

module.exports = { register };
