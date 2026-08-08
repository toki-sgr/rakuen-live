// ==========================================================================
// core/dom.js — Element construction
//
// Views build DOM with h() rather than innerHTML strings. Text passed to h()
// becomes a text node, so it cannot be interpreted as markup and there is no
// escaping step to forget.
// ==========================================================================

const TAG = /^([a-z0-9]+)?(#[\w-]+)?((?:\.[\w-]+)*)$/i;

/**
 * Create an element.
 *
 *   h('div.book-card', { onClick: open }, h('h4', {}, novel.title))
 *   h('i.fa-solid.fa-play')
 *
 * @param {string} spec tag with optional #id and .class shorthand
 * @param {Object} [props] attributes; `class`, `style`, `dataset`, on* handlers
 * @param {...(Node|string|number|Array|null|false)} children
 * @returns {HTMLElement}
 */
export function h(spec, props = {}, ...children) {
    const parsed = TAG.exec(spec);
    if (!parsed) throw new Error(`h(): cannot parse "${spec}" — write tag#id.class, in that order`);

    const [, tag = 'div', id, classes] = parsed;
    const node = document.createElement(tag);

    if (id) node.id = id.slice(1);
    if (classes) node.className = classes.slice(1).split('.').join(' ');

    for (const [key, value] of Object.entries(props || {})) {
        if (value === null || value === undefined || value === false) continue;

        if (key === 'class') {
            node.className = [node.className, value].filter(Boolean).join(' ');
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(node.style, value);
        } else if (key === 'dataset') {
            Object.assign(node.dataset, value);
        } else if (key === 'html') {
            node.innerHTML = value;
        } else if (key.startsWith('on') && typeof value === 'function') {
            node.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (value === true) {
            node.setAttribute(key, '');
        } else {
            node.setAttribute(key, value);
        }
    }

    append(node, children);
    return node;
}

/** Append children of any shape, flattening arrays and dropping empties. */
export function append(parent, children) {
    for (const child of children.flat(Infinity)) {
        if (child === null || child === undefined || child === false || child === '') continue;
        parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return parent;
}

/** Replace a node's contents in one shot. */
export function fill(parent, ...children) {
    if (!parent) return parent;
    parent.replaceChildren();
    return append(parent, children);
}

export const qs = (selector, root = document) => root.querySelector(selector);
export const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

export const show = (node) => node && node.classList.remove('hidden');
export const hide = (node) => node && node.classList.add('hidden');
export const toggle = (node, visible) => node && node.classList.toggle('hidden', !visible);
export const visible = (node) => !!node && !node.classList.contains('hidden');

/** An icon element. */
export const icon = (name) => h(`i.${name.trim().split(/\s+/).join('.')}`);

/** Restart a CSS entrance animation that is already on the element. */
export function replay(node, className) {
    if (!node) return;
    node.classList.remove(className);
    void node.offsetWidth;
    node.classList.add(className);
}

/** Scroll a pane back to the top, following whichever element actually scrolls. */
export function scrollToTop(paneSelector, fallbackNode) {
    if (window.innerWidth < 850) {
        if (fallbackNode) fallbackNode.scrollIntoView({ behavior: 'auto', block: 'start' });
        return;
    }
    const pane = qs(paneSelector);
    if (pane) pane.scrollTop = 0;
}
