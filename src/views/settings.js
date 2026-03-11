'use strict';

(function () {
    let _keySet  = false;
    let _showKey = false;

    async function mount(container) {
        container.innerHTML = _html();
        _bindAll();
        await _loadSettings();
    }

    function _html() {
        return `
        <div class="settings-layout">
          <div class="settings-inner">

            <h2 class="settings-title">Settings</h2>

            <!-- AI Provider -->
            <section class="settings-section">
              <h3 class="settings-section-title">AI Provider</h3>

              <div class="field">
                <label class="field-label" for="provider-select">Provider</label>
                <select id="provider-select" class="field-select select-provider">
                  <option value="">— Select a provider —</option>
                  <option value="anthropic">Anthropic (Claude)</option>
                  <option value="openai">OpenAI (GPT-4o)</option>
                </select>
              </div>

              <div class="field mt-4">
                <label class="field-label" for="api-key-input">API Key</label>
                <div class="key-row">
                  <div class="key-input-wrap" id="key-input-wrap">
                    <div id="key-mask" class="key-mask hidden">
                      <span id="key-mask-text" class="font-mono">••••••••</span>
                      <span id="provider-badge" class="badge badge-yellow ml-2">Unknown</span>
                    </div>
                    <input id="api-key-input" class="field-input" type="password"
                      placeholder="Paste your API key here…"
                      autocomplete="off" spellcheck="false">
                  </div>
                  <button id="btn-key-toggle" class="btn btn-ghost btn-sm" title="Show/hide input">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-15">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                  </button>
                  <button id="btn-key-save"  class="btn btn-primary btn-sm">Save key</button>
                  <button id="btn-key-clear" class="btn btn-danger btn-sm hidden">Clear</button>
                </div>
                <div class="field-hint">Your key is encrypted and stored locally. It never leaves this machine.</div>
              </div>
            </section>

            <!-- Output -->
            <section class="settings-section">
              <h3 class="settings-section-title">Output</h3>

              <div class="field">
                <label class="field-label">Default output folder</label>
                <div class="flex gap-8 items-center">
                  <input id="output-folder" class="field-input flex-1 cursor-default" type="text"
                    placeholder="~/Documents/skills" readonly>
                  <button id="btn-folder-pick" class="btn btn-secondary btn-sm">Browse…</button>
                </div>
              </div>

              <div class="field mt-4">
                <label class="field-label">Default save mode</label>
                <div class="radio-group">
                  <label class="radio-label">
                    <input type="radio" name="save-mode" value="package" checked>
                    Package — <span class="text-muted">skill-name/SKILL.md</span>
                  </label>
                  <label class="radio-label">
                    <input type="radio" name="save-mode" value="flat">
                    Flat — <span class="text-muted">skill-name.md</span>
                  </label>
                </div>
              </div>

              <div class="field mt-4">
                <label class="field-label">Default framework</label>
                <select id="default-framework" class="field-select select-framework">
                  <option value="claude">Claude</option>
                  <option value="chatgpt">ChatGPT</option>
                  <option value="langchain">LangChain</option>
                </select>
              </div>
            </section>

            <!-- Privacy -->
            <section class="settings-section">
              <h3 class="settings-section-title">Privacy</h3>
              <div class="toggle-row">
                <div class="toggle-info">
                  <div class="toggle-label">Privacy mode</div>
                  <div class="toggle-desc text-muted text-sm">
                    History and generation data will not be saved to disk.
                  </div>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" id="privacy-toggle">
                  <span class="toggle-track"></span>
                </label>
              </div>
            </section>

            <!-- History -->
            <section class="settings-section">
              <h3 class="settings-section-title">History</h3>
              <div class="history-stats-row">
                <span class="text-muted text-sm">
                  <span id="hist-count">0</span> skills stored (cap: 100)
                </span>
                <button id="btn-clear-history" class="btn btn-danger btn-sm">Clear all history</button>
              </div>
            </section>

            <div class="settings-save-row">
              <button id="btn-settings-save" class="btn btn-primary">Save settings</button>
              <span id="settings-saved-msg" class="text-muted text-sm hidden">Settings saved.</span>
            </div>

          </div>
        </div>`;
    }

    async function _loadSettings() {
        try {
            const s = await window.skillforge.loadSettings();
            const provEl = document.getElementById('provider-select');
            if (provEl && s.provider) provEl.value = s.provider;

            const folderEl = document.getElementById('output-folder');
            if (folderEl && s.outputFolder) folderEl.value = s.outputFolder;

            const saveModeEl = document.querySelector(`input[name="save-mode"][value="${s.saveMode}"]`);
            if (saveModeEl) saveModeEl.checked = true;

            const fwEl = document.getElementById('default-framework');
            if (fwEl && s.defaultFramework) fwEl.value = s.defaultFramework;

            const privEl = document.getElementById('privacy-toggle');
            if (privEl) privEl.checked = !!s.privacyMode;
        } catch (err) {
            console.warn('[Settings] Load failed:', err);
        }

        try {
            const hasKey = await window.skillforge.hasApiKey();
            if (hasKey) _showKeyMask(true);
        } catch {}

        try {
            const n = await window.skillforge.historyCount();
            const el = document.getElementById('hist-count');
            if (el) el.textContent = n;
        } catch {}
    }

    function _showKeyMask(set) {
        _keySet = set;
        const input    = document.getElementById('api-key-input');
        const mask     = document.getElementById('key-mask');
        const saveBtn  = document.getElementById('btn-key-save');
        const clearBtn = document.getElementById('btn-key-clear');
        if (!input || !mask) return;
        if (set) {
            mask.classList.remove('hidden');
            input.classList.add('hidden');
            saveBtn?.classList.add('hidden');
            clearBtn?.classList.remove('hidden');
        } else {
            mask.classList.add('hidden');
            input.classList.remove('hidden');
            input.value = '';
            input.type  = 'password';
            saveBtn?.classList.remove('hidden');
            clearBtn?.classList.add('hidden');
        }
    }

    function _bindAll() {
        _bindKeyField();
        _bindFolderPicker();
        _bindPrivacyToggle();
        _bindSaveButton();
        _bindClearHistory();
    }

    function _bindKeyField() {
        const input     = document.getElementById('api-key-input');
        const toggleBtn = document.getElementById('btn-key-toggle');
        const saveBtn   = document.getElementById('btn-key-save');
        const clearBtn  = document.getElementById('btn-key-clear');

        toggleBtn?.addEventListener('click', () => {
            _showKey = !_showKey;
            if (_keySet) {
                document.getElementById('key-mask')?.classList.toggle('hidden', _showKey);
                input?.classList.toggle('hidden', !_showKey);
            } else {
                if (input) input.type = _showKey ? 'text' : 'password';
            }
        });

        saveBtn?.addEventListener('click', async () => {
            const val = input?.value.trim();
            if (!val) { Toast.show('Paste your API key first', 'warning'); return; }
            try {
                const result = await window.skillforge.setApiKey(val);
                if (result?.error) { Toast.show('Failed to save key: ' + result.error, 'error'); return; }

                const badge    = document.getElementById('provider-badge');
                const maskText = document.getElementById('key-mask-text');
                if (val.startsWith('sk-ant-')) {
                    if (badge)    { badge.textContent = 'Anthropic'; badge.className = 'badge badge-green'; }
                    if (maskText) maskText.textContent = 'sk-ant-••••••••';
                } else if (val.startsWith('sk-')) {
                    if (badge)    { badge.textContent = 'OpenAI'; badge.className = 'badge badge-blue'; }
                    if (maskText) maskText.textContent = 'sk-••••••••';
                } else {
                    if (badge)    { badge.textContent = 'Unknown'; badge.className = 'badge badge-yellow'; }
                    if (maskText) maskText.textContent = '••••••••';
                }
                _showKeyMask(true);
                _showKey = false;
                Toast.show('API key saved', 'success');
            } catch { Toast.show('Failed to save key', 'error'); }
        });

        clearBtn?.addEventListener('click', async () => {
            try {
                await window.skillforge.clearApiKey();
                _showKeyMask(false);
                _showKey = false;
                Toast.show('API key cleared', 'info');
            } catch { Toast.show('Failed to clear key', 'error'); }
        });
    }

    function _bindFolderPicker() {
        document.getElementById('btn-folder-pick')?.addEventListener('click', async () => {
            try {
                const folder = await window.skillforge.pickFolder();
                if (folder) {
                    const el = document.getElementById('output-folder');
                    if (el) el.value = folder;
                }
            } catch { Toast.show('Could not open folder picker', 'error'); }
        });
    }

    function _bindPrivacyToggle() {
        document.getElementById('privacy-toggle')?.addEventListener('change', e => {
            const active = e.target.checked;
            // Immediately reflect in history view without requiring a save first
            window.HistoryView?.setPrivacyMode?.(active);
            if (active) {
                Toast.show('Privacy mode enabled — history will not be recorded', 'warning');
            } else {
                Toast.show('Privacy mode disabled', 'info');
            }
        });
    }

    function _bindSaveButton() {
        document.getElementById('btn-settings-save')?.addEventListener('click', async () => {
            const provider  = document.getElementById('provider-select')?.value          ?? '';
            const folder    = document.getElementById('output-folder')?.value            ?? '';
            const saveMode  = document.querySelector('input[name="save-mode"]:checked')?.value ?? 'package';
            const fw        = document.getElementById('default-framework')?.value        ?? 'claude';
            const privacy   = document.getElementById('privacy-toggle')?.checked         ?? false;
            try {
                await window.skillforge.saveSettings({
                    provider, outputFolder: folder, saveMode,
                    defaultFramework: fw, privacyMode: privacy,
                });
                // Propagate to app state so generator picks up new defaults
                if (window.App?.state?.settings) {
                    Object.assign(window.App.state.settings, {
                        provider, outputFolder: folder, saveMode,
                        defaultFramework: fw, privacyMode: privacy,
                    });
                }
                Toast.show('Settings saved', 'success');
                const msg = document.getElementById('settings-saved-msg');
                if (msg) {
                    msg.classList.remove('hidden');
                    setTimeout(() => msg.classList.add('hidden'), 2000);
                }
            } catch { Toast.show('Failed to save settings', 'error'); }
        });
    }

    function _bindClearHistory() {
        document.getElementById('btn-clear-history')?.addEventListener('click', async () => {
            if (!window.confirm('Clear all history? This cannot be undone.')) return;
            try {
                await window.skillforge.clearAllHistory();
                const el = document.getElementById('hist-count');
                if (el) el.textContent = 0;
                Toast.show('History cleared', 'success');
            } catch { Toast.show('Failed to clear history', 'error'); }
        });
    }

    window.SettingsView = { mount };
})();
