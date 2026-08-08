// ==========================================================================
// core/markdown.js — Markdown rendering
//
// marked and highlight.js are bundled rather than pulled from a CDN: the
// version is pinned by package.json, there is no render-blocking request, and
// the parser cannot be missing at the moment a page needs it.
// ==========================================================================

import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: false });

// highlight.js is most of the weight and most pages here are prose, so it is
// fetched as its own chunk the first time a document actually contains code.
let highlighter = null;
const loadHighlighter = () =>
    (highlighter = highlighter || import('highlight.js/lib/common').then((m) => m.default));

/**
 * Render markdown into a container, highlighting code blocks once loaded.
 *
 * @param {string} [assets] URL of the entry's bundle. Relative image paths are
 *   resolved against it, so `![](某张配图.png)` works from inside a page bundle
 *   even though the page itself lives at a hash route.
 */
export function renderMarkdown(container, source, assets = '') {
    if (!container) return;

    container.innerHTML = marked.parse(source || '');

    if (assets) {
        const base = assets.replace(/\/$/, '');
        for (const media of container.querySelectorAll('img[src], audio[src], video[src], source[src]')) {
            const src = media.getAttribute('src');
            if (src && !/^([a-z]+:|\/\/|\/|#)/i.test(src)) {
                media.setAttribute('src', `${base}/${src.replace(/^\.\//, '')}`);
            }
        }
    }

    const blocks = container.querySelectorAll('pre code');
    if (!blocks.length) return;

    loadHighlighter().then((hljs) => {
        for (const block of blocks) {
            try {
                hljs.highlightElement(block);
            } catch {
                // A language highlight.js cannot handle is not worth breaking the page.
            }
        }
    });
}
