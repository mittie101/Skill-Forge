'use strict';

(function () {
    // ── State ──
    let sectionCount    = 5;
    let provider        = 'anthropic';
    let generating      = false;
    let outputText      = '';
    let unsubChunk      = null;
    let suggestTimer    = null;
    let keyStatusTimer  = null;
    let suggestReqId    = 0;
    let genTimer        = null;
    let _mounted        = false;
    let _rafPending     = false;  // RAF batching for stream chunk DOM updates

    // Cached DOM refs — populated immediately after _html() is injected
    let _dom = {};

    const VALID_PROVIDERS = ['anthropic', 'openai'];

    // ── Mount ──
    async function mount(container) {
        container.innerHTML = _html();
        _mounted = true;

        // Pre-cache all stable DOM refs immediately after render
        _dom = {
            keyword:      document.getElementById('b-keyword'),
            desc:         document.getElementById('b-description'),
            kwCount:      document.getElementById('b-keyword-count'),
            descCount:    document.getElementById('b-desc-count'),
            scEl:         document.getElementById('b-section-count'),
            sectionFields: document.getElementById('b-section-fields'),
            sectionChars: document.getElementById('b-section-chars'),
            suggest:      document.getElementById('b-btn-suggest'),
            provToggle:   document.getElementById('b-provider-toggle'),
            genBtn:       document.getElementById('b-btn-generate'),
            cancelBtn:    document.getElementById('b-btn-cancel'),
            indicator:    document.getElementById('b-streaming-indicator'),
            label:        document.getElementById('b-output-label'),
            timer:        document.getElementById('b-gen-timer'),
            output:       document.getElementById('b-output'),
            copyBtn:      document.getElementById('b-btn-copy'),
            saveBtn:      document.getElementById('b-btn-save'),
            reviewBtn:    document.getElementById('b-btn-review'),
            loadingOverlay: document.getElementById('b-loading-overlay'),
            stats:        document.getElementById('b-stats'),
            statsTokens:  document.getElementById('b-stats-tokens'),
            statsCost:    document.getElementById('b-stats-cost'),
            keyStatus:    document.getElementById('b-key-status'),
        };

        // Load settings
        try {
            const s = await window.skillforge.loadSettings();
            if (s.defaultSectionCount) sectionCount = s.defaultSectionCount;
            if (s.provider && VALID_PROVIDERS.includes(s.provider)) provider = s.provider;
        } catch {}

        // Sync spinner DOM value to the loaded sectionCount (HTML default is "5")
        if (_dom.scEl) _dom.scEl.value = sectionCount;

        _renderSectionFields();
        _updateProviderToggle();
        _bindAll();

        // Key status polling — guard clears any stale interval on hypothetical re-mount
        if (keyStatusTimer) clearInterval(keyStatusTimer);
        _refreshKeyStatus();
        keyStatusTimer = setInterval(_refreshKeyStatus, 5000);
    }

    function clearForm() {
        if (_dom.keyword)   _dom.keyword.value   = '';
        if (_dom.desc)      _dom.desc.value       = '';
        outputText = '';
        _setOutput('');
        _setStats(null);
        _setSectionChars([]);
        _updateGenerateBtn();
    }

    // ── HTML ──
    function _html() {
        return `
<div class="builder-layout">

  <!-- LEFT panel -->
  <div class="builder-left">
    <div class="builder-left-inner">

      <div class="builder-header">
        <h2 class="builder-title">Outliner</h2>
        <p class="builder-subtitle text-muted text-sm">Keyword + sections → structured skill outline for the Generator</p>
      </div>

      <!-- Keyword -->
      <div class="field">
        <div class="field-header">
          <label class="field-label" for="b-keyword">Keyword / skill name</label>
          <span class="tooltip-wrap">
            <i class="info-icon" aria-label="More information">i</i>
            <div class="tooltip-card below">
              <div class="tooltip-title">Keyword</div>
              The topic or capability this skill covers. Used to suggest section names and guide generation.
            </div>
          </span>
          <span class="char-counter" id="b-keyword-count">0 / 500</span>
        </div>
        <input id="b-keyword" class="field-input" type="text" maxlength="500"
          placeholder="e.g. cpp-expert, sql-optimiser, react-architect">
      </div>

      <!-- Description -->
      <div class="field">
        <div class="field-header">
          <label class="field-label" for="b-description">Description <span class="text-dim">(optional)</span></label>
          <span class="tooltip-wrap">
            <i class="info-icon" aria-label="More information">i</i>
            <div class="tooltip-card">
              <div class="tooltip-title">Description</div>
              A fuller explanation of what this skill does. More detail here produces better section suggestions.
            </div>
          </span>
          <span class="char-counter" id="b-desc-count">0 / 2000</span>
        </div>
        <textarea id="b-description" class="field-input field-textarea" maxlength="2000" rows="3"
          placeholder="Brief description of what the skill covers…"></textarea>
      </div>

      <!-- Section count -->
      <div class="field">
        <div class="field-header">
          <label class="field-label" for="b-section-count">Section count</label>
          <span class="tooltip-wrap">
            <i class="info-icon" aria-label="More information">i</i>
            <div class="tooltip-card">
              <div class="tooltip-title">Section Count</div>
              How many sections the generated skill file should have. Between 2 and 10.
            </div>
          </span>
          <span class="text-muted text-sm">2–10</span>
        </div>
        <input id="b-section-count" class="field-input field-input-sm" type="number" min="2" max="10" value="5">
      </div>

      <!-- Section name fields -->
      <div class="field">
        <div class="field-header">
          <label class="field-label">Section names</label>
          <span class="tooltip-wrap">
            <button id="b-btn-suggest" class="btn btn-ghost btn-sm btn-suggest" title="Auto-suggest section names">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-14">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              Suggest names
            </button>
            <div class="tooltip-card">
              <div class="tooltip-title">Suggest Section Names</div>
              Asks the AI to propose section headings based on your keyword and description.
            </div>
          </span>
        </div>
        <div id="b-section-fields"></div>
      </div>

      <!-- Provider toggle -->
      <div class="field">
        <label class="field-label">Provider</label>
        <div class="save-mode-toggle" id="b-provider-toggle">
          <button class="mode-btn active" data-prov="anthropic">Anthropic</button>
          <button class="mode-btn" data-prov="openai">OpenAI</button>
        </div>
      </div>

      <!-- Generate / Cancel -->
      <div class="gen-actions">
        <span class="tooltip-wrap">
          <button id="b-btn-generate" class="btn btn-primary" disabled>
            Create Outline
            <kbd>Ctrl+B</kbd>
          </button>
          <div class="tooltip-card below">
            <div class="tooltip-title">Generate</div>
            Streams a complete skill file using your keyword, description, and section names.
          </div>
        </span>
        <button id="b-btn-cancel" class="btn btn-secondary hidden">Cancel</button>
      </div>

    </div>
  </div>

  <!-- RIGHT panel -->
  <div class="builder-right">

    <!-- Output toolbar -->
    <div class="output-tabs">
      <div class="output-label">
        <span id="b-output-label" class="text-muted text-sm">Output</span>
        <span id="b-streaming-indicator" class="streaming-cursor hidden"></span>
        <span id="b-gen-timer" class="text-muted text-sm hidden"></span>
      </div>
      <div class="output-meta">
        <div id="b-key-status" class="key-status-bar"></div>
        <button id="b-btn-copy" class="btn btn-ghost btn-sm" disabled>Copy</button>
        <button id="b-btn-save" class="btn btn-secondary btn-sm" disabled>Save…</button>
        <button id="b-btn-review" class="btn btn-ghost btn-sm" disabled title="Open in Review view">Review…</button>
      </div>
    </div>

    <!-- Raw output -->
    <div class="output-area">
      <div class="output-tab-panel">
        <pre id="b-output" class="output-raw output-placeholder">Your skill outline will appear here…</pre>
      </div>
      <!-- Generation loading overlay -->
      <div id="b-loading-overlay" class="b-loading-overlay hidden">
        <img src="../build/skeleton.gif" alt="Generating…" class="loading-gif">
        <span class="text-muted text-sm">Generating…</span>
      </div>
    </div>

    <!-- Section char counts -->
    <div id="b-section-chars" class="section-chars hidden"></div>

    <!-- Stats row -->
    <div id="b-stats" class="build-stats hidden">
      <span id="b-stats-tokens" class="text-muted text-sm"></span>
      <span id="b-stats-cost"   class="text-muted text-sm"></span>
    </div>

  </div>

</div>`;
    }

    // ── Render section fields ──
    function _renderSectionFields(values) {
        const container = _dom.sectionFields;
        if (!container) return;
        const fields = [];
        for (let i = 0; i < sectionCount; i++) {
            const val = (values && values[i]) ? values[i] : '';
            fields.push(`
<div class="section-field">
  <span class="section-number">${i + 1}</span>
  <input class="field-input section-name-input" type="text" maxlength="100"
    placeholder="Section ${i + 1} name…"
    value="${SkillUtils.escHtml(val)}"
    data-section-idx="${i}">
</div>`);
        }
        container.innerHTML = fields.join('');
        _updateGenerateBtn();
    }

    // ── Get current section names from DOM ──
    function _getSections() {
        return [...document.querySelectorAll('.section-name-input')].map(i => i.value.trim());
    }

    // ── Update provider toggle UI ──
    function _updateProviderToggle() {
        _dom.provToggle?.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.prov === provider);
        });
    }

    // ── Update generate button state ──
    function _updateGenerateBtn() {
        const btn = _dom.genBtn;
        if (!btn) return;
        const keyword   = _dom.keyword?.value.trim() ?? '';
        const sections  = _getSections();
        const allFilled = sections.length > 0 && sections.every(s => s.length > 0);
        btn.disabled = generating || !keyword || !allFilled;
    }

    // ── Set output text ──
    function _setOutput(text) {
        const el = _dom.output;
        if (!el) return;
        if (!text) {
            el.textContent = 'Your skill outline will appear here…';
            el.classList.add('output-placeholder');
        } else {
            el.textContent = text;
            el.classList.remove('output-placeholder');
        }
    }

    // ── Set stats row ──
    function _setStats(data) {
        if (!_dom.stats) return;
        if (!data) { _dom.stats.classList.add('hidden'); return; }
        _dom.stats.classList.remove('hidden');
        if (_dom.statsTokens)
            _dom.statsTokens.textContent = `${(data.inputTokens || 0) + (data.outputTokens || 0)} tokens (in: ${data.inputTokens || 0} / out: ${data.outputTokens || 0})`;
        if (_dom.statsCost && data.costUsd != null)
            _dom.statsCost.textContent = `$${data.costUsd.toFixed(4)}`;
    }

    // ── Set section char count badges ──
    function _setSectionChars(sections) {
        const container = _dom.sectionChars;
        if (!container) return;
        if (!sections || sections.length === 0 || !outputText) {
            container.classList.add('hidden');
            container.innerHTML = '';
            return;
        }
        // Split output text once and reuse across all sections
        const lines  = outputText.split('\n');
        const badges = sections.map(name => {
            const count = _countSectionChars(lines, name);
            return `<span class="section-char-badge" title="${SkillUtils.escHtml(name)}">${SkillUtils.escHtml(name)}: ${count} chars</span>`;
        });
        container.innerHTML = badges.join('');
        container.classList.remove('hidden');
    }

    // Count chars in a ## section of markdown output (receives pre-split lines array)
    function _countSectionChars(lines, sectionName) {
        const target = `## ${sectionName.trim().toLowerCase()}`;
        let inSection = false;
        let count     = 0;
        for (const line of lines) {
            if (line.trim().toLowerCase() === target) { inSection = true; continue; }
            if (inSection) {
                if (line.startsWith('## ')) break;
                count += line.length + 1;
            }
        }
        return count;
    }

    // ── Bind all events ──
    function _bindAll() {
        // Keyword char counter + debounced auto-suggest
        _dom.keyword?.addEventListener('input', () => {
            if (_dom.kwCount) _dom.kwCount.textContent = `${_dom.keyword.value.length} / 500`;
            _updateGenerateBtn();
            if (_dom.keyword.value.trim().length >= 3 && !generating) {
                clearTimeout(suggestTimer);
                suggestTimer = setTimeout(_autoSuggest, 700);
            }
        });

        // Description char counter
        _dom.desc?.addEventListener('input', () => {
            if (_dom.descCount) _dom.descCount.textContent = `${_dom.desc.value.length} / 2000`;
        });

        // Section count spinner
        _dom.scEl?.addEventListener('change', () => {
            const n = Math.max(2, Math.min(10, parseInt(_dom.scEl.value) || 5));
            _dom.scEl.value = n;
            sectionCount    = n;
            _renderSectionFields();
        });

        // Section name inputs — event delegation on container
        _dom.sectionFields?.addEventListener('input', e => {
            if (e.target.matches('.section-name-input')) _updateGenerateBtn();
        });

        // Suggest button
        _dom.suggest?.addEventListener('click', _triggerSuggest);

        // Provider toggle — event delegation on container (fix 4)
        _dom.provToggle?.addEventListener('click', e => {
            const btn = e.target.closest('.mode-btn');
            if (!btn) return;
            provider = btn.dataset.prov;
            _updateProviderToggle();
        });

        // Generate / Cancel
        _dom.genBtn?.addEventListener('click', _generate);
        _dom.cancelBtn?.addEventListener('click', async () => {
            await window.skillforge.buildStop();
        });

        // Copy
        _dom.copyBtn?.addEventListener('click', () => {
            if (!outputText) return;
            navigator.clipboard.writeText(outputText)
                .then(() => Toast.show('Copied to clipboard', 'success'))
                .catch(() => Toast.show('Copy failed', 'error'));
        });

        // Save
        _dom.saveBtn?.addEventListener('click', async () => {
            if (!outputText) return;
            const keyword = _dom.keyword?.value.trim() || 'skill';
            try {
                const result = await window.skillforge.saveSkill({
                    slug:    keyword,
                    content: outputText,
                    mode:    window.App?.state?.settings?.saveMode ?? 'package',
                });
                if (result?.error === 'EEXIST') {
                    if (window.confirm(`File already exists at:\n${result.filePath}\n\nOverwrite?`)) {
                        const overResult = await window.skillforge.saveSkillOverwrite({
                            filePath: result.filePath,
                            content:  outputText,
                        });
                        if (overResult?.ok) {
                            Toast.show('Skill saved (overwritten)', 'success');
                            if (window.App?.state) window.App.state.hasUnsavedOutput = false;
                        } else {
                            Toast.show('Overwrite failed: ' + (overResult?.error ?? 'unknown'), 'error');
                        }
                    }
                } else if (result?.error) {
                    Toast.show('Save failed: ' + result.error, 'error');
                } else if (result?.filePath) {
                    Toast.show('Skill saved', 'success');
                    if (window.App?.state) window.App.state.hasUnsavedOutput = false;
                }
            } catch {
                Toast.show('Save failed', 'error');
            }
        });

        // Review this skill
        _dom.reviewBtn?.addEventListener('click', () => {
            if (!outputText) return;
            const keyword = _dom.keyword?.value.trim() || 'skill';
            window.ReviewView?.loadContent(outputText, `${keyword}.md`);
            window.App?.showView('review', { skipGuard: true });
        });
    }

    // ── Auto-suggest (debounced) ──
    function _autoSuggest() {
        if (generating) return;
        const keyword = _dom.keyword?.value.trim() ?? '';
        if (keyword.length < 3) return;
        _fetchSuggestions(keyword);
    }

    function _triggerSuggest() {
        clearTimeout(suggestTimer);
        const keyword = _dom.keyword?.value.trim() ?? '';
        if (!keyword) { Toast.show('Enter a keyword first', 'warning'); return; }
        _fetchSuggestions(keyword);
    }

    async function _fetchSuggestions(keyword) {
        const reqId   = ++suggestReqId;
        const btn     = _dom.suggest;
        const origTxt = btn?.textContent;
        if (btn) { btn.disabled = true; btn.textContent = 'Suggesting…'; }

        const description = _dom.desc?.value.trim() ?? '';
        try {
            const result = await window.skillforge.suggestSections(keyword, description, sectionCount);

            // Ignore stale responses — a newer request or generate() has superseded this one
            if (reqId !== suggestReqId) return;

            if (result?.ok && Array.isArray(result.suggestions)) {
                if (!generating) {
                    _renderSectionFields(result.suggestions);
                    Toast.show('Section names suggested', 'success');
                }
            } else if (result?.error === 'no_key') {
                Toast.show('Add an API key in Settings first', 'warning');
            } else {
                Toast.show('Could not suggest names', 'warning');
            }
        } catch {
            if (reqId === suggestReqId) Toast.show('Suggestion failed', 'error');
        } finally {
            if (reqId === suggestReqId && btn) {
                btn.disabled = false;
                btn.textContent = origTxt ?? 'Suggest names';
            }
        }
    }

    // ── Generate ──
    async function _generate() {
        const keyword     = _dom.keyword?.value.trim() ?? '';
        const description = _dom.desc?.value.trim() ?? '';
        const sections    = _getSections();   // captured before any async
        const maxTokens   = parseInt(window.App?.state?.settings?.maxTokens) || 8192;

        if (!keyword || sections.some(s => !s)) {
            Toast.show('Fill in keyword and all section names first', 'warning');
            return;
        }

        // Cancel any in-flight suggestion — its result must not overwrite section inputs
        suggestReqId++;
        clearTimeout(suggestTimer);

        generating  = true;
        outputText  = '';
        _setOutput('');
        _setStats(null);
        _setSectionChars([]);
        _dom.loadingOverlay?.classList.remove('hidden');
        if (window.App?.state) window.App.state.isGenerating = true;

        // Show streaming cursor + elapsed timer
        _dom.indicator?.classList.remove('hidden');
        if (_dom.label) _dom.label.textContent = 'Generating…';
        if (_dom.timer) { _dom.timer.textContent = '0s'; _dom.timer.classList.remove('hidden'); }
        const genStart = Date.now();
        genTimer = setInterval(() => {
            if (_dom.timer) _dom.timer.textContent = `${Math.floor((Date.now() - genStart) / 1000)}s`;
        }, 1000);

        _dom.genBtn?.classList.add('hidden');
        _dom.cancelBtn?.classList.remove('hidden');
        _dom.copyBtn?.setAttribute('disabled', '');
        _dom.saveBtn?.setAttribute('disabled', '');
        _dom.reviewBtn?.setAttribute('disabled', '');

        // Subscribe to streaming chunks — final result comes back via the invoke return value
        unsubChunk = window.skillforge.onBuildChunk(chunk => {
            outputText += chunk;
            if (!_rafPending) {
                _rafPending = true;
                requestAnimationFrame(() => {
                    _rafPending = false;
                    _setOutput(outputText);
                    const panel = document.querySelector('.output-tab-panel');
                    if (panel) panel.scrollTop = panel.scrollHeight;
                });
            }
        });

        try {
            const result = await window.skillforge.buildGenerate({ keyword, description, sections, maxTokens, provider });

            // Prefer streamed chunks already in outputText; fall back to result.rawText if chunks were missed
            const finalText = typeof result?.rawText === 'string' && result.rawText ? result.rawText : outputText;
            if (finalText && !outputText) {
                outputText = finalText;
                _setOutput(outputText);
            }

            const ERROR_MSGS = {
                no_key:                 'Add an API key in Settings first',
                api_401:                'API key rejected — verify in Settings',
                api_429:                'Rate limited — try again shortly',
                api_5xx:                'API server error — try again',
                network_error:          'Network error — check connection',
                generation_in_progress: 'Already generating — wait or cancel',
            };

            if (!result || result.error) {
                Toast.show(ERROR_MSGS[result?.error] ?? `Generation failed: ${result?.error}`, 'error');
            } else if (result.partial) {
                Toast.show('Generation stopped — partial output', 'warning');
            } else if (result.ok) {
                Toast.show('Outline complete — sent to Generator', 'success');
                if (window.App?.state) window.App.state.hasUnsavedOutput = true;
                _setStats(result);
                _setSectionChars(sections);
                window.GeneratorView?.loadBuilderOutput?.(finalText, keyword);
            }
        } catch (err) {
            Toast.show('Generation error: ' + err.message, 'error');
        } finally {
            _cleanup();
        }
    }

    function _cleanup() {
        generating    = false;
        _rafPending   = false;
        if (unsubChunk) { unsubChunk(); unsubChunk = null; }
        if (genTimer)   { clearInterval(genTimer); genTimer = null; }

        _dom.indicator?.classList.add('hidden');
        _dom.loadingOverlay?.classList.add('hidden');
        if (_dom.timer) { _dom.timer.classList.add('hidden'); _dom.timer.textContent = ''; }
        if (_dom.label) _dom.label.textContent = 'Output';

        _dom.genBtn?.classList.remove('hidden');
        _dom.cancelBtn?.classList.add('hidden');

        if (outputText) {
            _dom.copyBtn?.removeAttribute('disabled');
            _dom.saveBtn?.removeAttribute('disabled');
            _dom.reviewBtn?.removeAttribute('disabled');
        }

        _updateGenerateBtn();
        if (window.App?.state) window.App.state.isGenerating = false;
    }

    // ── Refresh API key status pills ──
    async function _refreshKeyStatus() {
        const el = _dom.keyStatus;
        if (!el) return;
        try {
            const [hasAnthropic, hasOpenAI] = await Promise.all([
                window.skillforge.hasApiKey('anthropic'),
                window.skillforge.hasApiKey('openai'),
            ]);
            const pills = [
                { label: 'Anthropic', ok: hasAnthropic },
                { label: 'OpenAI',    ok: hasOpenAI    },
            ].map(({ label, ok }) => {
                const span    = document.createElement('span');
                span.className = `key-pill ${ok ? 'key-ok' : 'key-missing'}`;
                const dot     = document.createElement('span');
                dot.className  = 'key-dot';
                span.appendChild(dot);
                span.appendChild(document.createTextNode(label));
                return span;
            });
            el.replaceChildren(...pills);
        } catch {
            // Silently swallow IPC errors — leave previous pill state unchanged
        }
    }

    // Called by app.js when navigating away — stops the polling interval without
    // resetting form state so the user's work is preserved when they return.
    function onHide() {
        if (keyStatusTimer) { clearInterval(keyStatusTimer); keyStatusTimer = null; }
        if (genTimer)       { clearInterval(genTimer);       genTimer = null; }
        // Also clean up any in-flight generation listener
        if (unsubChunk) { unsubChunk(); unsubChunk = null; }
        clearTimeout(suggestTimer);
    }

    // Called by app.js when navigating back — restarts polling and refreshes pills.
    function onShow() {
        if (!_mounted) return;
        if (keyStatusTimer) clearInterval(keyStatusTimer);
        _refreshKeyStatus();
        keyStatusTimer = setInterval(_refreshKeyStatus, 5000);
    }

    window.BuilderView = { mount, onHide, onShow, clearForm, triggerBuild: () => { if (!generating) _generate(); } };
})();
