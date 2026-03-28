'use strict';

(function () {
    const VALID_MODELS = {
        anthropic: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-haiku-4-5-20251001'],
        openai:    ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini'],
    };

    async function mount(container) {
        container.innerHTML = _html();
        _bindAll();
        await _loadSettings();
    }

    function _html() {
        const anthropicModelOpts = VALID_MODELS.anthropic.map(m =>
            `<option value="${m}">${m}</option>`).join('');
        const openaiModelOpts = VALID_MODELS.openai.map(m =>
            `<option value="${m}">${m}</option>`).join('');

        return `
        <div class="settings-layout">
          <div class="settings-inner">

            <h2 class="settings-title">Settings</h2>

            <!-- AI Provider -->
            <section class="settings-section">
              <h3 class="settings-section-title">AI Provider</h3>

              <div class="field">
                <label class="field-label" for="provider-select">Active provider</label>
                <select id="provider-select" class="field-select select-provider">
                  <option value="">— Select a provider —</option>
                  <option value="anthropic">Anthropic (Claude)</option>
                  <option value="openai">OpenAI (GPT)</option>
                </select>
                <div class="field-hint">Determines which provider is used for generation.</div>
              </div>
            </section>

            <!-- API Keys -->
            <section class="settings-section">
              <h3 class="settings-section-title">API Keys</h3>

              <!-- Anthropic key -->
              <div class="field">
                <label class="field-label">Anthropic API Key</label>
                <div class="key-row">
                  <div class="key-input-wrap" id="anthropic-key-wrap">
                    <div id="anthropic-key-mask" class="key-mask hidden">
                      <span class="font-mono">sk-ant-••••••••</span>
                    </div>
                    <input id="anthropic-key-input" class="field-input" type="password"
                      placeholder="sk-ant-…"
                      autocomplete="off" spellcheck="false">
                  </div>
                  <button id="btn-anthropic-toggle" class="btn btn-ghost btn-sm" title="Show/hide">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-15">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                  </button>
                  <button id="btn-anthropic-save"  class="btn btn-primary btn-sm">Save</button>
                  <button id="btn-anthropic-test"  class="btn btn-ghost btn-sm hidden">Test</button>
                  <button id="btn-anthropic-clear" class="btn btn-danger btn-sm hidden">Clear</button>
                </div>
                <div id="anthropic-test-result" class="key-test-result hidden"></div>
              </div>

              <!-- OpenAI key -->
              <div class="field">
                <label class="field-label">OpenAI API Key</label>
                <div class="key-row">
                  <div class="key-input-wrap" id="openai-key-wrap">
                    <div id="openai-key-mask" class="key-mask hidden">
                      <span class="font-mono">sk-••••••••</span>
                    </div>
                    <input id="openai-key-input" class="field-input" type="password"
                      placeholder="sk-…"
                      autocomplete="off" spellcheck="false">
                  </div>
                  <button id="btn-openai-toggle" class="btn btn-ghost btn-sm" title="Show/hide">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-15">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                  </button>
                  <button id="btn-openai-save"  class="btn btn-primary btn-sm">Save</button>
                  <button id="btn-openai-test"  class="btn btn-ghost btn-sm hidden">Test</button>
                  <button id="btn-openai-clear" class="btn btn-danger btn-sm hidden">Clear</button>
                </div>
                <div id="openai-test-result" class="key-test-result hidden"></div>
              </div>

              <div class="field-hint">Keys are encrypted and stored locally. They never leave this machine.</div>
            </section>

            <!-- Model Selection -->
            <section class="settings-section">
              <h3 class="settings-section-title">Model Selection</h3>

              <div class="field">
                <label class="field-label" for="anthropic-model">Anthropic model</label>
                <select id="anthropic-model" class="field-select">
                  ${anthropicModelOpts}
                </select>
              </div>

              <div class="field mt-4">
                <label class="field-label" for="openai-model">OpenAI model</label>
                <select id="openai-model" class="field-select">
                  ${openaiModelOpts}
                </select>
              </div>

              <div class="field mt-4">
                <label class="field-label" for="max-tokens">Max tokens</label>
                <input id="max-tokens" type="number"
                  min="1024" max="32768" step="256" value="8192" class="field-input field-input-md">
                <div class="field-hint">Range: 1024 – 32768</div>
              </div>
            </section>

            <!-- Builder Defaults -->
            <section class="settings-section">
              <h3 class="settings-section-title">Builder Defaults</h3>

              <div class="field">
                <label class="field-label" for="default-section-count">Default section count</label>
                <input id="default-section-count" class="field-input field-input-sm" type="number"
                  min="2" max="10" value="5">
                <div class="field-hint">Number of specialist sections in new Builder skills (2–10)</div>
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

            <!-- Appearance -->
            <section class="settings-section">
              <h3 class="settings-section-title">Appearance</h3>
              <div class="toggle-row">
                <div class="toggle-info">
                  <div class="toggle-label">Light mode</div>
                  <div class="toggle-desc text-muted text-sm">
                    Switch to a light colour scheme.
                  </div>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" id="dark-mode-toggle">
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

            <!-- Updates -->
            <section class="settings-section" id="update-section" style="display:none">
              <h3 class="settings-section-title">Updates</h3>
              <div id="update-status-row" class="history-stats-row">
                <span class="text-muted text-sm" id="update-status-msg"></span>
                <button id="btn-install-update" class="btn btn-primary btn-sm hidden">Install &amp; Restart</button>
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
            // ... populate all fields
            if (s.provider)         { const el = document.getElementById('provider-select'); if (el) el.value = s.provider; }
            if (s.outputFolder)     { const el = document.getElementById('output-folder'); if (el) el.value = s.outputFolder; }
            const saveModeEl = document.querySelector(`input[name="save-mode"][value="${s.saveMode}"]`);
            if (saveModeEl) {
                saveModeEl.checked = true;
            } else {
                const firstRadio = document.querySelector('input[name="save-mode"]');
                if (firstRadio) firstRadio.checked = true;
            }
            const fwEl = document.getElementById('default-framework');
            if (fwEl && s.defaultFramework) fwEl.value = s.defaultFramework;
            const privEl = document.getElementById('privacy-toggle');
            if (privEl) privEl.checked = !!s.privacyMode;
            const antModelEl = document.getElementById('anthropic-model');
            if (antModelEl && s.anthropicModel) antModelEl.value = s.anthropicModel;
            const oaiModelEl = document.getElementById('openai-model');
            if (oaiModelEl && s.openaiModel) oaiModelEl.value = s.openaiModel;
            const maxTokEl = document.getElementById('max-tokens');
            if (maxTokEl && s.maxTokens) maxTokEl.value = s.maxTokens;
            const secCountEl = document.getElementById('default-section-count');
            if (secCountEl && s.defaultSectionCount) secCountEl.value = s.defaultSectionCount;
            const darkModeEl = document.getElementById('dark-mode-toggle');
            if (darkModeEl) darkModeEl.checked = !!s.darkMode;
        } catch { /* use defaults */ }

        // Check per-provider key status
        for (const prov of ['anthropic', 'openai']) {
            try {
                const hasKey = await window.skillforge.hasApiKey(prov);
                if (hasKey) _showKeyMask(prov, true);
            } catch {}
        }

        try {
            const n = await window.skillforge.historyCount();
            const el = document.getElementById('hist-count');
            if (el) el.textContent = n;
        } catch {}
    }

    function _showKeyMask(provider, set) {
        const mask     = document.getElementById(`${provider}-key-mask`);
        const input    = document.getElementById(`${provider}-key-input`);
        const saveBtn  = document.getElementById(`btn-${provider}-save`);
        const testBtn  = document.getElementById(`btn-${provider}-test`);
        const clearBtn = document.getElementById(`btn-${provider}-clear`);
        if (!input || !mask) return;
        if (set) {
            mask.classList.remove('hidden');
            input.classList.add('hidden');
            saveBtn?.classList.add('hidden');
            testBtn?.classList.remove('hidden');
            clearBtn?.classList.remove('hidden');
        } else {
            mask.classList.add('hidden');
            input.classList.remove('hidden');
            input.value = '';
            input.type  = 'password';
            saveBtn?.classList.remove('hidden');
            testBtn?.classList.add('hidden');
            clearBtn?.classList.add('hidden');
            // Hide any stale test result
            const resultEl = document.getElementById(`${provider}-test-result`);
            if (resultEl) { resultEl.classList.add('hidden'); resultEl.textContent = ''; }
        }
    }

    function _bindAll() {
        _bindKeyField('anthropic');
        _bindKeyField('openai');
        _bindFolderPicker();
        _bindPrivacyToggle();
        _bindSaveButton();
        _bindClearHistory();
        _bindUpdateEvents();
    }

    function _bindKeyField(provider) {
        const input     = document.getElementById(`${provider}-key-input`);
        const toggleBtn = document.getElementById(`btn-${provider}-toggle`);
        const saveBtn   = document.getElementById(`btn-${provider}-save`);
        const testBtn   = document.getElementById(`btn-${provider}-test`);
        const clearBtn  = document.getElementById(`btn-${provider}-clear`);
        let showKey  = false;
        let _saving  = false;
        let _testing = false;

        toggleBtn?.addEventListener('click', () => {
            showKey = !showKey;
            const mask = document.getElementById(`${provider}-key-mask`);
            const isSet = !mask?.classList.contains('hidden') || input?.classList.contains('hidden');
            if (isSet && mask) {
                mask.classList.toggle('hidden', showKey);
                input?.classList.toggle('hidden', !showKey);
            } else if (input) {
                input.type = showKey ? 'text' : 'password';
            }
        });

        saveBtn?.addEventListener('click', async () => {
            if (_saving) return;
            const val = input?.value.trim();
            if (!val) { Toast.show('Paste your API key first', 'warning'); return; }
            _saving = true;
            if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }
            try {
                const result = await window.skillforge.setApiKey(provider, val);
                if (result?.error) {
                    Toast.show(`Failed to save key: ${result.error}`, 'error');
                    return;
                }
                _showKeyMask(provider, true);
                showKey = false;
                Toast.show(`${provider === 'anthropic' ? 'Anthropic' : 'OpenAI'} API key saved`, 'success');
            } catch {
                Toast.show('Failed to save key', 'error');
            } finally {
                _saving = false;
                if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
            }
        });

        testBtn?.addEventListener('click', async () => {
            if (_testing) return;
            _testing = true;
            if (testBtn) { testBtn.disabled = true; testBtn.textContent = 'Testing…'; }
            const resultEl = document.getElementById(`${provider}-test-result`);
            if (resultEl) { resultEl.className = 'key-test-result'; resultEl.textContent = ''; }
            try {
                const result = await window.skillforge.testApiKey(provider);
                if (resultEl) {
                    resultEl.classList.remove('hidden');
                    if (result?.ok) {
                        resultEl.classList.add('key-test-ok');
                        resultEl.textContent = '✓ Connection successful';
                    } else {
                        resultEl.classList.add('key-test-fail');
                        const msgs = { api_401: 'Key rejected (401)', api_429: 'Rate limited (429)', api_5xx: 'Server error', timeout: 'Timed out', network_error: 'Network error', no_key: 'No key stored' };
                        resultEl.textContent = '✗ ' + (msgs[result?.error] ?? result?.error ?? 'Unknown error');
                    }
                    setTimeout(() => { resultEl.classList.add('hidden'); resultEl.textContent = ''; }, 5000);
                }
            } catch {
                if (resultEl) { resultEl.classList.remove('hidden'); resultEl.classList.add('key-test-fail'); resultEl.textContent = '✗ Test failed'; }
            } finally {
                _testing = false;
                if (testBtn) { testBtn.disabled = false; testBtn.textContent = 'Test'; }
            }
        });

        clearBtn?.addEventListener('click', async () => {
            try {
                await window.skillforge.clearApiKey(provider);
                _showKeyMask(provider, false);
                showKey = false;
                Toast.show(`${provider === 'anthropic' ? 'Anthropic' : 'OpenAI'} API key cleared`, 'info');
            } catch {
                Toast.show('Failed to clear key', 'error');
            }
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
            window.HistoryView?.setPrivacyMode?.(active);
            if (active) {
                Toast.show('Privacy mode enabled — history will not be recorded', 'warning');
            } else {
                Toast.show('Privacy mode disabled', 'info');
            }
        });
    }

    function _bindSaveButton() {
        const btn = document.getElementById('btn-settings-save');
        let _saving = false;

        btn?.addEventListener('click', async () => {
            if (_saving) return;
            _saving = true;
            if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

            const provider          = document.getElementById('provider-select')?.value          ?? '';
            const folder            = document.getElementById('output-folder')?.value            ?? '';
            const saveMode          = document.querySelector('input[name="save-mode"]:checked')?.value ?? 'package';
            const fw                = document.getElementById('default-framework')?.value        ?? 'claude';
            const privacy           = document.getElementById('privacy-toggle')?.checked         ?? false;
            const darkMode          = document.getElementById('dark-mode-toggle')?.checked       ?? false;
            const anthropicModel    = document.getElementById('anthropic-model')?.value          ?? 'claude-sonnet-4-20250514';
            const openaiModel       = document.getElementById('openai-model')?.value             ?? 'gpt-4o';
            const maxTokens         = parseInt(document.getElementById('max-tokens')?.value)     || 8192;
            const defaultSectionCount = parseInt(document.getElementById('default-section-count')?.value) || 5;

            try {
                await window.skillforge.saveSettings({
                    provider, outputFolder: folder, saveMode,
                    defaultFramework: fw, privacyMode: privacy, darkMode,
                    anthropicModel, openaiModel, maxTokens, defaultSectionCount,
                });
                // Propagate to app state
                if (window.App?.state?.settings) {
                    Object.assign(window.App.state.settings, {
                        provider, outputFolder: folder, saveMode,
                        defaultFramework: fw, privacyMode: privacy, darkMode,
                        anthropicModel, openaiModel, maxTokens, defaultSectionCount,
                    });
                }
                // Apply dark mode immediately
                document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
                Toast.show('Settings saved', 'success');
                const msg = document.getElementById('settings-saved-msg');
                if (msg) {
                    msg.classList.remove('hidden');
                    setTimeout(() => msg.classList.add('hidden'), 2000);
                }
            } catch { Toast.show('Failed to save settings', 'error'); }
            finally {
                _saving = false;
                if (btn) { btn.disabled = false; btn.textContent = 'Save settings'; }
            }
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

    function _bindUpdateEvents() {
        if (!window.skillforge.onUpdateAvailable) return;

        window.skillforge.onUpdateAvailable((info) => {
            const section = document.getElementById('update-section');
            const msg     = document.getElementById('update-status-msg');
            if (section) section.style.display = '';
            if (msg) msg.textContent = `Update v${info.version} downloading…`;
            Toast.show(`SkillForge v${info.version} is downloading…`, 'info');
        });

        window.skillforge.onUpdateDownloaded((info) => {
            const section   = document.getElementById('update-section');
            const msg       = document.getElementById('update-status-msg');
            const installBtn = document.getElementById('btn-install-update');
            if (section)    section.style.display = '';
            if (msg)        msg.textContent = `v${info.version} ready to install`;
            if (installBtn) installBtn.classList.remove('hidden');
            Toast.show(`SkillForge v${info.version} ready — click Install &amp; Restart in Settings`, 'success');
        });

        document.getElementById('btn-install-update')?.addEventListener('click', async () => {
            await window.skillforge.installUpdate();
        });
    }

    window.SettingsView = { mount };
})();
