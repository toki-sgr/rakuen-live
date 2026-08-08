// ==========================================================================
// core/edit.js — Edit mode: the password gate and who to tell about it
//
// Views do not read a global flag directly; they subscribe, so entering or
// leaving edit mode refreshes every tab at once.
// ==========================================================================

import { setAuthToken, verifyPassword } from './api.js';
import { h, hide, icon, show } from './dom.js';
import { toast } from './toast.js';

const STORAGE_KEY = 'rakuen_auth_token';

let active = false;
const listeners = new Set();

export const isEditing = () => active;

/** @param {(active: boolean) => void} fn @returns {() => void} unsubscribe */
export function onEditChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

function setActive(next) {
    active = next;
    document.body.classList.toggle('is-editing', active);

    for (const button of document.querySelectorAll('.btn-toggle-edit-global')) {
        button.replaceChildren(
            icon(active ? 'fa-solid fa-unlock' : 'fa-solid fa-lock'),
            document.createTextNode(active ? ' 退出编辑' : ' 进入编辑'),
        );
        button.classList.toggle('active-edit', active);
    }

    listeners.forEach((fn) => fn(active));
}

// --------------------------------------------------------------------------
// Password modal
// --------------------------------------------------------------------------
let modal = null;

function buildModal() {
    const input = h('input', { type: 'password', placeholder: '输入口令...' });
    const error = h('div.error-msg.hidden');
    const confirm = h('button.btn-primary', {}, '确认');
    const eye = h('button.btn-toggle-password-visibility', {
        type: 'button',
        title: '显示/隐藏口令',
        onClick: () => {
            const masked = input.type === 'password';
            input.type = masked ? 'text' : 'password';
            eye.replaceChildren(icon(masked ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'));
        },
    }, icon('fa-regular fa-eye'));

    const close = () => hide(overlay);

    const fail = (message) => {
        error.textContent = message;
        error.classList.remove('shake');
        void error.offsetWidth;
        error.classList.add('shake');
        show(error);
        input.select();
    };

    const submit = async () => {
        const password = input.value.trim();
        if (!password) return fail('请输入操作口令');

        confirm.disabled = true;
        confirm.textContent = '验证中...';
        try {
            await verifyPassword(password);
            sessionStorage.setItem(STORAGE_KEY, password);
            setAuthToken(password);
            close();
            setActive(true);
            toast('已进入编辑模式', 'success');
        } catch (err) {
            fail(err.message || '口令错误，请重新输入');
        } finally {
            confirm.disabled = false;
            confirm.textContent = '确认';
        }
    };

    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    confirm.addEventListener('click', submit);

    const overlay = h('div.modal-overlay.hidden', {
        onClick: (e) => { if (e.target === overlay) close(); },
    },
        h('div.modal-card', {},
            h('div.modal-header', {},
                h('h3', {}, '验证身份'),
                h('button.btn-close-modal', { onClick: close, html: '&times;' }),
            ),
            h('div.modal-body', {},
                h('p', {}, '请输入操作口令以进入编辑模式：'),
                h('div.password-input-group', {},
                    h('div.password-input-wrapper', {}, input, eye),
                    error,
                ),
            ),
            h('div.modal-footer', {},
                h('button.btn-secondary', { onClick: close }, '取消'),
                confirm,
            ),
        ),
    );

    document.body.appendChild(overlay);
    return { overlay, input, error };
}

function promptPassword() {
    if (!modal) modal = buildModal();
    modal.input.value = '';
    hide(modal.error);
    show(modal.overlay);
    setTimeout(() => modal.input.focus(), 50);
}

// --------------------------------------------------------------------------
export function initEditMode() {
    // A token from earlier in this session means the password was already
    // accepted; re-arm the client without re-prompting.
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) setAuthToken(saved);

    for (const button of document.querySelectorAll('.btn-toggle-edit-global')) {
        button.addEventListener('click', () => {
            if (!active) return promptPassword();

            sessionStorage.removeItem(STORAGE_KEY);
            setAuthToken('');
            setActive(false);
            toast('已退出编辑模式', 'info');
        });
    }

    setActive(false);
}
