// ==========================================================================
// modules/ui.js — Global UI: Tabs, Password Modal, Photo Wall, Edit Mode
// ==========================================================================

import { appState } from './state.js';
import { AuthAPI } from './api.js';
import { el, qsa, show, hide, onTransitionEnd } from './dom.js';
import { showToast } from './toast.js';

// --------------------------------------------------------------------------
// Tab Navigation
// --------------------------------------------------------------------------
export function initTabs() {
    const desktopTabs = qsa('.nav-tab');
    const mobileTabs = qsa('.mobile-tab');

    const handleTabClick = (tabEl) => {
        const targetTab = tabEl.getAttribute('data-tab');
        window.location.hash = targetTab;
        switchTab(targetTab);
    };

    desktopTabs.forEach(tab => tab.addEventListener('click', () => handleTabClick(tab)));
    mobileTabs.forEach(tab => tab.addEventListener('click', () => handleTabClick(tab)));
}

export function switchTab(tabId) {
    const desktopTabs = qsa('.nav-tab');
    const mobileTabs = qsa('.mobile-tab');
    const tabContents = qsa('.tab-content');

    desktopTabs.forEach(t => {
        const isMatch = t.getAttribute('data-tab') === tabId;
        t.classList.toggle('active', isMatch);
        t.setAttribute('aria-selected', isMatch ? 'true' : 'false');
    });

    mobileTabs.forEach(t => {
        const isMatch = t.getAttribute('data-tab') === tabId;
        t.classList.toggle('active', isMatch);
        t.setAttribute('aria-selected', isMatch ? 'true' : 'false');
    });

    tabContents.forEach(content => {
        if (content.id === `section-${tabId}`) {
            content.classList.add('active');
            content.removeAttribute('aria-hidden');
        } else {
            content.classList.remove('active');
            content.setAttribute('aria-hidden', 'true');
        }
    });
}

// --------------------------------------------------------------------------
// Password Modal & Authentication
// --------------------------------------------------------------------------
let _passwordCallback = null;

export function initPasswordModal() {
    const modal      = el('password-modal');
    const input      = el('modal-password-input');
    const errorMsg   = el('password-error-msg');
    const btnConfirm = el('btn-confirm-password');
    const btnCancel  = el('btn-cancel-password');
    const btnClose   = el('btn-close-password-modal');
    const toggleEye  = el('btn-toggle-password-visibility');

    const closeModal = () => {
        hide(modal);
        _passwordCallback = null;
    };

    if (btnCancel) btnCancel.addEventListener('click', closeModal);
    if (btnClose) btnClose.addEventListener('click', closeModal);

    if (toggleEye && input) {
        toggleEye.addEventListener('click', () => {
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            toggleEye.innerHTML = isPassword
                ? '<i class="fa-regular fa-eye-slash"></i>'
                : '<i class="fa-regular fa-eye"></i>';
        });
    }

    const submitPassword = async () => {
        const pwd = input.value ? input.value.trim() : '';
        if (!pwd) {
            if (errorMsg) {
                errorMsg.textContent = '请输入操作口令';
                show(errorMsg);
            }
            return;
        }

        try {
            btnConfirm.disabled = true;
            btnConfirm.textContent = '验证中...';
            await AuthAPI.verify(pwd);
            sessionStorage.setItem('rakuen_auth_token', pwd);
            hide(modal);
            showToast('已进入编辑模式', 'success');
            if (_passwordCallback) {
                _passwordCallback(pwd);
                _passwordCallback = null;
            }
        } catch (err) {
            hide(errorMsg);
            if (errorMsg) {
                errorMsg.textContent = err.message || '口令错误，请重新输入';
                errorMsg.offsetHeight; // Force reflow
                errorMsg.classList.add('shake');
                show(errorMsg);
                setTimeout(() => errorMsg.classList.remove('shake'), 400);
            }
            input.select();
        } finally {
            btnConfirm.disabled = false;
            btnConfirm.textContent = '确认';
        }
    };

    if (btnConfirm) btnConfirm.addEventListener('click', submitPassword);
    if (input) {
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') submitPassword();
        });
    }
}

export function promptPassword(callback) {
    _passwordCallback = callback;
    const modal    = el('password-modal');
    const input    = el('modal-password-input');
    const errorMsg = el('password-error-msg');

    if (input) input.value = '';
    if (errorMsg) hide(errorMsg);
    show(modal);
    setTimeout(() => input && input.focus(), 50);
}

// --------------------------------------------------------------------------
// Photo Wall (Sidebar Image Switcher with Crossfade)
// --------------------------------------------------------------------------
export function initPhotoWall() {
    const photoWall = el('photo-wall');
    const photoImg  = el('photo-wall-img');
    if (!photoWall || !photoImg) return;

    const images = [
        'assets/sanctuary_sprout.png',
        'assets/ruined_park.png',
        'assets/ruined_library.png',
    ];
    let currentIndex = 0;
    let isTransitioning = false;

    photoWall.addEventListener('click', () => {
        if (isTransitioning) return;
        isTransitioning = true;

        photoImg.classList.add('fade-out');

        onTransitionEnd(photoImg, () => {
            currentIndex = (currentIndex + 1) % images.length;
            const nextSrc = images[currentIndex];

            const tempImg = new Image();
            tempImg.src = nextSrc;
            tempImg.onload = () => {
                photoImg.src = nextSrc;
                photoImg.classList.remove('fade-out');
                isTransitioning = false;
            };
            tempImg.onerror = () => {
                photoImg.classList.remove('fade-out');
                isTransitioning = false;
            };
        }, 350);
    });
}

// --------------------------------------------------------------------------
// Global Edit Mode Toggle
// --------------------------------------------------------------------------
export function initGlobalEditToggle(onEnter, onExit) {
    const btns = qsa('.btn-toggle-edit-global');
    btns.forEach(btn => btn.addEventListener('click', () => toggleEditMode(onEnter, onExit)));
}

function toggleEditMode(onEnter, onExit) {
    const btns = qsa('.btn-toggle-edit-global');
    const editBanner = el('edit-mode-banner');

    if (!appState.isEditMode) {
        promptPassword(() => {
            appState.isEditMode = true;
            btns.forEach(btn => {
                btn.innerHTML = '<i class="fa-solid fa-unlock"></i> 退出编辑';
                btn.classList.add('active-edit');
            });
            if (editBanner) show(editBanner);
            if (onEnter) onEnter();
        });
    } else {
        appState.isEditMode = false;
        sessionStorage.removeItem('rakuen_auth_token');
        btns.forEach(btn => {
            btn.innerHTML = '<i class="fa-solid fa-lock"></i> 进入编辑';
            btn.classList.remove('active-edit');
        });
        if (editBanner) hide(editBanner);
        showToast('已退出编辑模式', 'info');
        if (onExit) onExit();
    }
}
