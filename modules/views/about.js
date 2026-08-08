// ==========================================================================
// views/about.js — 关于園長
// ==========================================================================

import { h, icon } from '../core/dom.js';
import { about } from '../../data/site.js';

export default {
    id: 'about',
    nav: { icon: 'fa-solid fa-user', label: '关于園長 / About', short: '关于' },

    render: () => [
        h('div.section-header', {},
            h('h2', {}, about.title),
            h('p.section-subtitle', {}, about.subtitle),
        ),
        h('div.about-wrapper', {},
                h('div.about-card', {},
                    h('div.about-title-row', {},
                        h('div.about-avatar', {},
                            h('img.about-avatar-img', { src: about.avatar, alt: about.name })),
                        h('div', {},
                            h('h3', {}, about.name),
                            h('p.about-subtitle-text', {}, about.tagline),
                        ),
                    ),
                    h('div.about-body-text', {}, about.paragraphs.map((text) => h('p', {}, text))),
                    h('div.about-actions', {}, about.links.map((link) =>
                        h('a.about-btn', {
                            href: link.href,
                            target: link.href.startsWith('mailto:') ? null : '_blank',
                            rel: link.href.startsWith('mailto:') ? null : 'noopener noreferrer',
                        }, icon(link.icon), ` ${link.label}`),
                    )),
                ),
            ),
    ],
};
