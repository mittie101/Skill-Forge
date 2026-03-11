'use strict';

const { ipcMain } = require('electron');
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
}

module.exports = { register };
