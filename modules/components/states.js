// ==========================================================================
// components/states.js — Placeholder blocks for loading, empty and failed panes
// ==========================================================================

import { h, icon } from '../core/dom.js';

// `modifier` adds an extra class, e.g. '.loading-state-grid' inside a card grid.
export const loading = (text, modifier = '') =>
    h(`div.loading-state${modifier}`, {}, icon('fa-solid fa-spinner fa-spin'), ` ${text}`);

export const failed = (text, modifier = '') =>
    h(`div.loading-state.text-danger${modifier}`, {}, icon('fa-solid fa-circle-exclamation'), ` ${text}`);

export const empty = (text, modifier = '', name = 'fa-regular fa-folder-open') =>
    h(`div.loading-state${modifier}`, {}, icon(name), ` ${text}`);

/** The large "nothing selected yet" block that fills a reading pane. */
export const placeholder = (text) =>
    h('div.pane-empty-state', {}, icon('fa-solid fa-book-open'), h('p', {}, text));
