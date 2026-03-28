'use strict';

(function () {
    // ── State ──
    let loadedFile  = null;   // { ok, name, safeName, meta, body, filePath }
    let convertedMd = null;   // full converted SKILL.md string

    // ── Mount ──
    function mount(container) {
        container.innerHTML = _html();
        _bindAll();
    }

    // ── HTML template ──
    function _html() {
        return `
<div class="install-layout">
  <div class="install-inner">

    <div class="install-header">
      <h2 class="settings-title">OpenClaw Converter</h2>
      <p class="text-muted text-sm">Convert a Claude skill file to OpenClaw format with AI-generated metadata.</p>
    </div>

    <!-- Drop zone -->
    <div class="drop-zone" id="oc-drop-zone" tabindex="0" role="button"
      aria-label="Drop a .md file here or click Browse">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
        class="drop-zone-icon">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
      <div class="drop-zone-header">
        <div id="oc-drop-text" class="drop-zone-text">Drop a Claude skill <code>.md</code> file here</div>
      </div>
      <div class="drop-zone-sub text-muted text-sm">or</div>
      <button id="oc-btn-browse" class="btn btn-secondary btn-sm">Browse…</button>
    </div>

    <!-- File info (hidden until file loaded) -->
    <div id="oc-info-section" class="hidden">

      <!-- Skill name -->
      <div class="info-grid">
        <div class="info-label">Skill name</div>
        <div class="info-value" id="oc-info-name">—</div>
        <div class="info-label">Save path</div>
        <div class="info-value font-mono text-sm" id="oc-info-path">—</div>
      </div>

      <!-- Two-column frontmatter preview -->
      <div class="field">
        <label class="field-label">Frontmatter preview</label>
        <div class="oc-preview-grid">
          <div class="oc-preview-col">
            <div class="oc-preview-label text-muted text-sm">Original</div>
            <pre id="oc-preview-original" class="install-preview text-sm"></pre>
          </div>
          <div class="oc-preview-col">
            <div class="oc-preview-label text-muted text-sm">Converted</div>
            <pre id="oc-preview-converted" class="install-preview text-sm oc-preview-converted-placeholder">
Run conversion to see result</pre>
          </div>
        </div>
      </div>

      <!-- Convert / Stop -->
      <div class="gen-actions">
        <button id="oc-btn-convert" class="btn btn-primary">Convert with AI</button>
        <button id="oc-btn-stop" class="btn btn-secondary hidden">Stop</button>
      </div>

      <!-- Cost row — shown only after successful conversion -->
      <div id="oc-cost-row" class="rv-cost-row hidden">
        <span class="text-muted text-sm">Conversion cost: </span>
        <span id="oc-cost-value" class="text-sm rv-cost-value"></span>
      </div>

      <!-- Save section — shown only after successful conversion -->
      <div id="oc-save-section" class="hidden">
        <div class="field-hint" style="margin-bottom:8px">
          Will save to: <code id="oc-save-hint"></code>
        </div>
        <div class="gen-actions">
          <button id="oc-btn-save" class="btn btn-primary">Save converted skill…</button>
        </div>
      </div>

      <!-- Status row -->
      <div id="oc-status" class="install-status hidden"></div>

    </div>

  </div>

  <!-- Browse installed skills panel -->
  <div class="installed-panel">
    <button id="oc-btn-browse-installed" class="installed-panel-toggle" aria-expanded="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-14">
        <path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M9 21V9"/>
      </svg>
      <span>Browse Installed Skills</span>
      <svg class="installed-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </button>
    <div id="oc-installed-list-wrap" class="installed-list-wrap hidden">
      <div id="oc-installed-list" class="installed-list"></div>
    </div>
  </div>

</div>`;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Bind events
    // ─────────────────────────────────────────────────────────────────────────

    function _bindAll() {
        const dropZone = document.getElementById('oc-drop-zone');

        // Drag/drop
        dropZone?.addEventListener('dragover', e => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });
        dropZone?.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });
        dropZone?.addEventListener('drop', async e => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (!file) return;
            const filePath = file.path;
            if (!filePath) return;
            await _loadFile(filePath);
        });
        dropZone?.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                document.getElementById('oc-btn-browse')?.click();
            }
        });

        // Browse button
        document.getElementById('oc-btn-browse')?.addEventListener('click', async () => {
            const result = await window.skillforge.openclawOpenFile();
            if (result && !result.error) {
                _showFileInfo(result);
            } else if (result?.error) {
                _showStatus(_friendlyLoadError(result.error), 'error');
            }
        });

        // Convert button
        document.getElementById('oc-btn-convert')?.addEventListener('click', _doConvert);

        // Stop button
        document.getElementById('oc-btn-stop')?.addEventListener('click', async () => {
            await window.skillforge.openclawStop();
            _setConverting(false);
            _showStatus('Conversion stopped.', 'warning');
        });

        // Save button
        document.getElementById('oc-btn-save')?.addEventListener('click', _doSave);

        // Browse installed skills
        document.getElementById('oc-btn-browse-installed')?.addEventListener('click', async () => {
            const btn    = document.getElementById('oc-btn-browse-installed');
            const wrap   = document.getElementById('oc-installed-list-wrap');
            const listEl = document.getElementById('oc-installed-list');
            if (!btn || !wrap || !listEl) return;

            const expanded = btn.getAttribute('aria-expanded') === 'true';
            if (expanded) {
                btn.setAttribute('aria-expanded', 'false');
                wrap.classList.add('hidden');
                return;
            }

            btn.setAttribute('aria-expanded', 'true');
            wrap.classList.remove('hidden');
            listEl.innerHTML = '<p class="text-muted text-sm installed-loading">Scanning…</p>';

            try {
                const items = await window.skillforge.listInstalledSkills();
                if (!items || !items.length) {
                    listEl.innerHTML = '<p class="text-muted text-sm installed-loading">No installed skills found in ~/.claude/</p>';
                    return;
                }
                listEl.innerHTML = items.map(item => `
<div class="installed-item" data-path="${SkillUtils.escAttr(item.filePath)}" tabindex="0" role="button"
  title="${SkillUtils.escAttr(item.filePath)}">
  <span class="installed-item-badge ${item.type === 'skill' ? 'badge-purple' : 'badge-blue'}">${item.type}</span>
  <span class="installed-item-name">${SkillUtils.escHtml(item.name)}</span>
  <span class="installed-item-load text-muted text-sm">Load →</span>
</div>`).join('');

                listEl.querySelectorAll('.installed-item').forEach(el => {
                    const activate = async () => {
                        const fp = el.dataset.path;
                        if (!fp) return;
                        await _loadFile(fp);
                        btn.setAttribute('aria-expanded', 'false');
                        wrap.classList.add('hidden');
                    };
                    el.addEventListener('click', activate);
                    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') activate(); });
                });
            } catch (err) {
                listEl.innerHTML = `<p class="text-muted text-sm installed-loading">Error: ${SkillUtils.escHtml(err.message)}</p>`;
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // File loading
    // ─────────────────────────────────────────────────────────────────────────

    async function _loadFile(filePath) {
        const result = await window.skillforge.openclawLoadFile(filePath);
        if (result && !result.error) {
            _showFileInfo(result);
        } else {
            _showStatus(_friendlyLoadError(result?.error ?? 'unknown'), 'error');
        }
    }

    function _showFileInfo(fileData) {
        loadedFile  = fileData;
        convertedMd = null;

        const dropZone   = document.getElementById('oc-drop-zone');
        const dropTextEl = document.getElementById('oc-drop-text');
        const infoSect   = document.getElementById('oc-info-section');

        if (dropZone)   dropZone.classList.add('loaded');
        if (dropTextEl) dropTextEl.textContent = fileData.name + '.md loaded';
        if (infoSect)   infoSect.classList.remove('hidden');

        const nameEl = document.getElementById('oc-info-name');
        const pathEl = document.getElementById('oc-info-path');
        if (nameEl) nameEl.textContent = fileData.name;
        if (pathEl) pathEl.textContent = `${fileData.safeName}/SKILL.md`;

        const saveHintEl = document.getElementById('oc-save-hint');
        if (saveHintEl) saveHintEl.textContent = `<chosen folder>/${fileData.safeName}/SKILL.md`;

        // Show original frontmatter, clear converted pane
        const origPre  = document.getElementById('oc-preview-original');
        const convPre  = document.getElementById('oc-preview-converted');
        if (origPre) origPre.textContent = _extractFrontmatter(fileData);
        if (convPre) {
            convPre.textContent = 'Run conversion to see result';
            convPre.classList.add('oc-preview-converted-placeholder');
        }

        // Reset save/cost/status
        document.getElementById('oc-save-section')?.classList.add('hidden');
        document.getElementById('oc-cost-row')?.classList.add('hidden');
        const costValEl = document.getElementById('oc-cost-value');
        if (costValEl) costValEl.textContent = '';
        _showStatus('', null);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Conversion
    // ─────────────────────────────────────────────────────────────────────────

    async function _doConvert() {
        if (!loadedFile) return;

        // Disable immediately to prevent double-click race
        _setConverting(true);
        _showStatus('Converting…', 'info');

        // Reset pane from any previous run
        convertedMd = null;
        document.getElementById('oc-save-section')?.classList.add('hidden');
        document.getElementById('oc-cost-row')?.classList.add('hidden');
        const convPre = document.getElementById('oc-preview-converted');
        if (convPre) {
            convPre.textContent = 'Converting…';
            convPre.classList.add('oc-preview-converted-placeholder');
        }

        try {
            const result = await window.skillforge.openclawConvert({ filePath: loadedFile.filePath });

            if (result?.ok) {
                convertedMd = result.convertedMd;

                // Show converted frontmatter
                if (convPre) {
                    convPre.textContent = _extractFrontmatterFromMd(convertedMd);
                    convPre.classList.remove('oc-preview-converted-placeholder');
                }

                // Show cost
                const formatted = _formatCost(result.costUsd);
                if (formatted) {
                    const costValEl = document.getElementById('oc-cost-value');
                    if (costValEl) costValEl.textContent = formatted;
                    document.getElementById('oc-cost-row')?.classList.remove('hidden');
                }

                // Show save section
                document.getElementById('oc-save-section')?.classList.remove('hidden');
                _showStatus('Conversion complete.', 'success');
                Toast.show('Conversion complete', 'success');

            } else {
                const msg = _friendlyConvertError(result?.error);
                if (convPre) {
                    convPre.textContent = 'Run conversion to see result';
                    convPre.classList.add('oc-preview-converted-placeholder');
                }
                _showStatus(msg, 'error');
                Toast.show('Conversion failed: ' + msg, 'error');
            }
        } catch (err) {
            _showStatus('Conversion failed: ' + (err.message ?? 'unknown error'), 'error');
        } finally {
            _setConverting(false);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Save
    // ─────────────────────────────────────────────────────────────────────────

    async function _doSave() {
        if (!convertedMd || !loadedFile) return;
        const saveBtn = document.getElementById('oc-btn-save');
        if (saveBtn) saveBtn.disabled = true;

        try {
            const result = await window.skillforge.openclawSave({
                safeName: loadedFile.safeName,
                content:  convertedMd,
            });

            if (result?.ok) {
                _showStatus(`Saved to: ${result.destPath}`, 'success');
                Toast.show('Skill saved', 'success');
                if (saveBtn) saveBtn.disabled = false;
                return;
            }

            if (result?.error === 'cancelled') {
                if (saveBtn) saveBtn.disabled = false;
                return;
            }

            if (result?.error === 'EEXIST') {
                if (saveBtn) saveBtn.disabled = false;
                const overwrite = window.confirm(
                    `A file already exists at:\n${result.filePath ?? result.destPath}\n\nOverwrite?`
                );
                if (!overwrite) {
                    _showStatus('Save cancelled.', 'warning');
                    return;
                }
                if (saveBtn) saveBtn.disabled = true;
                const r2 = await window.skillforge.openclawSaveOverwrite({
                    safeName: loadedFile.safeName,
                    content:  convertedMd,
                });
                if (r2?.ok) {
                    _showStatus(`Saved to: ${r2.destPath}`, 'success');
                    Toast.show('Skill saved (overwritten)', 'success');
                } else {
                    _showStatus('Save failed: ' + (r2?.error ?? 'unknown'), 'error');
                }
                if (saveBtn) saveBtn.disabled = false;
                return;
            }

            _showStatus('Save failed: ' + (result?.error ?? 'unknown'), 'error');
        } catch (err) {
            _showStatus('Save failed: ' + (err.message ?? 'unknown error'), 'error');
        } finally {
            if (saveBtn) saveBtn.disabled = false;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UI helpers
    // ─────────────────────────────────────────────────────────────────────────

    function _setConverting(isConverting) {
        const convertBtn = document.getElementById('oc-btn-convert');
        const stopBtn    = document.getElementById('oc-btn-stop');
        if (convertBtn) convertBtn.disabled = isConverting;
        if (stopBtn) {
            if (isConverting) stopBtn.classList.remove('hidden');
            else              stopBtn.classList.add('hidden');
        }
    }

    function _showStatus(msg, type) {
        const el = document.getElementById('oc-status');
        if (!el) return;
        if (!msg) { el.classList.add('hidden'); el.textContent = ''; return; }
        el.className = 'install-status';
        if (type === 'error')   el.classList.add('status-error');
        if (type === 'success') el.classList.add('status-success');
        if (type === 'warning') el.classList.add('status-warning');
        if (type === 'info')    el.classList.add('status-info');
        el.textContent = msg;
        el.classList.remove('hidden');
    }

    function _formatCost(cost) {
        if (typeof cost !== 'number' || isNaN(cost)) return null;
        if (cost < 0.0001) return '< $0.0001';
        return '~$' + cost.toFixed(4);
    }

    /** Extract the frontmatter block from a loaded file's meta/body for display. */
    function _extractFrontmatter(fileData) {
        if (!fileData?.meta) return '';
        const lines = ['---'];
        for (const [k, v] of Object.entries(fileData.meta)) {
            lines.push(`${k}: ${v}`);
        }
        lines.push('---');
        return lines.join('\n');
    }

    /** Extract the frontmatter block from a full markdown string. */
    function _extractFrontmatterFromMd(md) {
        if (!md || !md.startsWith('---')) return md ?? '';
        const end = md.indexOf('\n---', 3);
        if (end === -1) return md;
        return md.slice(0, end + 4);
    }

    function _friendlyLoadError(code) {
        const map = {
            invalid_extension: 'Only .md files are supported.',
            TOO_LARGE:         'File is too large to convert (max 1 MB).',
            invalid_name:      'Could not derive a safe skill name from this file.',
            invalid_path:      'Invalid file path.',
        };
        return map[code] ?? `Could not load file: ${code}`;
    }

    function _friendlyConvertError(code) {
        const map = {
            no_key:               'Add an API key in Settings first.',
            api_401:              'API key rejected — check Settings.',
            api_429:              'Rate limited — please wait and try again.',
            api_5xx:              'Provider server error — try again shortly.',
            network_error:        'Network error — check your connection.',
            aborted:              'Conversion stopped.',
            generation_in_progress: 'Another operation is in progress.',
            ai_parse_failed:      'AI returned an unexpected response. Try again.',
            ai_invalid_shape:     'AI response failed validation. Try again.',
            reconstruction_failed: 'Conversion produced an invalid file. Try again.',
        };
        return map[code] ?? (code ? String(code) : 'Unknown error');
    }

    // ── Public API ──
    window.OpenClawView = { mount };

})();
