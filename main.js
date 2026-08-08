// ==========================================================================
// main.js — Application entry point
//
// Builds the shell chrome from data/site.js, then hands the tabs to the
// router. Everything tab-specific lives in its own view module.
// ==========================================================================

import { fill, h, qs } from './modules/core/dom.js';
import { initEditMode } from './modules/core/edit.js';
import { initRouter } from './modules/core/router.js';
import { initPhotoWall } from './modules/components/photoWall.js';
import { views } from './modules/views/index.js';
import { site } from './data/site.js';

function renderChrome() {
    fill(qs('#site-logo'),
        h('a', { href: '/' },
            h('span.logo-rakuen', {}, site.name),
            h('span.logo-live', {}, site.domain),
            ' ',
            h('span.logo-kanji', {}, site.kanji),
        ),
    );

    fill(qs('#copyright'), site.copyright, h('br'), site.credits);

    const wall = qs('#photo-wall');
    fill(wall, h('img.sidebar-image', { src: site.photoWall[0], alt: site.kanji }));
    initPhotoWall(wall);
}

document.addEventListener('DOMContentLoaded', () => {
    renderChrome();
    initEditMode();
    initRouter(views, {
        main: qs('#site-main'),
        nav: qs('#site-nav'),
        mobileNav: qs('#mobile-nav'),
    });
});
