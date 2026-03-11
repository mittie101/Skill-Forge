const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('skillforge', {
    // API Keys — one-way set only, no getter
    setApiKey:    (key) => ipcRenderer.invoke('set-api-key', key),
    hasApiKey:    ()    => ipcRenderer.invoke('has-api-key'),
    getProvider:  ()    => ipcRenderer.invoke('get-provider'),
    clearApiKey:  ()    => ipcRenderer.invoke('clear-api-key'),

    // Generation
    generate:       (formData) => ipcRenderer.invoke('generate', formData),
    stopGeneration: ()         => ipcRenderer.invoke('stop-generation'),

    // Streaming — returns unsubscribe fn
    onStreamChunk: (cb) => {
        const handler = (_event, chunk) => cb(chunk);
        ipcRenderer.on('stream-chunk', handler);
        return () => ipcRenderer.removeListener('stream-chunk', handler);
    },
    onStreamEnd: (cb) => {
        const handler = (_event, result) => cb(result);
        ipcRenderer.on('stream-end', handler);
        return () => ipcRenderer.removeListener('stream-end', handler);
    },

    // Test panel streaming — separate events, ephemeral only
    onTestStreamChunk: (cb) => {
        const handler = (_event, chunk) => cb(chunk);
        ipcRenderer.on('test-stream-chunk', handler);
        return () => ipcRenderer.removeListener('test-stream-chunk', handler);
    },
    onTestStreamEnd: (cb) => {
        const handler = (_event, result) => cb(result);
        ipcRenderer.on('test-stream-end', handler);
        return () => ipcRenderer.removeListener('test-stream-end', handler);
    },

    // History
    listHistory:     (opts)             => ipcRenderer.invoke('list-history', opts),
    searchHistory:   (query, framework) => ipcRenderer.invoke('search-history', { query, framework }),
    deleteHistory:   (id)               => ipcRenderer.invoke('delete-history', id),
    reopenHistory:   (id)               => ipcRenderer.invoke('reopen-history', id),
    clearAllHistory: ()                 => ipcRenderer.invoke('clear-all-history'),
    historyCount:    ()                 => ipcRenderer.invoke('history-count'),

    // Settings
    loadSettings: ()         => ipcRenderer.invoke('load-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
    pickFolder:   ()         => ipcRenderer.invoke('pick-folder'),

    // File operations
    saveSkill:          (data) => ipcRenderer.invoke('save-skill', data),
    saveSkillOverwrite: (data) => ipcRenderer.invoke('save-skill-overwrite', data),
    saveSkillAsCopy:    (data) => ipcRenderer.invoke('save-skill-as-copy', data),
    importSkill:        ()     => ipcRenderer.invoke('import-skill'),
    openInEditor:       (fp)   => ipcRenderer.invoke('open-in-editor', fp),

    // Presets
    getPresets: () => ipcRenderer.invoke('get-presets'),
});
