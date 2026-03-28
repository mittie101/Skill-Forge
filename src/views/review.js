'use strict';

(function () {
    // ── State ──
    let inputContent    = '';
    let fileName        = null;
    let reviewLoading   = false;
    let reviewResult    = null;
    let reviewError     = null;
    let previousTotal   = null;
    let fixLoading      = false;
    let fixedContent    = '';
    let fixWarning      = null;
    let fixError        = null;
    let selectedProvider = 'anthropic';
    let selectedModel   = '';
    let _unsubFixChunk  = null;
    let _mounted        = false;
    let _charCountTimer = null;

    const VALID_PROVIDERS = ['anthropic', 'openai'];

    // ── Score colour thresholds ──
    function _scoreClass(score) {
        if (score === 100) return 'score-perfect';
        if (score >= 90)   return 'score-green';
        if (score >= 70)   return 'score-amber';
        return 'score-red';
    }

    // ── Mount ──
    async function mount(container) {
        container.innerHTML = _html();
        _mounted = true;
        _bindAll();

        // Load settings for default provider/model
        try {
            const settings = await window.skillforge.loadSettings();
            if (settings?.provider && VALID_PROVIDERS.includes(settings.provider)) {
                selectedProvider = settings.provider;
            }
            const modelKey = selectedProvider === 'anthropic' ? 'anthropicModel' : 'openaiModel';
            if (settings?.[modelKey]) selectedModel = settings[modelKey];
        } catch { /* use defaults */ }

        _renderProviderSelector();
    }

    // ── Load content from external view (builder / install "Review this skill") ──
    function loadContent(content, label) {
        if (!_mounted) return;
        inputContent = content ?? '';
        fileName     = label ?? null;

        const ta = document.getElementById('rv-input');
        if (ta) ta.value = inputContent;

        const fnEl = document.getElementById('rv-filename');
        if (fnEl) {
            if (fileName) { fnEl.textContent = fileName; fnEl.classList.remove('hidden'); }
            else          { fnEl.textContent = ''; fnEl.classList.add('hidden'); }
        }

        _updateCharCount();
        _updateReviewBtn();
        // Reset delta state when a fresh file is loaded
        previousTotal = null;
        // Clear previous results when new content is loaded
        _clearResults();
    }

    // ── HTML template ──
    function _html() {
        return `
<div class="review-layout">
  <!-- LEFT PANEL — Input -->
  <div class="review-left">
    <div class="review-left-inner">

      <div class="review-header">
        <h2 class="settings-title">Skill Review</h2>
        <p class="text-muted text-sm">Score a skill .md against the canonical rubric, then fix it to 100/100.</p>
      </div>

      <!-- Drop zone + textarea -->
      <div class="rv-drop-zone" id="rv-drop-zone" tabindex="0" role="region"
        aria-label="Drop a .md skill file or paste content below">
        <div class="rv-drop-hint text-muted text-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="icon-14">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Drop a .md file here or paste below
        </div>
      </div>

      <div class="field">
        <textarea id="rv-input" class="field-input field-textarea rv-textarea"
          rows="14" placeholder="Paste skill .md content here…" spellcheck="false"></textarea>
      </div>

      <!-- File name + char count row -->
      <div class="rv-meta-row">
        <span id="rv-filename" class="rv-filename text-muted text-sm hidden"></span>
        <div class="rv-meta-right">
          <span id="rv-char-count" class="char-counter text-sm">0 chars</span>
          <span id="rv-size-warn" class="text-warning text-sm hidden">Large skill — review may be slower</span>
        </div>
      </div>

      <!-- Open file button -->
      <div class="rv-file-row">
        <button id="rv-btn-open" class="btn btn-secondary btn-sm">Open file…</button>
      </div>

      <!-- Provider / model selector -->
      <div id="rv-provider-section" class="field"></div>

      <!-- CTA -->
      <div class="gen-actions">
        <button id="rv-btn-review" class="btn btn-primary" disabled>
          Review Skill
        </button>
        <button id="rv-btn-stop" class="btn btn-secondary hidden">Stop</button>
      </div>

      <!-- Cost row — shown after review/fix completes -->
      <div id="rv-cost-row" class="rv-cost-row hidden">
        <span class="text-muted text-sm">Cost: </span>
        <span id="rv-cost-value" class="text-sm rv-cost-value"></span>
      </div>

    </div>
  </div>

  <!-- RIGHT PANEL — Results -->
  <div class="review-right" id="rv-right">

    <!-- Empty state -->
    <div id="rv-empty-state" class="rv-empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="rv-empty-icon">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        <polyline points="11 8 11 11 13 11"/>
      </svg>
      <p class="text-muted">Review results will appear here.</p>
    </div>

    <!-- Loading state -->
    <div id="rv-loading" class="rv-loading hidden">
      <img src="../build/skeleton.gif" alt="Reviewing…" class="loading-gif">
      <span class="text-muted text-sm">Reviewing skill…</span>
    </div>

    <!-- Results (shown after review) -->
    <div id="rv-results" class="rv-results hidden">

      <!-- Score badge -->
      <div class="rv-score-row">
        <div id="rv-score-badge" class="rv-score-badge score-red">0</div>
        <span id="rv-score-delta" class="rv-score-delta hidden"></span>
        <div class="rv-score-meta">
          <div class="rv-score-label">/ 100</div>
          <div id="rv-overall-verdict" class="rv-verdict text-muted text-sm"></div>
        </div>
      </div>

      <!-- Category cards -->
      <div id="rv-categories" class="rv-categories"></div>

      <!-- Improvements accordion -->
      <div id="rv-improvements-section" class="rv-improvements-section hidden">
        <button class="rv-accordion-btn" id="rv-accordion-btn" aria-expanded="true">
          <span>Improvements</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-14 rv-chevron">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        <ol id="rv-improvements-list" class="rv-improvements-list"></ol>
      </div>

      <!-- Soft hint -->
      <div id="rv-soft-hint" class="rv-soft-hint hidden">
        Further improvements may require manual refinement.
      </div>

      <!-- Fix It button -->
      <div class="rv-fix-row" id="rv-fix-row">
        <button id="rv-btn-fix" class="btn btn-primary hidden" title="">
          Fix It
        </button>
      </div>

      <!-- Fixed skill panel (streams in) -->
      <div id="rv-fixed-panel" class="rv-fixed-panel hidden">
        <div class="rv-fixed-header">
          <span class="field-label">Fixed Skill</span>
          <div class="rv-fixed-actions">
            <button id="rv-btn-copy-fix" class="btn btn-ghost btn-sm">Copy</button>
            <button id="rv-btn-save-fix" class="btn btn-secondary btn-sm">Save to File…</button>
            <button id="rv-btn-re-review" class="btn btn-primary btn-sm" title="">Re-Review</button>
          </div>
        </div>
        <div id="rv-fix-warning-banner" class="rv-fix-warning hidden">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-14">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span id="rv-fix-warning-text"></span>
        </div>
        <!-- Fix loading -->
        <div id="rv-fix-loading" class="rv-fix-loading hidden">
          <img src="../build/skeleton.gif" alt="Rewriting…" class="loading-gif">
          <span class="text-muted text-sm">Rewriting skill…</span>
        </div>
        <pre id="rv-fixed-output" class="rv-fixed-output output-placeholder">Fixed skill will appear here…</pre>
      </div>

    </div>

    <!-- Error state -->
    <div id="rv-error" class="rv-error hidden">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-14">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span id="rv-error-text"></span>
    </div>

  </div>
</div>`;
    }

    // ── Bind all events ──
    function _bindAll() {
        // Textarea input
        const ta = document.getElementById('rv-input');
        if (ta) {
            ta.addEventListener('input', () => {
                inputContent = ta.value;
                clearTimeout(_charCountTimer);
                _charCountTimer = setTimeout(_updateCharCount, 150);
                _updateReviewBtn();
            });
        }

        // Drop zone
        const dropZone = document.getElementById('rv-drop-zone');
        if (dropZone) {
            dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
            dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
            dropZone.addEventListener('drop', e => {
                e.preventDefault();
                dropZone.classList.remove('drag-over');
                const file = e.dataTransfer?.files?.[0];
                if (file && file.name.endsWith('.md')) {
                    _loadFile(file.path, file.name);
                }
            });
            dropZone.addEventListener('click', () => document.getElementById('rv-btn-open')?.click());
            dropZone.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') document.getElementById('rv-btn-open')?.click();
            });
        }

        // Open file
        document.getElementById('rv-btn-open')?.addEventListener('click', async () => {
            try {
                const result = await window.skillforge.installOpenFile();
                if (result && result.ok && result.body !== undefined) {
                    // installOpenFile returns the skill metadata — reconstruct raw content
                    const raw = SkillUtils.rebuildRaw(result);
                    _setInputContent(raw, result.name + '.md');
                } else if (result && !result.ok && result.error) {
                    Toast.show('Could not open file: ' + result.error, 'error');
                }
                // null = user cancelled
            } catch {
                Toast.show('Failed to open file', 'error');
            }
        });

        // Review button
        document.getElementById('rv-btn-review')?.addEventListener('click', _doReview);

        // Stop button
        document.getElementById('rv-btn-stop')?.addEventListener('click', async () => {
            await window.skillforge.reviewStop();
        });

        // Accordion toggle
        document.getElementById('rv-accordion-btn')?.addEventListener('click', _toggleAccordion);

        // Fix It button
        document.getElementById('rv-btn-fix')?.addEventListener('click', _doFix);

        // Copy fix
        document.getElementById('rv-btn-copy-fix')?.addEventListener('click', () => {
            if (!fixedContent) return;
            navigator.clipboard.writeText(fixedContent).then(() => {
                Toast.show('Copied to clipboard', 'success');
            }).catch(() => {
                Toast.show('Copy failed', 'error');
            });
        });

        // Save fix
        document.getElementById('rv-btn-save-fix')?.addEventListener('click', _saveFix);

        // Re-Review
        document.getElementById('rv-btn-re-review')?.addEventListener('click', _doReReview);
    }

    // ── Provider selector rendering ──
    function _renderProviderSelector() {
        const section = document.getElementById('rv-provider-section');
        if (!section) return;
        section.innerHTML = `
          <label class="field-label">Provider</label>
          <div class="save-mode-toggle" id="rv-provider-toggle">
            <button class="mode-btn ${selectedProvider === 'anthropic' ? 'active' : ''}" data-prov="anthropic">Anthropic</button>
            <button class="mode-btn ${selectedProvider === 'openai'    ? 'active' : ''}" data-prov="openai">OpenAI</button>
          </div>`;

        section.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                selectedProvider = btn.dataset.prov;
                section.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b === btn));
            });
        });
    }

    // ── Load file content via install IPC ──
    async function _loadFile(filePath, displayName) {
        try {
            const result = await window.skillforge.installLoadFile(filePath);
            if (result && result.ok) {
                // Reconstruct raw markdown from the parsed result
                const raw = SkillUtils.rebuildRaw(result);
                _setInputContent(raw, displayName ?? result.name + '.md');
            } else {
                Toast.show('Could not read file: ' + (result?.error ?? 'unknown'), 'error');
            }
        } catch {
            Toast.show('Failed to load file', 'error');
        }
    }

    // ── Set input content ──
    function _setInputContent(content, label) {
        inputContent = content ?? '';
        fileName     = label ?? null;

        const ta = document.getElementById('rv-input');
        if (ta) ta.value = inputContent;

        const fnEl = document.getElementById('rv-filename');
        if (fnEl) {
            if (fileName) { fnEl.textContent = fileName; fnEl.classList.remove('hidden'); }
            else          { fnEl.textContent = ''; fnEl.classList.add('hidden'); }
        }

        _updateCharCount();
        _updateReviewBtn();
    }

    // ── Char count + size warning ──
    function _updateCharCount() {
        const len   = inputContent.length;
        const bytes = new TextEncoder().encode(inputContent).length;
        const countEl = document.getElementById('rv-char-count');
        const warnEl  = document.getElementById('rv-size-warn');
        if (countEl) countEl.textContent = `${len.toLocaleString()} chars`;
        if (warnEl)  warnEl.classList.toggle('hidden', bytes <= 50 * 1024);
    }

    // ── Enable/disable review button ──
    function _updateReviewBtn() {
        const btn = document.getElementById('rv-btn-review');
        if (btn) btn.disabled = !inputContent.trim() || reviewLoading || fixLoading;
    }

    // ── Clear results ──
    function _clearResults() {
        reviewResult  = null;
        reviewError   = null;
        fixedContent  = '';
        fixWarning    = null;
        fixError      = null;
        _showState('empty');
        _hideFixPanel();
        _hideError();
    }

    // ── State machine ──
    function _showState(state) {
        const empty   = document.getElementById('rv-empty-state');
        const loading = document.getElementById('rv-loading');
        const results = document.getElementById('rv-results');
        if (empty)   empty.classList.toggle('hidden',   state !== 'empty');
        if (loading) loading.classList.toggle('hidden', state !== 'loading');
        if (results) results.classList.toggle('hidden', state !== 'results');
    }

    function _showError(msg) {
        const el   = document.getElementById('rv-error');
        const text = document.getElementById('rv-error-text');
        if (el)   el.classList.remove('hidden');
        if (text) text.textContent = msg;
    }

    function _hideError() {
        document.getElementById('rv-error')?.classList.add('hidden');
    }

    // ── Do Review ──
    async function _doReview() {
        const content = inputContent.trim();
        if (!content) return;

        reviewLoading = true;
        reviewResult  = null;
        reviewError   = null;
        _hideError();
        _showState('loading');
        _updateReviewBtn();
        document.getElementById('rv-btn-stop')?.classList.remove('hidden');

        try {
            const result = await window.skillforge.reviewSkill({
                content,
                provider: selectedProvider,
                model:    selectedModel || undefined,
            });

            if (result?.ok && result.data) {
                reviewResult = result.data;
                _renderResults(reviewResult);
                _showState('results');
                _showCost(result.costUsd);
            } else {
                const msg = _friendlyError(result?.error);
                _showError(msg);
                _showState('empty');
            }
        } catch (err) {
            _showError('Review failed: ' + (err.message ?? 'unknown error'));
            _showState('empty');
        } finally {
            reviewLoading = false;
            _updateReviewBtn();
            document.getElementById('rv-btn-stop')?.classList.add('hidden');
        }
    }

    // ── Render review results ──
    function _renderResults(result) {
        // Score badge
        const badge = document.getElementById('rv-score-badge');
        if (badge) {
            badge.textContent = String(result.total);
            badge.className   = `rv-score-badge ${_scoreClass(result.total)}`;
        }

        // Score delta badge (shown when re-reviewing after a fix)
        const deltaEl = document.getElementById('rv-score-delta');
        if (deltaEl) {
            if (previousTotal !== null && previousTotal !== result.total) {
                const diff = result.total - previousTotal;
                deltaEl.textContent  = diff > 0 ? `+${diff}` : String(diff);
                deltaEl.className    = `rv-score-delta ${diff > 0 ? 'delta-pos' : 'delta-neg'}`;
            } else {
                deltaEl.className = 'rv-score-delta hidden';
            }
        }

        // Overall verdict
        const verdictEl = document.getElementById('rv-overall-verdict');
        if (verdictEl) verdictEl.textContent = result.overall_verdict;

        // Category cards
        const catsEl = document.getElementById('rv-categories');
        if (catsEl) {
            catsEl.innerHTML = result.categories.map(cat => {
                const pct     = Math.round((cat.score / cat.max) * 100);
                const barClass = cat.score === cat.max ? 'bar-full' : cat.score >= cat.max * 0.7 ? 'bar-good' : 'bar-poor';
                const issuesHtml = cat.issues.length > 0
                    ? `<ul class="rv-cat-issues">${cat.issues.map(i => `<li>${SkillUtils.escHtml(i)}</li>`).join('')}</ul>`
                    : '';
                return `
<div class="rv-cat-card">
  <div class="rv-cat-header">
    <span class="rv-cat-name">${SkillUtils.escHtml(cat.name)}</span>
    <span class="rv-cat-score ${_scoreClass(cat.score)}">${cat.score} / ${cat.max}</span>
  </div>
  <div class="rv-progress-bar">
    <div class="rv-progress-fill ${barClass}" style="width:${pct}%"></div>
  </div>
  ${cat.verdict ? `<p class="rv-cat-verdict text-muted text-sm">${SkillUtils.escHtml(cat.verdict)}</p>` : ''}
  ${issuesHtml}
</div>`;
            }).join('');
        }

        // Improvements
        const impSection = document.getElementById('rv-improvements-section');
        const impList    = document.getElementById('rv-improvements-list');
        if (impList && result.improvements.length > 0) {
            impList.innerHTML = result.improvements
                .map((imp, i) => `
<li class="rv-improvement-item">
  <span class="rv-imp-num">${i + 1}</span>
  <span class="rv-imp-text">${SkillUtils.escHtml(imp)}</span>
  <button class="btn btn-ghost btn-xs rv-imp-copy" data-imp="${SkillUtils.escAttr(imp)}" title="Copy improvement">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-12">
      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  </button>
</li>`)
                .join('');
            // Bind copy buttons
            impList.querySelectorAll('.rv-imp-copy').forEach(btn => {
                btn.addEventListener('click', () => {
                    const text = btn.dataset.imp;
                    navigator.clipboard.writeText(text).then(() => Toast.show('Copied', 'success')).catch(() => {});
                });
            });
            impSection?.classList.remove('hidden');
        } else {
            impSection?.classList.add('hidden');
        }

        // Soft hint
        const hintEl = document.getElementById('rv-soft-hint');
        if (hintEl) {
            const showHint = result.total >= 90
                && previousTotal !== null
                && (result.total - previousTotal) < 3;
            hintEl.classList.toggle('hidden', !showHint);
        }

        // Fix It button
        const fixBtn = document.getElementById('rv-btn-fix');
        if (fixBtn) {
            fixBtn.classList.remove('hidden');
            fixBtn.disabled = result.perfect;
            fixBtn.title    = result.perfect ? 'Skill is already perfect' : '';
            // Scroll Fix It button into view so user knows it's there
            requestAnimationFrame(() => requestAnimationFrame(() => fixBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' })));
        }
    }

    // ── Toggle accordion ──
    function _toggleAccordion() {
        const btn  = document.getElementById('rv-accordion-btn');
        const list = document.getElementById('rv-improvements-list');
        if (!btn || !list) return;
        const open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!open));
        list.classList.toggle('hidden', open);
        btn.querySelector('.rv-chevron')?.classList.toggle('rotated', open);
    }

    // ── Do Fix ──
    async function _doFix() {
        if (!reviewResult || reviewResult.perfect) return;

        previousTotal = reviewResult.total;

        fixLoading   = true;
        fixedContent = '';
        fixWarning   = null;
        fixError     = null;

        _showFixPanel();
        _updateReviewBtn();
        requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById('rv-fixed-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })));

        const fixBtn   = document.getElementById('rv-btn-fix');
        const reRevBtn = document.getElementById('rv-btn-re-review');
        if (fixBtn)   fixBtn.disabled   = true;
        if (reRevBtn) reRevBtn.disabled = true;

        const outputEl  = document.getElementById('rv-fixed-output');
        const loadingEl = document.getElementById('rv-fix-loading');
        if (outputEl)  { outputEl.textContent = ''; outputEl.classList.remove('output-placeholder'); }
        if (loadingEl) loadingEl.classList.remove('hidden');

        // Subscribe to fix chunks
        if (_unsubFixChunk) { _unsubFixChunk(); _unsubFixChunk = null; }
        _unsubFixChunk = window.skillforge.onFixChunk(chunk => {
            fixedContent += chunk;
            if (outputEl) outputEl.textContent = fixedContent;
        });

        try {
            const result = await window.skillforge.fixSkill({
                content:        inputContent,
                improvements:   reviewResult.improvements,
                scoreBreakdown: reviewResult.categories,
                provider:       selectedProvider,
                model:          selectedModel || undefined,
            });

            if (result?.ok && result.data?.content) {
                // Use the processed content from the handler (has version bump + created_at)
                fixedContent = result.data.content;
                if (outputEl) outputEl.textContent = fixedContent;

                if (result.fixWarning) {
                    fixWarning = result.fixWarning;
                    _showFixWarning(fixWarning);
                } else {
                    _hideFixWarning();
                }

                // Update Re-Review button tooltip
                if (reRevBtn) {
                    reRevBtn.title = fixWarning
                        ? 'This skill may be incomplete — review result may be inaccurate.'
                        : '';
                }
                _showCost(result.costUsd);
                Toast.show('Skill rewritten', 'success');

            } else if (result?.partial && result.data?.content) {
                // Stream interrupted — partial content
                fixedContent = result.data.content;
                if (outputEl) outputEl.textContent = fixedContent || '(no content received)';
                fixWarning = 'Fix interrupted — partial result available';
                _showFixWarning(fixWarning);
                if (reRevBtn) reRevBtn.title = 'This skill may be incomplete — review result may be inaccurate.';
                Toast.show('Fix interrupted — partial result available', 'warning');

            } else {
                fixError = _friendlyError(result?.error);
                Toast.show('Fix failed: ' + fixError, 'error');
            }
        } catch (err) {
            fixError = err.message ?? 'unknown error';
            Toast.show('Fix failed: ' + fixError, 'error');
        } finally {
            fixLoading = false;
            if (_unsubFixChunk) { _unsubFixChunk(); _unsubFixChunk = null; }
            if (loadingEl) loadingEl.classList.add('hidden');
            if (fixBtn) {
                fixBtn.disabled = reviewResult?.perfect ?? false;
                fixBtn.title    = reviewResult?.perfect ? 'Skill is already perfect' : '';
            }
            if (reRevBtn) {
                reRevBtn.disabled = false;
                // Scroll Re-Review button into view once fix is done
                requestAnimationFrame(() => requestAnimationFrame(() => reRevBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' })));
            }
            _updateReviewBtn();
        }
    }

    // ── Do Re-Review ──
    async function _doReReview() {
        if (!fixedContent) return;
        // Capture before _clearResults wipes fixedContent
        const contentToReview = fixedContent;
        _setInputContent(contentToReview, fileName ? 'fixed-' + fileName : 'fixed-skill.md');
        _clearResults();
        // Yield to the browser so the cleared results state paints before the
        // loading state appears — without this the transition looks like a flash.
        await new Promise(r => requestAnimationFrame(r));
        await _doReview();
        // Always restore the fix panel — even if review failed, the fixed content
        // is still valid and the user should be able to copy, save, or download it.
        fixedContent = contentToReview;
        _showFixPanel();
        const outputEl = document.getElementById('rv-fixed-output');
        if (outputEl && contentToReview) {
            outputEl.textContent = contentToReview;
            outputEl.classList.remove('output-placeholder');
        }
        if (reviewResult) {
            _hideFixWarning();
            const reRevBtn = document.getElementById('rv-btn-re-review');
            if (reRevBtn) reRevBtn.title = '';
        }
    }

    // ── Extract skill name from frontmatter ──
    function _extractName(content) {
        const match = content.match(/^---[\s\S]*?^name:\s*(.+?)\s*$/m);
        return match ? match[1].trim() : 'fixed-skill';
    }

    // ── Save fixed skill ──
    async function _saveFix() {
        if (!fixedContent) return;
        try {
            const slug   = _extractName(fixedContent) || 'fixed-skill';
            const result = await window.skillforge.saveSkill({
                slug,
                content: fixedContent,
                mode:    window.App?.state?.settings?.saveMode ?? 'package',
            });
            if (result?.error === 'EEXIST') {
                if (window.confirm(`File already exists at:\n${result.filePath}\n\nOverwrite?`)) {
                    const r2 = await window.skillforge.saveSkillOverwrite({
                        filePath: result.filePath,
                        content:  fixedContent,
                    });
                    if (r2?.ok) Toast.show('Skill saved (overwritten)', 'success');
                    else        Toast.show('Overwrite failed', 'error');
                }
            } else if (result?.filePath) {
                Toast.show('Skill saved', 'success');
            } else {
                Toast.show('Save failed: ' + (result?.error ?? 'unknown'), 'error');
            }
        } catch {
            Toast.show('Save failed', 'error');
        }
    }

    // ── Fixed panel visibility ──
    function _showFixPanel() {
        document.getElementById('rv-fixed-panel')?.classList.remove('hidden');
    }

    function _hideFixPanel() {
        const panel = document.getElementById('rv-fixed-panel');
        if (!panel) return;
        panel.classList.add('hidden');
        const outputEl = document.getElementById('rv-fixed-output');
        if (outputEl) {
            outputEl.textContent = 'Fixed skill will appear here…';
            outputEl.classList.add('output-placeholder');
        }
        _hideFixWarning();
    }

    function _showFixWarning(msg) {
        const banner = document.getElementById('rv-fix-warning-banner');
        const text   = document.getElementById('rv-fix-warning-text');
        if (banner) banner.classList.remove('hidden');
        if (text)   text.textContent = msg;
    }

    function _hideFixWarning() {
        document.getElementById('rv-fix-warning-banner')?.classList.add('hidden');
    }

    // ── Friendly error messages ──
    function _friendlyError(code) {
        const map = {
            'no_key':             'No API key set — add one in Settings',
            'api_401':            'API key rejected — check your key in Settings',
            'api_429':            'Rate limited — please wait and try again',
            'api_5xx':            'Provider server error — try again shortly',
            'network_error':      'Network error — check your connection',
            'invalid_provider':   'Unknown provider — check Settings',
            'generation_in_progress': 'Another operation is in progress',
        };
        return map[code] ?? (code ? String(code) : 'Unknown error');
    }

    // ── Cost display ──
    function _formatCost(cost) {
        if (typeof cost !== 'number' || isNaN(cost)) return null;
        if (cost < 0.0001) return '< $0.0001';
        return '$' + cost.toFixed(4);
    }

    function _showCost(costUsd) {
        const formatted = _formatCost(costUsd);
        if (!formatted) return;
        const row = document.getElementById('rv-cost-row');
        const val = document.getElementById('rv-cost-value');
        if (val) val.textContent = formatted;
        if (row) row.classList.remove('hidden');
    }

    function unmount() {
        if (_unsubFixChunk) {
            _unsubFixChunk();
            _unsubFixChunk = null;
        }
        _mounted = false;
    }

    window.ReviewView = { mount, loadContent, unmount };
})();
