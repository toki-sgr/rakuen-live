// ==========================================================================
// modules/dom.js — DOM Utility Helpers & Shared Pure Functions
// ==========================================================================

/**
 * Show element by removing the 'hidden' class.
 * @param {HTMLElement|null} el
 */
export function show(el) {
    if (el) el.classList.remove('hidden');
}

/**
 * Hide element by adding the 'hidden' class.
 * @param {HTMLElement|null} el
 */
export function hide(el) {
    if (el) el.classList.add('hidden');
}

/**
 * Check if element is currently visible (does not have 'hidden' class).
 * @param {HTMLElement|null} el
 * @returns {boolean}
 */
export function isVisible(el) {
    return el && !el.classList.contains('hidden');
}

/**
 * Toggle active class on a list of siblings, marking only the target active.
 * @param {NodeList|HTMLElement[]} items
 * @param {HTMLElement} target
 */
export function setActive(items, target) {
    items.forEach(item => item.classList.remove('active'));
    if (target) target.classList.add('active');
}

/**
 * Get an element by ID.
 * @param {string} id
 * @returns {HTMLElement|null}
 */
export function el(id) {
    return document.getElementById(id);
}

/**
 * Query selector shorthand.
 * @param {string} selector
 * @param {HTMLElement} [context=document]
 * @returns {HTMLElement|null}
 */
export function qs(selector, context = document) {
    return context.querySelector(selector);
}

/**
 * Query selector all shorthand.
 * @param {string} selector
 * @param {HTMLElement} [context=document]
 * @returns {NodeList}
 */
export function qsa(selector, context = document) {
    return context.querySelectorAll(selector);
}

/**
 * Escape HTML special characters to prevent XSS.
 * Shared utility used by blog.js and folios.js.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Create a DOM element with attributes and children.
 * @param {string} tag
 * @param {Object} [attrs={}]
 * @param {Array<HTMLElement|string>|string} [children=[]]
 * @returns {HTMLElement}
 */
export function createElement(tag, attrs = {}, children = []) {
    const element = document.createElement(tag);
    Object.entries(attrs).forEach(([key, val]) => {
        if (key === 'className') {
            element.className = val;
        } else if (key.startsWith('on') && typeof val === 'function') {
            element.addEventListener(key.substring(2).toLowerCase(), val);
        } else if (key === 'style' && typeof val === 'object') {
            Object.assign(element.style, val);
        } else {
            element.setAttribute(key, val);
        }
    });

    if (typeof children === 'string') {
        element.textContent = children;
    } else if (Array.isArray(children)) {
        children.forEach(child => {
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else if (child instanceof HTMLElement) {
                element.appendChild(child);
            }
        });
    }

    return element;
}

/**
 * Run Web Animations API animation on element safely.
 * @param {HTMLElement} element
 * @param {Keyframe[]|PropertyIndexedKeyframes} keyframes
 * @param {KeyframeAnimationOptions|number} options
 * @returns {Animation}
 */
export function animate(element, keyframes, options) {
    if (element && typeof element.animate === 'function') {
        return element.animate(keyframes, options);
    }
    return null;
}

/**
 * Utility to listen for CSS transition end with a safety timeout fallback.
 * @param {HTMLElement} element
 * @param {Function} callback
 * @param {number} [timeoutMs=400]
 */
export function onTransitionEnd(element, callback, timeoutMs = 400) {
    if (!element) {
        callback();
        return;
    }
    let called = false;
    const handler = () => {
        if (!called) {
            called = true;
            element.removeEventListener('transitionend', handler);
            callback();
        }
    };
    element.addEventListener('transitionend', handler);
    setTimeout(handler, timeoutMs);
}
