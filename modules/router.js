// ==========================================================================
// modules/router.js — Hash-Based Routing
// ==========================================================================

import { switchTab } from './ui.js';
import {
    loadBlogPostDetail,
    closePostDetail,
    fetchBlogList,
} from './blog.js';
import {
    showBookshelf,
    loadNovelDetail,
    loadChapterDetail,
} from './folios.js';

const VALID_TABS = ['hub', 'about', 'blog', 'folios'];

/**
 * Parse and dispatch current URL hash to the appropriate view.
 */
export function handleHashRouting() {
    const hash = window.location.hash || '#hub';

    if (hash.startsWith('#blog/')) {
        const slug = hash.replace('#blog/', '');
        switchTab('blog');
        if (slug) loadBlogPostDetail(slug);

    } else if (hash.startsWith('#folios/')) {
        switchTab('folios');
        const parts = hash.replace('#folios/', '').split('/');
        const novelSlug = parts[0];

        if (parts.length === 1) {
            // #folios/{novelSlug}
            loadNovelDetail(novelSlug);

        } else if (parts.length === 2) {
            const second = parts[1];
            if (/^\d+$/.test(second)) {
                // #folios/{novelSlug}/{chapterNum}
                loadChapterDetail(novelSlug, parseInt(second, 10), null);
            } else {
                // #folios/{novelSlug}/{sideSlug}
                loadNovelDetail(novelSlug, null, second);
            }

        } else if (parts.length === 3) {
            // #folios/{novelSlug}/{sideSlug}/{chapterNum}
            const sideSlug   = parts[1];
            const chapterNum = parseInt(parts[2], 10);
            loadChapterDetail(novelSlug, chapterNum, sideSlug);
        }

    } else {
        const tabId = hash.replace('#', '');
        if (VALID_TABS.includes(tabId)) {
            switchTab(tabId);
            if (tabId === 'blog') {
                closePostDetail();
            } else if (tabId === 'folios') {
                showBookshelf();
            }
        }
    }
}

export function initRouter() {
    window.addEventListener('hashchange', handleHashRouting);
}
