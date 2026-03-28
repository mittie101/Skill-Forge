'use strict';

const { ipcMain, dialog, shell, BrowserWindow } = require('electron');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { getSetting }      = require('../main/db/settings');
const { fenceUserInput }  = require('../main/prompts');
const { sanitise }        = require('../main/slug');
const { getDefaultOutputDir } = require('../main/config');

/**
 * Write content atomically: write to a UUID-named temp file then rename.
 * Guarantees the destination is never left in a partial state on crash.
 * @param {string} filePath   Final destination path
 * @param {string} content    UTF-8 string content
 * @param {{ exclusive?: boolean }} [opts]
 *   exclusive=true → return { error: 'EEXIST' } if filePath already exists
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
        : path.join(folder, slug, `${slug}.md`);
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
        } catch (err) {
            return { error: err.code ?? 'mkdir_failed', message: err.message };
        }
        return _atomicWrite(filePath, content, { exclusive: true });
    });

    // Overwrite confirmed by user
    ipcMain.handle('save-skill-overwrite', (_e, { filePath, content }) => {
        const folder = _folder();
        if (!_isWithinFolder(filePath, folder)) return { error: 'invalid_path' };
        return _atomicWrite(filePath, content);
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
        } catch (err) {
            return { error: err.code ?? 'mkdir_failed', message: err.message };
        }
        return _atomicWrite(filePath, content, { exclusive: true });
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
