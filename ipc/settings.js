'use strict';

const { ipcMain, dialog, BrowserWindow } = require('electron');
const { getAllSettings, setSetting } = require('../main/db/settings');
const { getDefaultOutputDir, DEFAULT_SECTION_COUNT, MAX_TOKENS_DEFAULT,
        VALID_PROVIDERS, VALID_MODELS } = require('../main/config');

function register() {
    ipcMain.handle('load-settings', () => {
        const all = getAllSettings();
        return {
            provider:             all.provider              ?? '',
            outputFolder:         all.output_folder         ?? getDefaultOutputDir(),
            saveMode:             all.save_mode             ?? 'package',
            defaultFramework:     all.default_framework     ?? 'claude',
            privacyMode:          all.privacy_mode === 'true',
            darkMode:             all.dark_mode !== 'false',
            anthropicModel:       all.anthropic_model       ?? 'claude-sonnet-4-20250514',
            openaiModel:          all.openai_model          ?? 'gpt-4o',
            maxTokens:            parseInt(all.max_tokens)  || MAX_TOKENS_DEFAULT,
            defaultSectionCount:  parseInt(all.default_section_count) || DEFAULT_SECTION_COUNT,
        };
    });

    ipcMain.handle('save-settings', (_e, settings) => {
        // Validate provider
        if (settings.provider !== undefined) {
            if (VALID_PROVIDERS.includes(settings.provider)) {
                setSetting('provider', settings.provider);
            }
            // invalid provider — skip silently
        }

        // Validate outputFolder — reject if contains null bytes
        if (settings.outputFolder !== undefined) {
            const folder = String(settings.outputFolder);
            if (!folder.includes('\0')) {
                setSetting('output_folder', folder);
            }
        }

        // Pass-through fields (no domain-specific validation needed)
        const passThrough = {
            saveMode:         'save_mode',
            defaultFramework: 'default_framework',
            privacyMode:      'privacy_mode',
            darkMode:         'dark_mode',
        };
        for (const [jsKey, dbKey] of Object.entries(passThrough)) {
            if (settings[jsKey] !== undefined) {
                setSetting(dbKey, String(settings[jsKey]));
            }
        }

        // Validate anthropicModel
        if (settings.anthropicModel !== undefined) {
            if (VALID_MODELS.anthropic.includes(settings.anthropicModel)) {
                setSetting('anthropic_model', settings.anthropicModel);
            }
        }

        // Validate openaiModel
        if (settings.openaiModel !== undefined) {
            if (VALID_MODELS.openai.includes(settings.openaiModel)) {
                setSetting('openai_model', settings.openaiModel);
            }
        }

        // Validate maxTokens — clamp to [1024, 32768]
        if (settings.maxTokens !== undefined) {
            const n = parseInt(settings.maxTokens, 10);
            if (!isNaN(n)) {
                setSetting('max_tokens', String(Math.max(1024, Math.min(32768, n))));
            }
        }

        // Validate defaultSectionCount — clamp to [2, 10]
        if (settings.defaultSectionCount !== undefined) {
            const n = parseInt(settings.defaultSectionCount, 10);
            if (!isNaN(n)) {
                setSetting('default_section_count', String(Math.max(2, Math.min(10, n))));
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
