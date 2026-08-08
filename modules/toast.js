// ==========================================================================
// modules/toast.js — Global Toast Notifications & Custom Confirm Dialog
// ==========================================================================

let toastContainer = null;

function getToastContainer() {
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    return toastContainer;
}

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'info'} [type='info']
 * @param {number} [duration=3000]
 */
export function showToast(message, type = 'info', duration = 3000) {
    const container = getToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const iconMap = {
        success: 'fa-solid fa-circle-check',
        error: 'fa-solid fa-circle-exclamation',
        info: 'fa-solid fa-circle-info',
    };

    toast.innerHTML = `
        <i class="${iconMap[type] || iconMap.info}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        });
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
    }, duration);
}

/**
 * Show a custom confirmation dialog.
 * @param {string} message
 * @param {string} [confirmText='确认']
 * @param {string} [cancelText='取消']
 * @returns {Promise<boolean>}
 */
export function confirmDialog(message, confirmText = '确认', cancelText = '取消') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay animate-fade-in';

        overlay.innerHTML = `
            <div class="modal-card modal-card-confirm">
                <div class="modal-header">
                    <h3>提示确认</h3>
                    <button class="btn-close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <p style="margin: 0; font-size: 0.95rem; line-height: 1.6; color: var(--text-primary);">${message}</p>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary btn-cancel-dialog">${cancelText}</button>
                    <button class="btn-primary btn-confirm-dialog" style="background-color: var(--color-danger); border-color: var(--color-danger);">${confirmText}</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const close = (result) => {
            overlay.classList.add('fade-out');
            setTimeout(() => {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            }, 200);
            resolve(result);
        };

        overlay.querySelector('.btn-confirm-dialog').addEventListener('click', () => close(true));
        overlay.querySelector('.btn-cancel-dialog').addEventListener('click', () => close(false));
        overlay.querySelector('.btn-close-modal').addEventListener('click', () => close(false));

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close(false);
        });
    });
}
