// ==========================================================================
// core/router.js — Hash routing and tab chrome
//
// The views registry is the single source of truth: navigation buttons, tab
// panels and routes are all derived from it, so adding a tab means adding a
// view file and nothing else.
// ==========================================================================

import { h, icon, qsa } from './dom.js';

let views = [];
let current = null;

/** Split '#folios/a/b' into ['folios', 'a', 'b']. */
function parseHash() {
    const raw = (window.location.hash || '').replace(/^#\/?/, '');
    return raw.split('/').filter(Boolean).map(decodeURIComponent);
}

export function go(...segments) {
    window.location.hash = segments.filter((s) => s !== null && s !== undefined && s !== '').join('/');
}

function activate(view) {
    for (const tab of qsa('.nav-tab, .mobile-tab')) {
        const match = tab.dataset.tab === view.id;
        tab.classList.toggle('active', match);
        tab.setAttribute('aria-selected', String(match));
    }
    for (const section of qsa('.tab-content')) {
        const match = section.id === `section-${view.id}`;
        section.classList.toggle('active', match);
        section.toggleAttribute('aria-hidden', !match);
    }
    current = view;
}

function dispatch() {
    const [id, ...rest] = parseHash();
    const view = views.find((v) => v.id === id) || views[0];

    if (view !== current) activate(view);
    if (view.route) view.route(rest);
}

// --------------------------------------------------------------------------
// Chrome built from the registry
// --------------------------------------------------------------------------
function navButton(view, { mobile }) {
    const cls = mobile ? 'button.mobile-tab' : 'button.nav-tab';
    return h(cls, {
        role: 'tab',
        'aria-selected': 'false',
        'aria-controls': `section-${view.id}`,
        dataset: { tab: view.id },
        onClick: () => go(view.id),
    },
        icon(view.nav.icon),
        mobile ? h('span', {}, view.nav.short) : ` ${view.nav.label}`,
    );
}

/**
 * @param {Array} registry view modules, in navigation order
 * @param {{main: HTMLElement, nav: HTMLElement, mobileNav: HTMLElement}} slots
 */
export function initRouter(registry, slots) {
    views = registry;

    for (const view of views) {
        slots.nav.appendChild(navButton(view, { mobile: false }));
        slots.mobileNav.appendChild(navButton(view, { mobile: true }));
        slots.main.appendChild(
            h(`section#section-${view.id}.tab-content`, {
                role: 'tabpanel',
                'aria-label': view.nav.short,
            }, view.render()),
        );
    }

    window.addEventListener('hashchange', dispatch);
    dispatch();
}
