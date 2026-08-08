// ==========================================================================
// components/readingLayout.js — The list-plus-reader layout
//
// 楽園随笔 and 朝花夕拾 are the same screen: an index down the left, one
// article on the right, and an operations menu that only exists in edit mode.
// Both are built from the pieces here.
// ==========================================================================

import { fill, h, icon, qsa, replay, scrollToTop, toggle } from '../core/dom.js';
import { placeholder } from './states.js';

/**
 * Index column plus reading column.
 *
 * @param {{prefix: string, newLabel: string, onNew: Function, emptyText: string}} options
 *   `prefix` selects the existing class family — 'blog' or 'folios'.
 */
export function createSplitPane({ prefix, newLabel, onNew, emptyText }) {
    const newButton = h('button.btn-primary.btn-new-post.hidden', { onClick: onNew },
        icon('fa-solid fa-plus'), ` ${newLabel}`);

    const list = h(`div#${prefix}-list.posts-list-small`);
    const main = h(`div.${prefix}-main-pane`);
    const empty = placeholder(emptyText);

    const root = h(`div.${prefix}-split-container`, {},
        h(`div.${prefix}-sidebar-list`, {},
            h('div.blog-list-header', {}, h('div.edit-mode-controls', {}, newButton)),
            list,
        ),
        main,
    );

    return {
        root,
        list,
        main,
        /** Swap what the reading column shows; no argument means the placeholder. */
        show(node) { fill(main, node || empty); },
        showEmpty() { fill(main, empty); },
        setNewVisible(isVisible) { toggle(newButton, isVisible); },
    };
}

/**
 * One article: a title, a meta line, rendered markdown, and optional footer.
 *
 * @param {{onEdit: Function, onDelete: Function, editLabel: string,
 *          deleteLabel: string, paneSelector: string}} options
 */
export function createArticlePane({ onEdit, onDelete, editLabel, deleteLabel, paneSelector }) {
    const ops = h('div.post-ops.hidden', {},
        h('button.btn-op.btn-edit', { onClick: onEdit }, icon('fa-solid fa-pencil'), ` ${editLabel}`),
        h('button.btn-op.btn-delete', { onClick: onDelete }, icon('fa-solid fa-trash-can'), ` ${deleteLabel}`),
    );

    const title = h('h1');
    const meta = h('div.post-detail-meta');
    const body = h('div.markdown-body');
    const footer = h('div.chapter-nav-buttons');

    const article = h('article.blog-post-article-pane.animate-fade-in', {},
        h('header.post-detail-header', {}, title, meta),
        body,
        footer,
    );

    const root = h('div', {}, h('div.pane-header', {}, ops), article);

    return {
        root,
        body,
        footer,
        setTitle(text) { fill(title, text); },
        setMeta(...nodes) { fill(meta, nodes); },
        setOpsVisible(isVisible) { toggle(ops, isVisible); },
        /** Re-run the fade-in and return the reader to the top of the article. */
        reveal() {
            replay(article, 'animate-fade-in');
            scrollToTop(paneSelector, root);
        },
    };
}

/** Render sidebar entries, remembering which key each one carries. */
export function renderItems(container, items, build) {
    fill(container, items.map((item) => {
        const node = build(item);
        node.classList.add('post-item-small');
        return node;
    }));
}

/** Highlight the entry whose dataset matches, clearing the others. */
export function markActive(container, matches) {
    for (const item of qsa('.post-item-small', container)) {
        item.classList.toggle('active', matches(item.dataset));
    }
}
