'use strict';

(function () {
    // ── Global state ──
    const state = {
        currentView:      'generator',
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
        history:   { mount: () => window.HistoryView?.mount(document.getElementById('view-history')) },
        settings:  { mount: () => window.SettingsView?.mount(document.getElementById('view-settings')) },
    };

    const mounted = new Set();

    function showView(viewId, opts = {}) {
        if (!VIEWS[viewId]) return;
        if (!opts.skipGuard && viewId !== state.currentView) {
            if (!checkUnsavedChanges()) return;
        }

        document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));

        document.getElementById(`view-${viewId}`)?.classList.add('active');
        document.querySelector(`.nav-btn[data-view="${viewId}"]`)?.classList.add('active');

        if (!mounted.has(viewId)) {
            VIEWS[viewId].mount();
            mounted.add(viewId);
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
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            if (!state.isGenerating) window.GeneratorView?.triggerGenerate?.();
        } else if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            window.GeneratorView?.triggerSave?.();
        } else if (e.ctrlKey && e.key === 'n') {
            e.preventDefault();
            if (checkUnsavedChanges('You have unsaved output. Clear form anyway?')) {
                if (state.currentView !== 'generator') showView('generator', { skipGuard: true });
                window.GeneratorView?.clearForm?.();
            }
        }
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
        } catch (err) {
            console.warn('[App] Could not load settings:', err);
        }
        showView('generator', { skipGuard: true });
        console.log('[SkillForge] Phase 5 ready.');
    }

    window.App = { showView, state, checkUnsavedChanges };
    init();
})();
