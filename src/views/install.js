'use strict';

(function () {
    // ── State ──
    let loadedFile = null;
    let modeSkill  = true;

    // ── Mount ──
    function mount(container) {
        container.innerHTML = _html();
        _bindAll();
    }

    // ── HTML ──
    function _html() {
        return `
<div class="install-layout">
  <div class="install-inner">

    <div class="install-header">
      <h2 class="settings-title">Skill Converter</h2>
      <p class="text-muted text-sm">Install a Claude skill .md file into <code>~/.claude/</code></p>
    </div>

    <!-- Drop zone -->
    <div class="drop-zone" id="i-drop-zone" tabindex="0" role="button"
      aria-label="Drop a .md file here or click Browse">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
        class="drop-zone-icon">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      <div class="drop-zone-header">
        <div id="i-drop-text" class="drop-zone-text">Drop a Claude skill <code>.md</code> file here</div>
        <span class="tooltip-wrap">
          <i class="info-icon" aria-label="More information">i</i>
          <div class="tooltip-card below">
            <div class="tooltip-title">Drop a Skill File</div>
            Drag a .md skill file here or click Browse to pick one. The file will be parsed and previewed before install.
          </div>
        </span>
      </div>
      <div class="drop-zone-sub text-muted text-sm">or</div>
      <button id="i-btn-browse" class="btn btn-secondary btn-sm">Browse…</button>
    </div>

    <!-- File info (hidden until file loaded) -->
    <div id="i-info-section" class="hidden">

      <!-- Mode toggle -->
      <div class="field">
        <label class="field-label">Install mode</label>
        <div class="save-mode-toggle mode-toggle-install">
          <span class="tooltip-wrap" style="flex:1">
            <button class="mode-btn active" id="i-mode-skill" data-mode="skill" style="width:100%">
              Skill (recommended)
              <span class="mode-hint">~/.claude/skills/…/SKILL.md</span>
            </button>
            <div class="tooltip-card">
              <div class="tooltip-title">Skill Mode</div>
              Installs to ~/.claude/skills/&lt;name&gt;/SKILL.md. Invoked in Claude Code as /&lt;name&gt;. Recommended for complex, multi-step skills.
            </div>
          </span>
          <span class="tooltip-wrap" style="flex:1">
            <button class="mode-btn" id="i-mode-command" data-mode="command" style="width:100%">
              Slash Command
              <span class="mode-hint">~/.claude/commands/….md</span>
            </button>
            <div class="tooltip-card">
              <div class="tooltip-title">Command Mode</div>
              Installs to ~/.claude/commands/&lt;name&gt;.md. Invoked as /user:&lt;name&gt;. Better for simple one-shot commands.
            </div>
          </span>
        </div>
        <div class="field-hint">
          Skill: invoked as <code id="i-hint-command">/skill-name</code> — persists across projects.<br>
          Command: invoked as <code>/user:skill-name</code> — user-level only.
        </div>
      </div>

      <!-- Info grid -->
      <div class="info-grid">
        <div class="info-label">Skill name</div>
        <div class="info-value" id="i-info-name">—</div>

        <div class="info-label">Install command</div>
        <div class="info-value font-mono" id="i-info-command">—</div>

        <div class="info-label">Install path</div>
        <div class="info-value font-mono text-sm" id="i-info-path">—</div>
      </div>

      <!-- Warning (no recognised sections) -->
      <div id="i-warn-sections" class="status-row status-warning hidden">
        Warning: no recognised sections found (When to Use, Instructions, Expected Outputs, Hard Rules, Edge Cases).
        The file will still be installed but may not work as expected.
      </div>

      <!-- Preview -->
      <div class="field">
        <label class="field-label">Preview (processed content)</label>
        <pre id="i-preview" class="install-preview text-sm"></pre>
      </div>

      <!-- Install button -->
      <div class="gen-actions">
        <span class="tooltip-wrap">
          <button id="i-btn-install" class="btn btn-primary">Install to Claude Code</button>
          <div class="tooltip-card below">
            <div class="tooltip-title">Install to Claude Code</div>
            Writes the processed file to your Claude Code config directory. Will warn if a file already exists.
          </div>
        </span>
        <button id="i-btn-open-folder" class="btn btn-ghost btn-sm hidden">Open folder</button>
        <button id="i-btn-review" class="btn btn-ghost btn-sm hidden">Review this skill…</button>
      </div>

      <!-- Status -->
      <div id="i-status" class="install-status hidden"></div>

    </div>

  </div>

  <!-- Browse installed skills panel -->
  <div class="installed-panel">
    <button id="i-btn-browse-installed" class="installed-panel-toggle" aria-expanded="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-14">
        <path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M9 21V9"/>
      </svg>
      <span>Browse Installed Skills</span>
      <svg class="installed-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </button>
    <div id="i-installed-list-wrap" class="installed-list-wrap hidden">
      <div id="i-installed-list" class="installed-list"></div>
    </div>
  </div>

</div>`;
    }

    // ── Bind events ──
    function _bindAll() {
        const dropZone = document.getElementById('i-drop-zone');

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
            // In Electron renderer, File objects have a .path property
            const filePath = file.path;
            if (!filePath) return;
            // Extension check is a UX hint only — the main process performs the
            // authoritative validation and will return an error for invalid files.
            await _loadFile(filePath);
        });

        // Browse button
        document.getElementById('i-btn-browse')?.addEventListener('click', async () => {
            const result = await window.skillforge.installOpenFile();
            if (result && !result.error) {
                _showFileInfo(result);
            } else if (result?.error) {
                _showStatus(`Could not open file: ${result.error}`, 'error');
            }
        });

        // Mode toggle
        document.getElementById('i-mode-skill')?.addEventListener('click', () => _setMode(true));
        document.getElementById('i-mode-command')?.addEventListener('click', () => _setMode(false));

        // Install button
        document.getElementById('i-btn-install')?.addEventListener('click', _doInstall);

        // Open folder button
        document.getElementById('i-btn-open-folder')?.addEventListener('click', () => {
            if (!loadedFile) return;
            window.skillforge.installOpenFolder({ safeName: loadedFile.safeName, modeSkill });
        });

        // Review this skill button
        document.getElementById('i-btn-review')?.addEventListener('click', () => {
            if (!loadedFile) return;
            const rawContent = SkillUtils.rebuildRaw(loadedFile);
            window.ReviewView?.loadContent(rawContent, loadedFile.name + '.md');
            window.App?.showView('review', { skipGuard: true });
        });

        // Browse installed skills toggle
        document.getElementById('i-btn-browse-installed')?.addEventListener('click', async () => {
            const btn     = document.getElementById('i-btn-browse-installed');
            const wrap    = document.getElementById('i-installed-list-wrap');
            const listEl  = document.getElementById('i-installed-list');
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

    async function _loadFile(filePath) {
        const result = await window.skillforge.installLoadFile(filePath);
        if (result && !result.error) {
            _showFileInfo(result);
        } else {
            _showStatus(`Could not load file: ${result?.error ?? 'unknown error'}`, 'error');
        }
    }

    async function _showFileInfo(fileData) {
        loadedFile = fileData;

        // Show info section
        document.getElementById('i-info-section')?.classList.remove('hidden');
        document.getElementById('i-drop-zone')?.classList.add('loaded');
        const dropTextEl = document.getElementById('i-drop-text');
        if (dropTextEl) dropTextEl.textContent = fileData.name + '.md loaded';

        // Update info grid
        document.getElementById('i-info-name').textContent    = fileData.name;

        // Warn if no sections
        const warnEl = document.getElementById('i-warn-sections');
        if (warnEl) {
            if (fileData.warnNoSections) warnEl.classList.remove('hidden');
            else warnEl.classList.add('hidden');
        }

        // Update mode UI
        await _updateModeInfo();

        // Show preview
        await _updatePreview();

        // Clear previous status
        _showStatus('', null);
        document.getElementById('i-btn-open-folder')?.classList.add('hidden');
        document.getElementById('i-btn-review')?.classList.remove('hidden');
    }

    async function _setMode(isSkill) {
        modeSkill = isSkill;
        document.getElementById('i-mode-skill')?.classList.toggle('active', isSkill);
        document.getElementById('i-mode-command')?.classList.toggle('active', !isSkill);
        await _updateModeInfo();
    }

    async function _updateModeInfo() {
        if (!loadedFile) return;
        const { safeName } = loadedFile;

        const command = modeSkill ? `/${safeName}` : `/user:${safeName}`;
        document.getElementById('i-info-command').textContent = command;

        const hintEl = document.getElementById('i-hint-command');
        if (hintEl) hintEl.textContent = command;

        // Preview path
        try {
            const p = await window.skillforge.installPreviewPath({ safeName, modeSkill });
            document.getElementById('i-info-path').textContent = p;
        } catch {}
    }

    async function _updatePreview() {
        if (!loadedFile) return;
        // Build preview content locally (same logic as ipc/install.js _buildInstallContent)
        const { meta, body } = loadedFile;
        const get = k => meta[k] ?? '';

        function extractSection(b, heading) {
            const lb = b.toLowerCase();
            const pat = `## ${heading.toLowerCase()}`;
            const idx = lb.indexOf(pat);
            if (idx === -1) return '';
            const start = b.indexOf('\n', idx);
            if (start === -1) return '';
            const next = lb.indexOf('\n## ', start + 1);
            return (next === -1 ? b.slice(start + 1) : b.slice(start + 1, next)).trim();
        }

        const desc    = get('description');
        const when    = extractSection(body, 'when to use');
        const instr   = extractSection(body, 'instructions');
        const outputs = extractSection(body, 'expected outputs');
        const rules   = extractSection(body, 'hard rules');
        const edges   = extractSection(body, 'edge cases');

        let out = '';
        if (modeSkill) {
            out += `---\nname: ${get('name')}\n`;
            if (desc) out += `description: ${desc}\n`;
            out += `---\n\n`;
        }
        if (desc)    out += `${desc}\n\n`;
        if (when)    out += `## When to Use\n\n${when}\n\n`;
        if (instr)   out += `## Instructions\n\n${instr}\n\n`;
        if (outputs) out += `## Expected Outputs\n\n${outputs}\n\n`;
        if (rules)   out += `## Hard Rules\n\n${rules}\n\n`;
        if (edges)   out += `## Edge Cases\n\n${edges}\n\n`;
        out += `## Task\n\n$ARGUMENTS`;

        const previewEl = document.getElementById('i-preview');
        if (previewEl) previewEl.textContent = out;
    }

    async function _doInstall() {
        if (!loadedFile) return;
        const btn = document.getElementById('i-btn-install');
        if (btn) btn.disabled = true;

        _showStatus('Installing…', 'info');

        try {
            const result = await window.skillforge.installSkill({
                filePath: loadedFile.filePath,
                modeSkill,
            });

            if (result.error === 'EEXIST') {
                if (btn) btn.disabled = false;
                const overwrite = window.confirm(
                    `Already installed at:\n${result.installPath}\n\nOverwrite?`
                );
                if (!overwrite) {
                    _showStatus('Installation cancelled.', 'warning');
                    return;
                }
                if (btn) btn.disabled = true;
                const r2 = await window.skillforge.installSkillOverwrite({
                    filePath: loadedFile.filePath,
                    modeSkill,
                });
                if (r2.ok) {
                    _showInstallSuccess(r2);
                } else {
                    _showStatus(`Install failed: ${r2.error}`, 'error');
                    if (btn) btn.disabled = false;
                }
            } else if (result.ok) {
                _showInstallSuccess(result);
            } else {
                _showStatus(`Install failed: ${result.error}${result.message ? ' — ' + result.message : ''}`, 'error');
                if (btn) btn.disabled = false;
            }
        } catch (err) {
            _showStatus('Install error: ' + err.message, 'error');
            if (btn) btn.disabled = false;
        }
    }

    function _showInstallSuccess(result) {
        const btn = document.getElementById('i-btn-install');
        if (btn) btn.disabled = false;
        _showStatus(`Installed — use ${result.command} in Claude Code`, 'success');
        document.getElementById('i-info-path').textContent = result.installPath;
        document.getElementById('i-btn-open-folder')?.classList.remove('hidden');
    }

    function _showStatus(msg, type) {
        const el = document.getElementById('i-status');
        if (!el) return;
        if (!msg || !type) { el.classList.add('hidden'); el.textContent = ''; return; }
        el.classList.remove('hidden', 'status-success', 'status-error', 'status-warning', 'status-info');
        if (type) el.classList.add(`status-${type}`);
        el.textContent = msg;
    }

    window.InstallView = { mount };
})();
