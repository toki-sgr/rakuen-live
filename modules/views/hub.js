// ==========================================================================
// views/hub.js — 楽園中枢
// ==========================================================================

import { h, icon } from '../core/dom.js';
import { hub } from '../../data/site.js';

function card(entry) {
    const contents = [
        h(`div.card-status.${entry.statusClass}`, {}, entry.status),
        h('div.card-icon', {}, icon(entry.icon)),
        h('h3', {}, entry.title),
        entry.quote ? h('blockquote', {}, h('em', {}, entry.quote)) : null,
        entry.description ? h('p', {}, entry.description) : null,
        h('span.card-link-text', {}, entry.linkText, ' ', icon(
            entry.disabled ? 'fa-solid fa-lock'
                : entry.external ? 'fa-solid fa-arrow-up-right-from-square'
                    : 'fa-solid fa-arrow-right',
        )),
    ];

    if (entry.disabled) return h('div.hub-card.disabled-card', {}, contents);

    return h('a.hub-card.link-card', {
        href: entry.href,
        target: entry.external ? '_blank' : null,
        rel: entry.external ? 'noopener noreferrer' : null,
    }, contents);
}

export default {
    id: 'hub',
    nav: { icon: 'fa-solid fa-compass', label: '楽園中枢 / Hub', short: '中枢' },

    // An array, not a wrapper: the stylesheet sizes these as direct children
    // of the tab section.
    render: () => [
        h('div.section-header', {},
            h('h2', {}, hub.title),
            h('p.section-subtitle', {}, hub.subtitle),
        ),
        h('div.grid-container', {}, hub.cards.map(card)),
    ],
};
