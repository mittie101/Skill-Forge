'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('skillforge', {
    // ── API Keys (per-provider) ──
    setApiKey:    (provider, key) => ipcRenderer.invoke('set-api-key', provider, key),
    hasApiKey:    (provider)      => ipcRenderer.invoke('has-api-key', provider),
    getProvider:  ()              => ipcRenderer.invoke('get-provider'),
    clearApiKey:  (provider)      => ipcRenderer.invoke('clear-api-key', provider),
    testApiKey:   (provider)      => ipcRenderer.invoke('test-api-key', provider),

    // ── Generator (SkillForge JSON pipeline) ──
    generate:       (formData) => ipcRenderer.invoke('generate', formData),
    stopGeneration: ()         => ipcRenderer.invoke('stop-generation'),
    onStreamChunk:  (cb) => {
        const h = (_e, c) => cb(c);
        ipcRenderer.on('stream-chunk', h);
        return () => ipcRenderer.removeListener('stream-chunk', h);
    },
    onStreamEnd: (cb) => {
        const h = (_e, r) => cb(r);
        ipcRenderer.on('stream-end', h);
        return () => ipcRenderer.removeListener('stream-end', h);
    },
    onTestStreamChunk: (cb) => {
        const h = (_e, c) => cb(c);
        ipcRenderer.on('test-stream-chunk', h);
        return () => ipcRenderer.removeListener('test-stream-chunk', h);
    },
    onTestStreamEnd: (cb) => {
        const h = (_e, r) => cb(r);
        ipcRenderer.on('test-stream-end', h);
        return () => ipcRenderer.removeListener('test-stream-end', h);
    },

    // ── Builder (SkillCraft section pipeline) ──
    buildGenerate:   (params) => ipcRenderer.invoke('build-generate', params),
    buildStop:       ()       => ipcRenderer.invoke('build-stop'),
    suggestSections: (keyword, description, sectionCount) =>
                        ipcRenderer.invoke('suggest-sections', { keyword, description, sectionCount }),
    onBuildChunk: (cb) => {
        const h = (_e, c) => cb(c);
        ipcRenderer.on('build-chunk', h);
        return () => ipcRenderer.removeListener('build-chunk', h);
    },
    onBuildEnd: (cb) => {
        const h = (_e, r) => cb(r);
        ipcRenderer.on('build-end', h);
        return () => ipcRenderer.removeListener('build-end', h);
    },

    // ── Review & Fix (Skill Reviewer) ──
    reviewSkill: (params) => ipcRenderer.invoke('review-skill', params),
    fixSkill:    (params) => ipcRenderer.invoke('fix-skill', params),
    reviewStop:  ()       => ipcRenderer.invoke('review-stop'),
    onFixChunk: (cb) => {
        const h = (_e, c) => cb(c);
        ipcRenderer.on('fix-chunk', h);
        return () => ipcRenderer.removeListener('fix-chunk', h);
    },

    // ── Install (SkillConverter) ──
    installOpenFile:       ()         => ipcRenderer.invoke('install-open-file'),
    installLoadFile:       (filePath) => ipcRenderer.invoke('install-load-file', filePath),
    installSkill:          (params)   => ipcRenderer.invoke('install-skill', params),
    installSkillOverwrite: (params)   => ipcRenderer.invoke('install-skill-overwrite', params),
    installOpenFolder:     (params)   => ipcRenderer.invoke('install-open-folder', params),
    installPreviewPath:    (params)   => ipcRenderer.invoke('install-preview-path', params),
    listInstalledSkills:   ()         => ipcRenderer.invoke('list-installed-skills'),

    // ── History ──
    listHistory:     (opts)             => ipcRenderer.invoke('list-history', opts),
    searchHistory:   (query, framework) => ipcRenderer.invoke('search-history', { query, framework }),
    deleteHistory:   (id)               => ipcRenderer.invoke('delete-history', id),
    reopenHistory:   (id)               => ipcRenderer.invoke('reopen-history', id),
    clearAllHistory: ()                 => ipcRenderer.invoke('clear-all-history'),
    historyCount:    ()                 => ipcRenderer.invoke('history-count'),
    exportHistory:   ()                 => ipcRenderer.invoke('export-history'),

    // ── Settings ──
    loadSettings: ()         => ipcRenderer.invoke('load-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
    pickFolder:   ()         => ipcRenderer.invoke('pick-folder'),

    // ── File ──
    saveSkill:          (data) => ipcRenderer.invoke('save-skill', data),
    saveSkillOverwrite: (data) => ipcRenderer.invoke('save-skill-overwrite', data),
    saveSkillAsCopy:    (data) => ipcRenderer.invoke('save-skill-as-copy', data),
    importSkill:        ()     => ipcRenderer.invoke('import-skill'),
    openInEditor:       (fp)   => ipcRenderer.invoke('open-in-editor', fp),

    // ── Presets ──
    getPresets: () => ipcRenderer.invoke('get-presets'),

    // ── OpenClaw Converter ──
    openclawOpenFile:      ()       => ipcRenderer.invoke('openclaw-open-file'),
    openclawLoadFile:      (fp)     => ipcRenderer.invoke('openclaw-load-file', fp),
    openclawConvert:       (params) => ipcRenderer.invoke('openclaw-convert', params),
    openclawStop:          ()       => ipcRenderer.invoke('openclaw-stop'),
    openclawSave:          (params) => ipcRenderer.invoke('openclaw-save', params),
    openclawSaveOverwrite: (params) => ipcRenderer.invoke('openclaw-save-overwrite', params),

    // ── Auto-updater ──
    installUpdate: () => ipcRenderer.invoke('install-update'),
    onUpdateAvailable: (cb) => {
        const h = (_e, info) => cb(info);
        ipcRenderer.on('update-available', h);
        return () => ipcRenderer.removeListener('update-available', h);
    },
    onUpdateError: (cb) => {
        const h = (_e, info) => cb(info);
        ipcRenderer.on('update-error', h);
        return () => ipcRenderer.removeListener('update-error', h);
    },
    onUpdateDownloaded: (cb) => {
        const h = (_e, info) => cb(info);
        ipcRenderer.on('update-downloaded', h);
        return () => ipcRenderer.removeListener('update-downloaded', h);
    },
});
