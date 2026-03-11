'use strict';

(function () {
    const CAPS = {
        SKILL_NAME: 80, WHEN_TO_USE: 1000, EXAMPLE_REQUEST: 200,
        EXAMPLE_MAX: 10, EXPECTED_INPUTS: 500, EXPECTED_OUTPUTS: 500, CONSTRAINTS: 1500,
    };

    // ── Module state ──
    let examples         = [];
    let activeFramework  = 'claude';
    let outputRawText    = '';
    let compiledMd       = null;
    let activeOutputTab  = 'raw';
    let saveMode         = 'package';
    let currentFilePath  = null;   // last successfully saved path
    let lastFormData     = null;   // for retry
    let presets          = [];
    let unsubChunk         = null;
    let unsubEnd           = null;
    let unsubTestChunk     = null;
    let unsubTestEnd       = null;
    let testResponseBuffer = '';
    let _lastPreviewText   = null;   // Marked.js render cache

    // ── Mount ──
    async function mount(container) {
        container.innerHTML = _html();
        _bindAll();

        // Restore defaults from App settings
        const s = window.App?.state?.settings ?? {};
        if (s.defaultFramework) _setFramework(s.defaultFramework, false);
        if (s.saveMode)         _setSaveMode(s.saveMode, false);

        // Load presets from main process
        try {
            presets = await window.skillforge.getPresets();
            _populatePresets();
        } catch (err) {
            console.warn('[Generator] Could not load presets:', err);
        }

        _updatePathPreview();
    }

    // ── HTML ──
    function _html() {
        return `
        <div class="gen-layout">

          <!-- LEFT: form panel -->
          <div class="gen-left">
            <div class="gen-left-inner">

              <div class="field">
                <div class="field-header">
                  <label class="field-label" for="skill-name">Skill Name</label>
                  <span class="char-counter" id="name-counter">0 / ${CAPS.SKILL_NAME}</span>
                </div>
                <input id="skill-name" class="field-input" type="text"
                  placeholder="e.g. Code Review Helper"
                  maxlength="${CAPS.SKILL_NAME}" autocomplete="off">
              </div>

              <div class="field">
                <label class="field-label">Framework</label>
                <div class="fw-tabs" role="tablist">
                  <button class="fw-tab active" data-fw="claude"    role="tab">Claude</button>
                  <button class="fw-tab"         data-fw="chatgpt"  role="tab">ChatGPT</button>
                  <button class="fw-tab"         data-fw="langchain" role="tab">LangChain</button>
                </div>
              </div>

              <div class="field">
                <div class="field-header">
                  <label class="field-label" for="when-to-use">When should this skill be used?</label>
                  <span class="char-counter" id="when-counter">0 / ${CAPS.WHEN_TO_USE}</span>
                </div>
                <textarea id="when-to-use" class="field-textarea" rows="4"
                  placeholder="Describe the situations when an AI should use this skill…"
                  maxlength="${CAPS.WHEN_TO_USE}"></textarea>
              </div>

              <div class="field">
                <div class="field-header">
                  <label class="field-label">Example requests</label>
                  <span class="char-counter" id="examples-counter">0 / ${CAPS.EXAMPLE_MAX}</span>
                </div>
                <div class="tag-input-wrap" id="tag-wrap">
                  <div class="tag-list" id="tag-list"></div>
                  <input id="example-input" class="tag-input" type="text"
                    placeholder="Type and press Enter to add…"
                    maxlength="${CAPS.EXAMPLE_REQUEST}">
                </div>
                <div class="field-hint">Press Enter or Tab to add · Backspace to remove last</div>
              </div>

              <div class="field">
                <div class="field-header">
                  <label class="field-label" for="expected-inputs">Expected inputs</label>
                  <span class="char-counter" id="inputs-counter">0 / ${CAPS.EXPECTED_INPUTS}</span>
                </div>
                <textarea id="expected-inputs" class="field-textarea" rows="2"
                  placeholder="What data or content will be passed to this skill?"
                  maxlength="${CAPS.EXPECTED_INPUTS}"></textarea>
              </div>

              <div class="field">
                <div class="field-header">
                  <label class="field-label" for="expected-outputs">Expected outputs</label>
                  <span class="char-counter" id="outputs-counter">0 / ${CAPS.EXPECTED_OUTPUTS}</span>
                </div>
                <textarea id="expected-outputs" class="field-textarea" rows="2"
                  placeholder="What should this skill produce?"
                  maxlength="${CAPS.EXPECTED_OUTPUTS}"></textarea>
              </div>

              <div class="field">
                <div class="field-header">
                  <label class="field-label" for="constraints">Constraints / hard rules</label>
                  <span class="char-counter" id="constraints-counter">0 / ${CAPS.CONSTRAINTS}</span>
                </div>
                <textarea id="constraints" class="field-textarea" rows="3"
                  placeholder="Rules the AI must always or never do…"
                  maxlength="${CAPS.CONSTRAINTS}"></textarea>
              </div>

              <div class="field">
                <label class="field-label" for="preset-select">Presets</label>
                <select id="preset-select" class="field-select">
                  <option value="">— Select a preset —</option>
                </select>
              </div>

              <div class="gen-actions">
                <button id="btn-generate" class="btn btn-primary">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-15">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                  Generate
                </button>
                <button id="btn-stop"  class="btn btn-secondary hidden">Stop</button>
                <button id="btn-retry" class="btn btn-secondary hidden">Retry</button>
                <button id="btn-import" class="btn btn-ghost" title="Import an existing .md file">Import .md</button>
                <button id="btn-clear"  class="btn btn-ghost" title="Clear form (Ctrl+N)">Clear</button>
              </div>

            </div>
          </div>

          <!-- RIGHT: output panel -->
          <div class="gen-right">

            <div class="output-tabs">
              <div class="tabs">
                <button class="tab-btn active" data-tab="raw">Raw</button>
                <button class="tab-btn"         data-tab="preview">Preview</button>
              </div>
              <div class="output-meta">
                <span id="token-estimate" class="token-estimate hidden"
                  title="Rough estimate based on character count (÷4). Actual usage may vary.">~0 tokens (estimate)</span>
                <button id="btn-copy" class="btn btn-ghost btn-sm hidden">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-13">
                    <rect x="9" y="9" width="13" height="13" rx="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  Copy
                </button>
              </div>
            </div>

            <!-- Banners -->
            <div id="banner-partial" class="banner banner-warning hidden banner-inset">
              Stream interrupted — partial output. Save is disabled.
            </div>
            <div id="banner-parse-error" class="banner banner-danger hidden banner-inset">
              Output could not be parsed. Try regenerating.
            </div>
            <div id="banner-no-provider" class="banner banner-info hidden banner-inset">
              Select a provider in Settings before generating.
            </div>
            <div id="banner-no-key"      class="banner banner-info hidden banner-inset">
              Add your API key in Settings before generating.
            </div>

            <!-- Output area -->
            <div class="output-area">
              <div id="output-tab-raw" class="output-tab-panel active">
                <pre id="output-raw" class="output-raw"><span class="output-placeholder">Generated skill will appear here…</span></pre>
              </div>
              <div id="output-tab-preview" class="output-tab-panel hidden">
                <div id="output-preview" class="output-preview"></div>
              </div>
            </div>

            <!-- Validation checklist -->
            <div class="checklist-panel">
              <div class="checklist-title">Validation</div>
              <div class="checklist" id="checklist">
                <div class="checklist-item pending" data-layer="1">
                  <svg class="checklist-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>
                  Form fields valid
                </div>
                <div class="checklist-item pending" data-layer="2">
                  <svg class="checklist-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>
                  JSON structure valid
                </div>
                <div class="checklist-item pending" data-layer="3">
                  <svg class="checklist-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>
                  Skill rendered
                </div>
                <div class="checklist-item pending" data-layer="4">
                  <svg class="checklist-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>
                  Framework markers present
                </div>
              </div>
            </div>

            <!-- Save area -->
            <div class="save-panel">
              <div class="save-mode-row">
                <span class="field-label">Save mode</span>
                <div class="save-mode-toggle">
                  <button class="mode-btn active" data-mode="package">
                    Package <span class="mode-hint">skill-name/SKILL.md</span>
                  </button>
                  <button class="mode-btn" data-mode="flat">
                    Flat <span class="mode-hint">skill-name.md</span>
                  </button>
                </div>
              </div>
              <div class="path-preview" id="path-preview">
                <span class="text-muted">~/Documents/skills/</span><span id="path-dynamic">skill-name/SKILL.md</span>
              </div>
              <div class="save-actions">
                <button id="btn-save" class="btn btn-primary" disabled>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-14">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                    <polyline points="17 21 17 13 7 13 7 21"/>
                    <polyline points="7 3 7 8 15 8"/>
                  </svg>
                  Save  <kbd>Ctrl+S</kbd>
                </button>
                <button id="btn-open-editor" class="btn btn-ghost btn-sm hidden" title="Open in default editor">Open</button>
              </div>
            </div>

            <!-- Test panel -->
            <details class="test-panel" id="test-panel">
              <summary class="test-panel-summary">Test panel</summary>
              <div class="test-panel-body">
                <div class="field">
                  <label class="field-label" for="test-input">Test message</label>
                  <textarea id="test-input" class="field-textarea" rows="2"
                    placeholder="Send a test message to try the skill…"></textarea>
                </div>
                <div class="flex gap-8 mt-2">
                  <button id="btn-test-send" class="btn btn-secondary btn-sm">Send</button>
                </div>
                <div id="test-response" class="test-response hidden"></div>
              </div>
            </details>

          </div>
        </div>

        <!-- EEXIST collision modal -->
        <div id="modal-overlay" class="modal-overlay hidden" role="dialog" aria-modal="true">
          <div class="modal">
            <div class="modal-title">File already exists</div>
            <div class="modal-body">
              <p id="modal-conflict-path" class="text-muted text-sm font-mono word-break-all"></p>
              <p class="mt-2">How would you like to proceed?</p>
            </div>
            <div class="modal-actions">
              <button id="modal-overwrite"  class="btn btn-danger">Overwrite</button>
              <button id="modal-save-copy"  class="btn btn-secondary">Save as copy</button>
              <button id="modal-cancel"     class="btn btn-ghost">Cancel</button>
            </div>
          </div>
        </div>
        `;
    }

    // ── Bind all interactions ──
    function _bindAll() {
        _bindCharCounters();
        _bindFrameworkTabs();
        _bindTagInput();
        _bindOutputTabs();
        _bindSaveMode();
        _bindPathPreview();
        _bindActionButtons();
        _bindModal();
    }

    // ── Char counters ──
    function _bindCharCounters() {
        const pairs = [
            ['skill-name',       'name-counter',        CAPS.SKILL_NAME],
            ['when-to-use',      'when-counter',        CAPS.WHEN_TO_USE],
            ['expected-inputs',  'inputs-counter',      CAPS.EXPECTED_INPUTS],
            ['expected-outputs', 'outputs-counter',     CAPS.EXPECTED_OUTPUTS],
            ['constraints',      'constraints-counter', CAPS.CONSTRAINTS],
        ];
        pairs.forEach(([id, counterId, cap]) => {
            const el      = document.getElementById(id);
            const counter = document.getElementById(counterId);
            if (!el || !counter) return;
            const update = () => {
                const len = el.value.length;
                counter.textContent = `${len} / ${cap}`;
                counter.className = 'char-counter' +
                    (len >= cap ? ' over' : len >= cap * 0.9 ? ' warn' : '');
            };
            el.addEventListener('input', update);
            if (id === 'skill-name') el.addEventListener('input', _updatePathPreview);
        });
    }

    // ── Framework tabs ──
    function _bindFrameworkTabs() {
        document.querySelectorAll('.fw-tab').forEach(btn => {
            btn.addEventListener('click', async () => {
                const fw = btn.dataset.fw;
                if (fw === activeFramework) return;

                // If generating, confirm stop first
                if (window.App?.state?.isGenerating) {
                    if (!window.confirm('A generation is in progress. Stop it and switch framework?')) return;
                    await window.skillforge.stopGeneration();
                }

                _setFramework(fw);
            });
        });
    }

    function _setFramework(fw, persist = true) {
        activeFramework = fw;
        document.querySelectorAll('.fw-tab').forEach(b => {
            b.classList.toggle('active', b.dataset.fw === fw);
        });
        if (persist) window.skillforge.saveSettings({ defaultFramework: fw }).catch(() => {});
    }

    // ── Tag input ──
    function _bindTagInput() {
        const input   = document.getElementById('example-input');
        const counter = document.getElementById('examples-counter');
        if (!input) return;

        const _renderTags = () => {
            const list = document.getElementById('tag-list');
            list.innerHTML = '';
            examples.forEach((ex, i) => {
                const tag = document.createElement('div');
                tag.className = 'tag';
                tag.innerHTML = `<span class="tag-text">${_esc(ex)}</span>
                  <button class="tag-remove" data-i="${i}" aria-label="Remove">×</button>`;
                list.appendChild(tag);
            });
            if (counter) counter.textContent = `${examples.length} / ${CAPS.EXAMPLE_MAX}`;
            input.disabled = examples.length >= CAPS.EXAMPLE_MAX;
        };

        const _add = () => {
            const val = input.value.trim();
            if (!val || examples.length >= CAPS.EXAMPLE_MAX) return;
            examples.push(val.slice(0, CAPS.EXAMPLE_REQUEST));
            input.value = '';
            _renderTags();
        };

        input.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                _add();
            } else if (e.key === 'Backspace' && !input.value && examples.length > 0) {
                examples.pop();
                _renderTags();
            }
        });

        document.getElementById('tag-list').addEventListener('click', e => {
            const btn = e.target.closest('.tag-remove');
            if (btn) {
                examples.splice(Number(btn.dataset.i), 1);
                _renderTags();
            }
        });

        _renderTags();
    }

    // ── Output tabs ──
    function _bindOutputTabs() {
        document.querySelectorAll('[data-tab]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-tab]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeOutputTab = btn.dataset.tab;
                document.getElementById('output-tab-raw').classList.toggle('hidden', activeOutputTab !== 'raw');
                document.getElementById('output-tab-preview').classList.toggle('hidden', activeOutputTab !== 'preview');
                // Render preview on switch
                if (activeOutputTab === 'preview') _renderPreview();
            });
        });
    }

    function _renderPreview() {
        const el = document.getElementById('output-preview');
        if (!el) return;
        const text = compiledMd || outputRawText;
        if (!text) {
            el.innerHTML = '<p class="text-muted">Nothing to preview yet.</p>';
            _lastPreviewText = null;
            return;
        }
        // Cache — only re-render when content actually changed
        if (text === _lastPreviewText) return;
        _lastPreviewText = text;
        // Only render validated compiledMd via marked — never raw AI buffer to avoid XSS
        if (compiledMd && typeof marked !== 'undefined') {
            el.innerHTML = marked.parse(compiledMd);
        } else {
            el.innerHTML = `<pre class="pre-wrap">${_esc(text)}</pre>`;
        }
    }

    // ── Save mode ──
    function _bindSaveMode() {
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => _setSaveMode(btn.dataset.mode));
        });
    }

    function _setSaveMode(mode, persist = true) {
        saveMode = mode;
        document.querySelectorAll('.mode-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.mode === mode);
        });
        _updatePathPreview();
        if (persist) window.skillforge.saveSettings({ saveMode: mode }).catch(() => {});
    }

    // ── Path preview ──
    // Mirrors slug.js sanitise() so the preview matches the actual saved path
    const _WINDOWS_RESERVED = new Set([
        'con','prn','aux','nul',
        'com1','com2','com3','com4','com5','com6','com7','com8','com9',
        'lpt1','lpt2','lpt3','lpt4','lpt5','lpt6','lpt7','lpt8','lpt9',
    ]);

    function _bindPathPreview() { _updatePathPreview(); }

    function _updatePathPreview() {
        const nameEl = document.getElementById('skill-name');
        const dynEl  = document.getElementById('path-dynamic');
        if (!nameEl || !dynEl) return;
        const raw = nameEl.value.trim();
        let slug  = raw
            ? raw.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-+|-+$/g, '')
            : '';
        if (!slug || _WINDOWS_RESERVED.has(slug)) slug = slug ? `${slug}-skill` : 'skill-name';
        if (slug.length > 80) slug = slug.slice(0, 80);
        dynEl.textContent = saveMode === 'package' ? `${slug}/SKILL.md` : `${slug}.md`;
    }

    // ── Action buttons ──
    function _bindActionButtons() {
        document.getElementById('btn-generate')?.addEventListener('click', () => triggerGenerate());
        document.getElementById('btn-stop')?.addEventListener('click',     () => _stopGeneration());
        document.getElementById('btn-retry')?.addEventListener('click',    () => _retryGeneration());
        document.getElementById('btn-save')?.addEventListener('click',     () => triggerSave());
        document.getElementById('btn-import')?.addEventListener('click',   () => _importSkill());
        document.getElementById('btn-clear')?.addEventListener('click',    () => clearForm());
        document.getElementById('btn-copy')?.addEventListener('click',     () => _copyOutput());
        document.getElementById('btn-open-editor')?.addEventListener('click', () => _openInEditor());

        document.getElementById('btn-test-send')?.addEventListener('click', () => _sendTestMessage());

        document.getElementById('preset-select')?.addEventListener('change', async e => {
            const id = e.target.value;
            if (!id) return;
            e.target.value = '';
            if (!window.App?.checkUnsavedChanges?.('Apply preset and discard current output?')) return;
            const preset = presets.find(p => p.id === id);
            if (preset) _applyPreset(preset);
        });
    }

    // ── Preset support ──
    function _populatePresets() {
        const sel = document.getElementById('preset-select');
        if (!sel) return;
        sel.innerHTML = '<option value="">— Select a preset —</option>' +
            presets.map(p => `<option value="${_esc(p.id)}">${_esc(p.label)}</option>`).join('');
    }

    function _applyPreset(preset) {
        _setField('skill-name',       preset.skill_name      ?? '');
        _setField('when-to-use',      preset.when_to_use     ?? '');
        _setField('expected-inputs',  preset.expected_inputs ?? '');
        _setField('expected-outputs', preset.expected_outputs ?? '');
        _setField('constraints',      (preset.hard_rules ?? []).join('\n'));
        examples = Array.isArray(preset.example_requests) ? [...preset.example_requests] : [];
        _rebuildTags();
        _updatePathPreview();
    }

    function _setField(id, value) {
        const el = document.getElementById(id);
        if (!el) return;
        el.value = value;
        el.dispatchEvent(new Event('input'));
    }

    function _rebuildTags() {
        const list    = document.getElementById('tag-list');
        const counter = document.getElementById('examples-counter');
        const input   = document.getElementById('example-input');
        if (!list) return;
        list.innerHTML = '';
        examples.forEach((ex, i) => {
            const tag = document.createElement('div');
            tag.className = 'tag';
            tag.innerHTML = `<span class="tag-text">${_esc(ex)}</span>
              <button class="tag-remove" data-i="${i}" aria-label="Remove">×</button>`;
            list.appendChild(tag);
        });
        if (counter) counter.textContent = `${examples.length} / ${CAPS.EXAMPLE_MAX}`;
        if (input)   input.disabled = examples.length >= CAPS.EXAMPLE_MAX;
    }

    // ── Generate ──
    // overrideFormData: if provided, skip DOM collection and use this state (for retry)
    async function triggerGenerate(overrideFormData) {
        if (window.App?.state?.isGenerating) return;

        // Check provider + key
        try {
            const provider = await window.skillforge.getProvider();
            if (!provider) { _showBanner('no-provider'); return; }
            const hasKey = await window.skillforge.hasApiKey();
            if (!hasKey) { _showBanner('no-key'); return; }
        } catch { _showBanner('no-key'); return; }

        _hideBanners();

        const formData = overrideFormData ?? _collectFormData();
        if (!overrideFormData) lastFormData = formData;

        // Layer 1 — form validation
        const l1 = _validateFormLocal(formData);
        _setChecklistItem(1, l1.valid ? 'pass' : 'fail');
        if (!l1.valid) {
            Toast.show(l1.errors[0], 'warning');
            return;
        }

        _setGenerating(true);
        _setOutput('', false);
        _resetChecklist();
        _setChecklistItem(1, 'pass');

        // Subscribe to stream events
        _unsubscribeStream();
        unsubChunk = window.skillforge.onStreamChunk(chunk => {
            outputRawText += chunk;
            _updateRawDisplay(outputRawText);
            _updateTokenEstimate(outputRawText);
        });
        unsubEnd = window.skillforge.onStreamEnd(result => _onStreamEnd(result));

        try {
            const res = await window.skillforge.generate(formData);
            if (res?.error === 'generation_in_progress') {
                Toast.show('Generation already running', 'warning');
                _setGenerating(false);
                _unsubscribeStream();
            }
        } catch (err) {
            Toast.show('Generation failed: ' + err.message, 'error');
            _setGenerating(false);
            _unsubscribeStream();
        }
    }

    function _onStreamEnd(result) {
        _unsubscribeStream();
        _setGenerating(false);

        // Remove streaming cursor — render final text without it
        if (outputRawText) _updateRawDisplay(outputRawText, false);

        // API / network errors
        if (result.error) {
            const ERROR_CFG = {
                no_key:        { msg: 'Add your API key in Settings before generating.', type: 'error',   retry: false },
                api_401:       { msg: 'Key rejected — verify in Settings',               type: 'error',   retry: false },
                api_429:       { msg: 'Rate limited — wait and try again',               type: 'warning', retry: true  },
                api_5xx:       { msg: 'Generation failed (server error)',                type: 'error',   retry: true  },
                network_error: { msg: 'Generation failed (network error)',               type: 'error',   retry: true  },
            };
            const cfg = ERROR_CFG[result.error] ?? { msg: 'Generation failed', type: 'error', retry: true };
            Toast.show(cfg.msg, cfg.type);
            if (cfg.retry) document.getElementById('btn-retry').classList.remove('hidden');
            return;
        }

        if (result.partial) {
            _showBanner('partial');
            _setChecklistItem(2, 'fail');
            _setChecklistItem(3, 'fail');
            _setChecklistItem(4, 'fail');
            document.getElementById('btn-save').disabled = true;
            // Copy still available
            _showCopyButton(true);
            window.App.state.hasUnsavedOutput = false;
            document.getElementById('btn-retry').classList.remove('hidden');
            return;
        }

        if (result.parseError) {
            _showBanner('parse-error');
            _setChecklistItem(2, 'fail');
            _setChecklistItem(3, 'fail');
            _setChecklistItem(4, 'fail');
            document.getElementById('btn-save').disabled = true;
            _showCopyButton(true);
            window.App.state.hasUnsavedOutput = false;
            document.getElementById('btn-retry').classList.remove('hidden');
            return;
        }

        // All good — update checklist from validation result
        const v = result.validation;
        _setChecklistItem(2, v?.layer2?.valid ? 'pass' : 'fail');
        _setChecklistItem(3, v?.layer3?.valid ? 'pass' : 'fail');
        _setChecklistItem(4, v?.layer4?.valid ? 'pass' : 'fail');

        compiledMd = result.compiledMd;

        const allPass = v?.layer2?.valid && v?.layer3?.valid && v?.layer4?.valid;
        document.getElementById('btn-save').disabled = !allPass;
        _showCopyButton(true);

        if (allPass) {
            window.App.state.hasUnsavedOutput = true;
            document.getElementById('btn-retry').classList.add('hidden');
        } else {
            window.App.state.hasUnsavedOutput = false;
            document.getElementById('btn-retry').classList.remove('hidden');
        }

        // Re-render preview if on preview tab
        if (activeOutputTab === 'preview') _renderPreview();
    }

    // ── Stop ──
    async function _stopGeneration() {
        try { await window.skillforge.stopGeneration(); } catch {}
    }

    // ── Retry ──
    function _retryGeneration() {
        if (!lastFormData) return;
        document.getElementById('btn-retry').classList.add('hidden');
        outputRawText = '';
        compiledMd    = null;
        // Re-run with the exact form state from the failed attempt, not the current DOM
        triggerGenerate(lastFormData);
    }

    // ── Save ──
    async function triggerSave() {
        const saveBtn = document.getElementById('btn-save');
        if (saveBtn?.disabled) return;
        if (!compiledMd) return;

        const slug    = document.getElementById('skill-name')?.value.trim() ?? 'skill';
        const content = compiledMd;

        try {
            const result = await window.skillforge.saveSkill({ slug, content, mode: saveMode });

            if (result?.error === 'EEXIST') {
                _showEexistModal(result.filePath, slug, content);
                return;
            }
            if (result?.error === 'folder_missing') {
                Toast.show('Output folder missing — update in Settings', 'error');
                return;
            }
            if (result?.error) {
                Toast.show('Save failed: ' + result.error, 'error');
                return;
            }

            currentFilePath = result.filePath;
            window.App.state.hasUnsavedOutput = false;
            Toast.show('Saved successfully', 'success');
            _showOpenEditorButton(true);
        } catch (err) {
            Toast.show('Save failed', 'error');
        }
    }

    // ── EEXIST modal ──
    function _showEexistModal(filePath, slug, content) {
        const overlay  = document.getElementById('modal-overlay');
        const pathEl   = document.getElementById('modal-conflict-path');
        if (!overlay) return;
        if (pathEl) pathEl.textContent = filePath;
        overlay.classList.remove('hidden');

        const onOverwrite = async () => {
            _hideModal();
            try {
                const r = await window.skillforge.saveSkillOverwrite({ filePath, content });
                if (r?.ok) {
                    currentFilePath = r.filePath;
                    window.App.state.hasUnsavedOutput = false;
                    Toast.show('File overwritten', 'success');
                    _showOpenEditorButton(true);
                } else {
                    Toast.show('Overwrite failed: ' + (r?.error ?? 'unknown'), 'error');
                }
            } catch { Toast.show('Overwrite failed', 'error'); }
        };

        const onCopy = async () => {
            _hideModal();
            try {
                const r = await window.skillforge.saveSkillAsCopy({ slug, content, mode: saveMode });
                if (r?.ok) {
                    currentFilePath = r.filePath;
                    window.App.state.hasUnsavedOutput = false;
                    Toast.show('Saved as copy', 'success');
                    _showOpenEditorButton(true);
                } else {
                    Toast.show('Copy save failed: ' + (r?.error ?? 'unknown'), 'error');
                }
            } catch { Toast.show('Copy save failed', 'error'); }
        };

        const onCancel = () => _hideModal();

        // One-time listeners
        document.getElementById('modal-overwrite').addEventListener('click', onOverwrite, { once: true });
        document.getElementById('modal-save-copy').addEventListener('click', onCopy,      { once: true });
        document.getElementById('modal-cancel').addEventListener('click',    onCancel,    { once: true });
    }

    function _hideModal() {
        document.getElementById('modal-overlay')?.classList.add('hidden');
    }

    // ── Import ──
    async function _importSkill() {
        // Import is intentional — skip unsaved-changes guard
        try {
            const result = await window.skillforge.importSkill();
            if (!result) return; // cancelled

            if (result.error === 'TOO_LARGE')   { Toast.show('File exceeds 50KB limit', 'error');                   return; }
            if (result.error === 'ENOENT')       { Toast.show('File could not be read — moved or in use', 'error'); return; }
            if (result.error === 'EBUSY')        { Toast.show('File could not be read — moved or in use', 'error'); return; }
            if (result.error === 'unreadable')   { Toast.show('File could not be read — moved or in use', 'error'); return; }
            if (result.error)                    { Toast.show('Import failed: ' + result.error, 'error');           return; }

            // Parse the MD file and populate the input form
            const parsed = _parseMdSkill(result.content);

            // Framework tab
            const validFw = ['claude', 'chatgpt', 'langchain'];
            if (parsed.framework && validFw.includes(parsed.framework)) {
                _setFramework(parsed.framework, false);
            }

            // Form fields
            _setField('skill-name',       parsed.name              ?? '');
            _setField('when-to-use',      parsed.when_to_use       ?? '');
            _setField('expected-inputs',  parsed.expected_inputs   ?? '');
            _setField('expected-outputs', parsed.expected_outputs  ?? '');
            _setField('constraints',      parsed.hard_rules        ?? '');

            // Example requests as tags
            if (parsed.examples?.length) {
                examples = parsed.examples.slice(0, 5);
                _rebuildTags();
            }

            Toast.show('Skill imported — form populated', 'success');
        } catch (err) {
            Toast.show('Import failed', 'error');
        }
    }

    // Parse a SKILL.md file into form-field values
    function _parseMdSkill(md) {
        const out = {};

        // --- YAML frontmatter ---
        const fmMatch = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (fmMatch) {
            const fm = fmMatch[1];
            const nameMatch  = fm.match(/^name\s*:\s*["']?(.+?)["']?\s*$/m);
            const fwMatch    = fm.match(/^framework\s*:\s*["']?(\w+)["']?\s*$/m);
            if (nameMatch) out.name      = nameMatch[1].trim();
            if (fwMatch)   out.framework = fwMatch[1].trim().toLowerCase();
        }

        // Helper: extract the text content of a markdown section
        const _section = (heading) => {
            const re = new RegExp(`##\\s+${heading}\\s*\\r?\\n([\\s\\S]*?)(?=\\n##\\s|$)`, 'i');
            const m  = md.match(re);
            if (!m) return '';
            return m[1].replace(/\r\n/g, '\n').trim();
        };

        // Strip bullet prefixes from a block of text
        const _stripBullets = (text) =>
            text.split('\n')
                .map(l => l.replace(/^[\s\-\*]+/, '').trim())
                .filter(Boolean)
                .join('\n');

        out.when_to_use      = _section('When to use');
        out.expected_inputs  = _stripBullets(_section('Expected inputs'));
        out.expected_outputs = _stripBullets(_section('Expected outputs'));

        // Hard rules — strip bullet prefixes for the constraints field
        const hardRules = _section('Hard rules');
        out.hard_rules = hardRules
            ? hardRules.split('\n')
                .map(l => l.replace(/^[\s\-\*]+/, '').trim())
                .filter(Boolean)
                .join('\n')
            : '';

        // Example requests — extract up to 5 bullets as tags
        const exSection = _section('Example requests');
        if (exSection) {
            out.examples = exSection.split('\n')
                .map(l => l.replace(/^[\s\-\*]+/, '').trim())
                .filter(Boolean)
                .slice(0, 5);
        }

        return out;
    }

    // ── Open in editor ──
    async function _openInEditor() {
        if (!currentFilePath) return;
        try {
            const result = await window.skillforge.openInEditor(currentFilePath);
            if (result?.error) {
                const path = currentFilePath;
                Toast.show('No app registered for .md files', 'warning', {
                    action: {
                        label:   'Copy path',
                        onClick: () => navigator.clipboard.writeText(path).catch(() => {}),
                    },
                });
            }
        } catch {
            Toast.show('Could not open file', 'error');
        }
    }

    // ── Copy output ──
    function _copyOutput() {
        const text = compiledMd || outputRawText;
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            Toast.show('Copied to clipboard', 'success');
        }).catch(() => {
            Toast.show('Copy failed', 'error');
        });
    }

    // ── Clear form ──
    function clearForm() {
        ['skill-name', 'when-to-use', 'expected-inputs', 'expected-outputs', 'constraints'].forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.value = ''; el.dispatchEvent(new Event('input')); }
        });
        examples = [];
        _rebuildTags();
        outputRawText    = '';
        compiledMd       = null;
        currentFilePath  = null;
        lastFormData     = null;
        _lastPreviewText = null;
        _setOutput('', false);
        _resetChecklist();
        _hideBanners();
        _updatePathPreview();
        document.getElementById('btn-retry').classList.add('hidden');
        document.getElementById('btn-stop').classList.add('hidden');
        document.getElementById('btn-generate').classList.remove('hidden');
        document.getElementById('btn-save').disabled = true;
        _showCopyButton(false);
        _showOpenEditorButton(false);
        window.App.state.hasUnsavedOutput = false;
    }

    // ── Load from history (reopen) ──
    function loadFromHistory(row) {
        clearForm();
        let formData = {};
        try { formData = JSON.parse(row.input_payload_json ?? '{}'); } catch {}

        _setField('skill-name',       formData.skillName      ?? row.skill_name ?? '');
        _setField('when-to-use',      formData.whenToUse      ?? '');
        _setField('expected-inputs',  formData.expectedInputs ?? '');
        _setField('expected-outputs', formData.expectedOutputs ?? '');
        _setField('constraints',      formData.constraints    ?? '');

        examples = Array.isArray(formData.exampleRequests) ? [...formData.exampleRequests] : [];
        _rebuildTags();

        const fw = formData.framework ?? row.framework ?? 'claude';
        _setFramework(fw, false);

        if (row.generated_md) {
            outputRawText = row.generated_md;
            compiledMd    = row.generated_md;
            _setOutput(row.generated_md, true);
            // Mark all layers passed (it was previously validated)
            _setChecklistItem(1, 'pass');
            _setChecklistItem(2, 'pass');
            _setChecklistItem(3, 'pass');
            _setChecklistItem(4, 'pass');
            document.getElementById('btn-save').disabled = false;
            _showCopyButton(true);
            window.App.state.hasUnsavedOutput = false;
        }

        _updatePathPreview();
        Toast.show('Skill loaded from history', 'success');
    }

    // ── Stream helpers ──
    function _unsubscribeStream() {
        if (unsubChunk) { unsubChunk(); unsubChunk = null; }
        if (unsubEnd)   { unsubEnd();   unsubEnd   = null; }
    }

    function _unsubscribeTestStream() {
        if (unsubTestChunk) { unsubTestChunk(); unsubTestChunk = null; }
        if (unsubTestEnd)   { unsubTestEnd();   unsubTestEnd   = null; }
    }

    // ── Test panel ──
    async function _sendTestMessage() {
        if (window.App?.state?.isGenerating) {
            Toast.show('Generation already running', 'warning');
            return;
        }

        const testInput = document.getElementById('test-input')?.value.trim();
        if (!testInput) { Toast.show('Enter a test message first', 'warning'); return; }

        if (!compiledMd) { Toast.show('Generate a skill first', 'warning'); return; }

        const sendBtn  = document.getElementById('btn-test-send');
        const respEl   = document.getElementById('test-response');
        if (sendBtn) sendBtn.disabled = true;
        if (respEl) { respEl.innerHTML = '<span class="output-placeholder">Sending…</span>'; respEl.classList.remove('hidden'); }

        testResponseBuffer = '';
        _unsubscribeTestStream();

        unsubTestChunk = window.skillforge.onTestStreamChunk(chunk => {
            testResponseBuffer += chunk;
            if (respEl) respEl.textContent = testResponseBuffer;
        });

        unsubTestEnd = window.skillforge.onTestStreamEnd(result => {
            _unsubscribeTestStream();
            if (sendBtn) sendBtn.disabled = false;
            if (result.error) {
                const msgs = {
                    no_key:        'API key not set',
                    api_401:       'Key rejected',
                    api_429:       'Rate limited',
                    api_5xx:       'Server error',
                    network_error: 'Network error',
                };
                if (respEl) respEl.textContent = 'Error: ' + (msgs[result.error] ?? result.error);
                Toast.show(msgs[result.error] ?? 'Test failed', 'error');
            } else if (result.partial) {
                if (respEl && testResponseBuffer) {
                    respEl.textContent = testResponseBuffer + '\n[Stopped]';
                }
            }
        });

        try {
            const res = await window.skillforge.generate({
                isTest:        true,
                systemPrompt:  compiledMd,
                testMessage:   testInput,
                framework:     activeFramework,
            });
            if (res?.error === 'generation_in_progress') {
                _unsubscribeTestStream();
                if (sendBtn) sendBtn.disabled = false;
                Toast.show('Generation already running', 'warning');
            }
        } catch (err) {
            _unsubscribeTestStream();
            if (sendBtn) sendBtn.disabled = false;
            Toast.show('Test failed: ' + err.message, 'error');
        }
    }

    // ── UI state helpers ──
    function _setGenerating(on) {
        window.App.state.isGenerating = on;
        document.getElementById('btn-generate').classList.toggle('hidden', on);
        document.getElementById('btn-stop').classList.toggle('hidden', !on);
        document.getElementById('btn-generate').disabled = on;
    }

    function _setOutput(text, hasContent) {
        outputRawText = text;
        const rawEl = document.getElementById('output-raw');
        if (!rawEl) return;
        if (!hasContent || !text) {
            rawEl.innerHTML = '<span class="output-placeholder">Generated skill will appear here…</span>';
        } else {
            rawEl.textContent = text;
        }
        _showCopyButton(hasContent && !!text);
        _updateTokenEstimate(text);
    }

    // During streaming: use innerHTML to preserve the blinking cursor span
    function _updateRawDisplay(text, withCursor = true) {
        const el = document.getElementById('output-raw');
        if (!el) return;
        el.innerHTML = _esc(text) + (withCursor ? '<span class="stream-cursor"></span>' : '');
    }

    function _updateTokenEstimate(text) {
        const el = document.getElementById('token-estimate');
        if (!el) return;
        if (!text) { el.classList.add('hidden'); return; }
        const est = Math.round(text.length / 4);
        el.textContent = `~${est.toLocaleString()} tokens (estimate)`;
        el.classList.remove('hidden');
    }

    function _showCopyButton(show) {
        document.getElementById('btn-copy')?.classList.toggle('hidden', !show);
    }

    function _showOpenEditorButton(show) {
        document.getElementById('btn-open-editor')?.classList.toggle('hidden', !show);
    }

    // ── Checklist ──
    function _resetChecklist() {
        document.querySelectorAll('.checklist-item').forEach(el => {
            el.className = 'checklist-item pending';
            el.querySelector('.checklist-icon').outerHTML =
                '<svg class="checklist-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';
        });
    }

    function _setChecklistItem(layer, state) {
        const el = document.querySelector(`.checklist-item[data-layer="${layer}"]`);
        if (!el) return;
        el.className = `checklist-item ${state}`;
        const iconSvg = state === 'pass'
            ? '<svg class="checklist-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
            : state === 'fail'
            ? '<svg class="checklist-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
            : '<svg class="checklist-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';
        const existingIcon = el.querySelector('.checklist-icon');
        if (existingIcon) existingIcon.outerHTML = iconSvg;
    }

    // ── Banners ──
    function _hideBanners() {
        ['banner-partial', 'banner-parse-error', 'banner-no-provider', 'banner-no-key'].forEach(id => {
            document.getElementById(id)?.classList.add('hidden');
        });
    }

    function _showBanner(type) {
        _hideBanners();
        document.getElementById(`banner-${type}`)?.classList.remove('hidden');
    }

    // ── Modal ──
    function _bindModal() {
        document.getElementById('modal-overlay')?.addEventListener('click', e => {
            if (e.target === e.currentTarget) _hideModal();
        });
    }

    // ── Form collect ──
    function _collectFormData() {
        return {
            skillName:       (document.getElementById('skill-name')?.value        ?? '').trim(),
            framework:       activeFramework,
            whenToUse:       (document.getElementById('when-to-use')?.value       ?? '').trim(),
            exampleRequests: [...examples],
            expectedInputs:  (document.getElementById('expected-inputs')?.value   ?? '').trim(),
            expectedOutputs: (document.getElementById('expected-outputs')?.value  ?? '').trim(),
            constraints:     (document.getElementById('constraints')?.value       ?? '').trim(),
        };
    }

    // ── Local layer-1 validation ──
    function _validateFormLocal(fd) {
        const errors = [];
        if (!fd.skillName)           errors.push('Skill name is required');
        if (!fd.whenToUse)           errors.push('"When to use" is required');
        if (!fd.exampleRequests.length) errors.push('At least one example request is required');
        return { valid: errors.length === 0, errors };
    }

    // ── Escape HTML ──
    function _esc(str) {
        return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // ── Public API ──
    window.GeneratorView = { mount, triggerGenerate, triggerSave, clearForm, loadFromHistory };
})();
