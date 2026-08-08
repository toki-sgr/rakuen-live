// ==========================================================================
// core/toast.js — Transient notices and confirmation dialogs
// ==========================================================================

import { h, icon } from './dom.js';

const ICONS = {
    success: 'fa-solid fa-circle-check',
    error: 'fa-solid fa-circle-exclamation',
    info: 'fa-solid fa-circle-info',
};

let container = null;

function getContainer() {
    if (!container) {
        container = h('div.toast-container');
        document.body.appendChild(container);
    }
    return container;
}

/**
 * @param {string} message
 * @param {'success'|'error'|'info'} [type]
 */
export function toast(message, type = 'info', duration = 3000) {
    const node = h(`div.toast.${type}`, {}, icon(ICONS[type] || ICONS.info), h('span', {}, message));
    getContainer().appendChild(node);

    setTimeout(() => {
        node.classList.add('fade-out');
        node.addEventListener('animationend', () => node.remove());
        setTimeout(() => node.remove(), 300);
    }, duration);
}

/**
 * A modal yes/no question.
 * @returns {Promise<boolean>}
 */
export function confirmDialog(message, confirmText = '确认', cancelText = '取消') {
    return new Promise((resolve) => {
        const close = (result) => {
            overlay.classList.add('fade-out');
            setTimeout(() => overlay.remove(), 200);
            resolve(result);
        };

        const overlay = h('div.modal-overlay.animate-fade-in', {
            onClick: (e) => { if (e.target === overlay) close(false); },
        },
            h('div.modal-card.modal-card-confirm', {},
                h('div.modal-header', {},
                    h('h3', {}, '提示确认'),
                    h('button.btn-close-modal', { onClick: () => close(false), html: '&times;' }),
                ),
                h('div.modal-body', {}, h('p.confirm-message', {}, message)),
                h('div.modal-footer', {},
                    h('button.btn-secondary', { onClick: () => close(false) }, cancelText),
                    h('button.btn-primary.btn-danger', { onClick: () => close(true) }, confirmText),
                ),
            ),
        );

        document.body.appendChild(overlay);
    });
}
