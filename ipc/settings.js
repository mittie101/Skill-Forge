'use strict';

const { ipcMain, dialog, BrowserWindow } = require('electron');
const { getAllSettings, setSetting } = require('../main/db/settings');
const { getDefaultOutputDir } = require('../main/config');

function register() {
    ipcMain.handle('load-settings', () => {
        const all = getAllSettings();
        return {
            provider:         all.provider           ?? '',
            outputFolder:     all.output_folder      ?? getDefaultOutputDir(),
            saveMode:         all.save_mode          ?? 'package',
            defaultFramework: all.default_framework  ?? 'claude',
            privacyMode:      all.privacy_mode === 'true',
        };
    });

    ipcMain.handle('save-settings', (_e, settings) => {
        const map = {
            provider:         'provider',
            outputFolder:     'output_folder',
            saveMode:         'save_mode',
            defaultFramework: 'default_framework',
            privacyMode:      'privacy_mode',
        };
        for (const [jsKey, dbKey] of Object.entries(map)) {
            if (settings[jsKey] !== undefined) {
                setSetting(dbKey, String(settings[jsKey]));
            }
        }
        return { ok: true };
    });

    ipcMain.handle('pick-folder', async (e) => {
        const win = BrowserWindow.fromWebContents(e.sender);
        const result = await dialog.showOpenDialog(win, {
            properties: ['openDirectory', 'createDirectory'],
        });
        if (result.canceled || !result.filePaths.length) return null;
        return result.filePaths[0];
    });
}

module.exports = { register };
