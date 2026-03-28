'use strict';

(function () {
    let _searchSeq     = 0;
    let _debounceTimer = null;

    async function mount(container) {
        container.innerHTML = _html();
        _bindAll();
        await _loadHistory();
        await _checkPrivacy();
    }

    function _html() {
        return `
        <div class="history-layout">
          <div class="history-header">
            <div class="history-controls">
              <div class="search-wrap">
                <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input id="history-search" class="field-input search-input" type="text"
                  placeholder="Search skills…" autocomplete="off">
              </div>
              <select id="history-framework-filter" class="field-select select-fw-filter">
                <option value="">All frameworks</option>
                <option value="claude">Claude</option>
                <option value="chatgpt">ChatGPT</option>
                <option value="langchain">LangChain</option>
              </select>
            </div>
            <div class="history-count-wrap">
              <span id="history-row-count" class="text-muted text-sm">0 skills</span>
              <button id="history-export-btn" class="btn btn-ghost btn-xs" title="Export all history to JSON">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-12">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export JSON
              </button>
            </div>
          </div>

          <div id="banner-privacy" class="banner banner-warning hidden banner-inset-b">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-16 flex-shrink-0">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Privacy mode is active — history is not being recorded.
          </div>

          <div id="banner-history-warn" class="banner banner-warning hidden banner-inset-b">
            Approaching history limit — consider clearing old entries (80+ rows).
          </div>

          <div class="history-body">
            <div id="history-list" class="history-list"></div>
            <div id="history-empty" class="history-empty hidden">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-empty-state">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <p>No skills in history yet.</p>
              <p class="text-sm text-muted">Generate a skill to see it here.</p>
            </div>
          </div>
        </div>`;
    }

    // Shared fetch helper — avoids duplicating the search/list conditional
    async function _fetchRows(query, framework) {
        const q  = (query     ?? '').trim();
        const fw = (framework ?? '') || undefined;
        return q
            ? window.skillforge.searchHistory(q, fw ?? '')
            : window.skillforge.listHistory(fw ? { framework: fw } : {});
    }

    async function _loadHistory(query, framework) {
        try {
            const rows = await _fetchRows(query, framework);
            _renderRows(rows);
            _checkWarnBanner(rows.length);
        } catch (err) {
            Toast.show('Failed to load history', 'error');
        }
    }

    const PAGE_SIZE = 20;

    function _renderRows(rows) {
        const list  = document.getElementById('history-list');
        const empty = document.getElementById('history-empty');
        const count = document.getElementById('history-row-count');
        if (!list) return;

        if (!rows.length) {
            list.innerHTML = '';
            empty?.classList.remove('hidden');
            if (count) count.textContent = '0 skills';
            return;
        }

        empty?.classList.add('hidden');
        if (count) count.textContent = `${rows.length} skill${rows.length !== 1 ? 's' : ''}`;

        list.innerHTML = '';
        let rendered = 0;

        function _renderBatch() {
            const batch = rows.slice(rendered, rendered + PAGE_SIZE);
            batch.forEach(row => list.insertAdjacentHTML('beforeend', _rowHtml(row)));
            rendered += batch.length;
        }

        _renderBatch();

        if (rendered < rows.length) {
            const sentinel = document.createElement('div');
            sentinel.className = 'history-sentinel';
            list.appendChild(sentinel);

            const observer = new IntersectionObserver(entries => {
                if (!entries[0].isIntersecting) return;
                _renderBatch();
                if (rendered >= rows.length) {
                    observer.disconnect();
                    sentinel.remove();
                }
            }, { rootMargin: '100px' });

            observer.observe(sentinel);
        }
    }

    function _rowHtml(row) {
        return `
            <div class="history-row" data-id="${row.id}">
              <div class="history-row-info">
                <span class="history-row-name">${_esc(row.skill_name ?? 'Untitled')}</span>
                <div class="history-row-meta">
                  ${_fwBadge(row.framework)}
                  <span class="history-row-provider text-muted text-sm">${_esc(row.provider ?? '')}</span>
                  ${_costBadge(row.input_tokens, row.output_tokens, row.cost_usd)}
                  <span class="history-row-date text-muted text-sm">${_fmtDate(row.created_at)}</span>
                </div>
              </div>
              <div class="history-row-actions">
                <button class="btn btn-secondary btn-sm btn-reopen" data-id="${row.id}">Re-open</button>
                <button class="btn btn-ghost btn-sm btn-delete" data-id="${row.id}" title="Delete">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-13">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/><path d="M14 11v6"/>
                  </svg>
                </button>
              </div>
            </div>`;
    }

    function _checkWarnBanner(count) {
        document.getElementById('banner-history-warn')?.classList.toggle('hidden', count < 80);
    }

    async function _checkPrivacy() {
        try {
            const s = await window.skillforge.loadSettings();
            document.getElementById('banner-privacy')?.classList.toggle('hidden', !s.privacyMode);
        } catch {}
    }

    function _bindAll() {
        const searchEl = document.getElementById('history-search');

        document.getElementById('history-export-btn')?.addEventListener('click', async () => {
            const btn = document.getElementById('history-export-btn');
            if (btn) btn.disabled = true;
            try {
                const result = await window.skillforge.exportHistory();
                if (result?.ok) {
                    Toast.show('History exported', 'success');
                } else if (result?.error !== 'cancelled') {
                    Toast.show('Export failed: ' + (result?.error ?? 'unknown'), 'error');
                }
            } catch (err) {
                Toast.show('Export failed: ' + err.message, 'error');
            } finally {
                if (btn) btn.disabled = false;
            }
        });

        searchEl?.addEventListener('input', () => {
            clearTimeout(_debounceTimer);
            _debounceTimer = setTimeout(async () => {
                const seq = ++_searchSeq;
                const q   = searchEl.value.trim();
                const fw  = document.getElementById('history-framework-filter')?.value ?? '';
                try {
                    const rows = await _fetchRows(q, fw);
                    // Discard stale results via sequence counter
                    if (seq === _searchSeq) _renderRows(rows);
                } catch {}
            }, 200);
        });

        document.getElementById('history-framework-filter')?.addEventListener('change', () => {
            searchEl?.dispatchEvent(new Event('input'));
        });

        // Row actions — event delegation
        document.getElementById('history-list')?.addEventListener('click', async e => {
            const reopenBtn = e.target.closest('.btn-reopen');
            const deleteBtn = e.target.closest('.btn-delete');

            if (reopenBtn) {
                const id = Number(reopenBtn.dataset.id);
                // Unsaved-changes guard before replacing generator state
                if (!window.App?.checkUnsavedChanges?.('Reopen this skill and discard unsaved output?')) return;
                try {
                    const row = await window.skillforge.reopenHistory(id);
                    if (!row) { Toast.show('Entry not found', 'warning'); return; }
                    window.App.showView('generator', { skipGuard: true });
                    window.GeneratorView?.loadFromHistory?.(row);
                } catch { Toast.show('Failed to reopen entry', 'error'); }
            }

            if (deleteBtn) {
                const id  = Number(deleteBtn.dataset.id);
                const row = deleteBtn.closest('.history-row');
                if (!window.confirm('Delete this history entry?')) return;
                try {
                    await window.skillforge.deleteHistory(id);
                    row?.remove();
                    const remaining = document.querySelectorAll('.history-row').length;
                    const countEl = document.getElementById('history-row-count');
                    if (countEl) countEl.textContent = `${remaining} skill${remaining !== 1 ? 's' : ''}`;
                    if (!remaining) document.getElementById('history-empty')?.classList.remove('hidden');
                    _checkWarnBanner(remaining);
                } catch { Toast.show('Failed to delete entry', 'error'); }
            }
        });
    }

    // Called by settings view when privacy mode changes
    function setPrivacyMode(active) {
        document.getElementById('banner-privacy')?.classList.toggle('hidden', !active);
    }

    function refresh() {
        const q  = document.getElementById('history-search')?.value ?? '';
        const fw = document.getElementById('history-framework-filter')?.value ?? '';
        _loadHistory(q, fw);
    }

    function _fmtDate(iso) {
        try {
            return new Date(iso).toLocaleString(undefined, {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            });
        } catch { return iso; }
    }

    function _costBadge(inputTokens, outputTokens, costUsd) {
        if (costUsd == null && inputTokens == null) return '';
        const total = (inputTokens ?? 0) + (outputTokens ?? 0);
        const costStr = costUsd > 0 ? `$${Number(costUsd).toFixed(4)}` : '';
        const tokStr  = total > 0   ? `${(total / 1000).toFixed(1)}k tok` : '';
        const label   = [tokStr, costStr].filter(Boolean).join(' · ');
        if (!label) return '';
        return `<span class="history-row-cost text-muted text-sm" title="Input: ${inputTokens ?? 0} · Output: ${outputTokens ?? 0} · Cost: $${Number(costUsd ?? 0).toFixed(6)}">${label}</span>`;
    }

    function _fwBadge(fw) {
        const cls = { claude: 'badge-purple', chatgpt: 'badge-green', langchain: 'badge-blue' };
        return `<span class="badge ${cls[fw] ?? 'badge-yellow'}">${_esc(fw ?? '')}</span>`;
    }

    function _esc(str) {
        return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    window.HistoryView = { mount, setPrivacyMode, refresh };
})();
