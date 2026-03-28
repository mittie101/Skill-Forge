'use strict';

const { ipcMain, dialog } = require('electron');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const {
    listHistory,
    searchHistory,
    deleteHistory,
    getHistoryById,
    clearHistory,
    historyCount,
} = require('../main/db/history');

function register() {
    ipcMain.handle('list-history', (_e, opts = {}) => {
        return listHistory(opts);
    });

    ipcMain.handle('search-history', (_e, { query, framework } = {}) => {
        const q  = (query    ?? '').trim();
        const fw = (framework ?? '') || undefined;
        if (!q) return listHistory({ framework: fw });
        return searchHistory(q, fw);
    });

    ipcMain.handle('delete-history', (_e, id) => {
        return deleteHistory(Number(id));
    });

    ipcMain.handle('reopen-history', (_e, id) => {
        return getHistoryById(Number(id));
    });

    ipcMain.handle('clear-all-history', () => {
        return clearHistory();
    });

    ipcMain.handle('history-count', () => {
        return historyCount();
    });

    ipcMain.handle('export-history', async (_e) => {
        const { canceled, filePath } = await dialog.showSaveDialog({
            title:       'Export History',
            defaultPath: 'skillforge-history.json',
            filters:     [{ name: 'JSON', extensions: ['json'] }],
        });
        if (canceled || !filePath) return { ok: false, error: 'cancelled' };

        const rows    = listHistory({});
        const json    = JSON.stringify(rows, null, 2);
        const tmpPath = filePath + '.' + crypto.randomUUID() + '.tmp';
        try {
            fs.writeFileSync(tmpPath, json, { encoding: 'utf8' });
            fs.renameSync(tmpPath, filePath);
            return { ok: true, filePath };
        } catch (err) {
            try { fs.unlinkSync(tmpPath); } catch {}
            return { ok: false, error: err.message };
        }
    });
}

module.exports = { register };
