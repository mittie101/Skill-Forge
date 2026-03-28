'use strict';

(function () {
    // ── Global state ──
    const state = {
        currentView:      'builder',
        hasUnsavedOutput: false,
        isGenerating:     false,
        settings:         {},
    };

    // ── Unsaved-changes guard ──
    // Returns true if caller may proceed, false if user cancelled.
    function checkUnsavedChanges(msg) {
        if (!state.hasUnsavedOutput) return true;
        return window.confirm(msg ?? 'You have unsaved output. Discard it and continue?');
    }

    // ── View definitions ──
    const VIEWS = {
        generator: { mount: () => window.GeneratorView?.mount(document.getElementById('view-generator')) },
        builder:   {
            mount:  () => window.BuilderView?.mount(document.getElementById('view-builder')),
            onHide: () => window.BuilderView?.onHide?.(),
            onShow: () => window.BuilderView?.onShow?.(),
        },
        install:   { mount: () => window.InstallView?.mount(document.getElementById('view-install'))   },
        review:    {
            mount:  () => window.ReviewView?.mount(document.getElementById('view-review')),
            onHide: () => window.ReviewView?.unmount?.(),
        },
        openclaw:  { mount: () => window.OpenClawView?.mount(document.getElementById('view-openclaw')) },
        history:   { mount: () => window.HistoryView?.mount(document.getElementById('view-history'))   },
        settings:  { mount: () => window.SettingsView?.mount(document.getElementById('view-settings')) },
    };

    const mounted = new Set();

    function showView(viewId, opts = {}) {
        if (!VIEWS[viewId]) return;
        if (!opts.skipGuard && viewId !== state.currentView) {
            if (!checkUnsavedChanges()) return;
        }

        // Notify the departing view so it can stop intervals and listeners
        const prev = state.currentView;
        if (prev && prev !== viewId && VIEWS[prev]?.onHide) {
            VIEWS[prev].onHide();
        }

        document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));

        document.getElementById(`view-${viewId}`)?.classList.add('active');
        document.querySelector(`.nav-btn[data-view="${viewId}"]`)?.classList.add('active');

        if (!mounted.has(viewId)) {
            VIEWS[viewId].mount();
            mounted.add(viewId);
        } else {
            // View already mounted — notify so it can restart any paused activity
            VIEWS[viewId]?.onShow?.();
        }

        state.currentView = viewId;
    }

    // ── Sidebar navigation ──
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const viewId = btn.dataset.view;
            if (viewId && viewId !== state.currentView) showView(viewId);
        });
    });

    // ── Keyboard shortcuts (renderer keydown only — never globalShortcut) ──
    document.addEventListener('keydown', e => {
        const tag = e.target?.tagName;
        const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

        if (e.key === 'Escape') {
            _closeShortcutsModal();
        } else if (e.key === '?' && !inInput) {
            e.preventDefault();
            _toggleShortcutsModal();
        } else if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            if (!state.isGenerating) window.GeneratorView?.triggerGenerate?.();
        } else if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            window.GeneratorView?.triggerSave?.();
        } else if (e.ctrlKey && e.key === 'b' && !inInput) {
            e.preventDefault();
            if (state.currentView !== 'builder') showView('builder', { skipGuard: true });
            window.BuilderView?.triggerBuild?.();
        }
    });

    // ── Shortcuts modal ──
    function _toggleShortcutsModal() {
        const modal = document.getElementById('shortcuts-modal');
        if (modal) modal.classList.toggle('hidden');
    }

    function _closeShortcutsModal() {
        document.getElementById('shortcuts-modal')?.classList.add('hidden');
    }

    document.getElementById('shortcuts-close')?.addEventListener('click', _closeShortcutsModal);
    document.getElementById('shortcuts-modal')?.addEventListener('click', e => {
        if (e.target === e.currentTarget) _closeShortcutsModal();
    });

    // ── App close guard ──
    window.addEventListener('beforeunload', e => {
        if (state.hasUnsavedOutput || state.isGenerating) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    // ── Init ──
    async function init() {
        try {
            state.settings = await window.skillforge.loadSettings();
        } catch { /* use defaults */ }
        // Apply persisted theme before first paint
        document.documentElement.setAttribute(
            'data-theme', state.settings.darkMode ? 'dark' : 'light'
        );
        showView('builder', { skipGuard: true });

        // Auto-updater events
        window.skillforge.onUpdateAvailable(info => {
            Toast.show(`Update v${info.version} downloading…`, 'info');
        });
        window.skillforge.onUpdateDownloaded(info => {
            Toast.show(`v${info.version} ready — restart to install`, 'info', {
                action: { label: 'Restart', onClick: () => window.skillforge.installUpdate() },
            });
        });
        window.skillforge.onUpdateError(() => {
            // Silent in UI — update failures are non-fatal; log nothing to console
        });

        // First-run: check if any API key is configured
        try {
            const [hasAnthropic, hasOpenAI] = await Promise.all([
                window.skillforge.hasApiKey('anthropic'),
                window.skillforge.hasApiKey('openai'),
            ]);
            if (!hasAnthropic && !hasOpenAI) {
                setTimeout(() => {
                    Toast.show('Welcome! Add an API key in Settings before generating.', 'info');
                }, 1000);
            }
        } catch { /* non-fatal */ }
    }

    window.App = { showView, state, checkUnsavedChanges };
    init();
})();
