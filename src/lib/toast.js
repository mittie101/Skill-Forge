'use strict';

(function () {
    const DURATIONS = { success: 3000, error: 5000, warning: 4000, info: 3000 };

    /**
     * Show a toast notification.
     * @param {string} message
     * @param {'success'|'error'|'warning'|'info'} [type='info']
     * @param {{ action?: { label: string, onClick: Function } }} [opts]
     */
    function showToast(message, type = 'info', opts = {}) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icon = _icon(type);
        const text = document.createElement('span');
        text.textContent = message;

        toast.appendChild(icon);
        toast.appendChild(text);

        if (opts.action) {
            const btn = document.createElement('button');
            btn.className = 'btn btn-ghost btn-sm';
            btn.style.marginLeft = '8px';
            btn.textContent = opts.action.label;
            btn.addEventListener('click', () => {
                opts.action.onClick();
                _dismiss(toast);
            });
            toast.appendChild(btn);
        }

        container.appendChild(toast);

        const duration = DURATIONS[type] ?? 3000;
        const timer = setTimeout(() => _dismiss(toast), duration);

        toast.addEventListener('click', () => {
            clearTimeout(timer);
            _dismiss(toast);
        });
    }

    function _dismiss(toast) {
        toast.classList.add('toast-out');
        toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }

    function _icon(type) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.style.cssText = 'width:16px;height:16px;flex-shrink:0';

        const paths = {
            success: '<polyline points="20 6 9 17 4 12"/>',
            error:   '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
            warning: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
            info:    '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
        };
        svg.innerHTML = paths[type] ?? paths.info;
        return svg;
    }

    window.Toast = { show: showToast };
})();
