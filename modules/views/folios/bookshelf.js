// ==========================================================================
// views/folios/bookshelf.js — The grid of book covers
//
// A book is a list of volumes. One volume renders a plain card; two or more
// render the flip card, with the second volume on the reverse.
// ==========================================================================

import * as api from '../../core/api.js';
import { fill, h, icon } from '../../core/dom.js';
import { isEditing } from '../../core/edit.js';
import { go } from '../../core/router.js';
import { empty, failed, loading } from '../../components/states.js';
import { sections } from '../../../data/site.js';

const PLACEHOLDER = '/assets/ruined_library.png';

/** Wrap the volume title inside the book title so the active half stands out. */
function volumeHeading(bookTitle, volumeTitle) {
    if (!volumeTitle || !bookTitle.includes(volumeTitle)) return [bookTitle];
    const [before, after] = bookTitle.split(volumeTitle);
    return [before, h('span.book-title-highlight', {}, volumeTitle), after];
}

function face(novel, volume, { className, onFlip, onEdit, onDelete }) {
    const cover = volume.cover || PLACEHOLDER;
    const statusClass = volume.status === '已完结' ? 'completed' : 'serializing';

    return h(`div.${className}`, {
        onClick: (e) => {
            if (e.target.closest('.book-card-actions, .book-card-flip-action')) return;
            go('folios', novel.slug, volume.slug);
        },
    },
        h('div.book-cover-wrapper', { style: { '--cover-url': `url('${cover}')` } },
            h('img.book-cover-img', {
                src: cover,
                alt: volume.title,
                onError: (e) => { e.target.src = PLACEHOLDER; },
            }),
            onFlip ? h('div.book-card-flip-action', {},
                h('button.btn-card-flip', {
                    title: '翻转封面',
                    onClick: (e) => { e.stopPropagation(); onFlip(); },
                }, icon('fa-solid fa-arrows-rotate'), ' 翻转封面'),
            ) : null,
            isEditing() ? h('div.book-card-actions', {},
                h('button.btn-card-edit', {
                    title: '编辑作品',
                    onClick: (e) => { e.stopPropagation(); onEdit(novel); },
                }, icon('fa-solid fa-pencil')),
                h('button.btn-card-delete', {
                    title: '删除作品',
                    onClick: (e) => { e.stopPropagation(); onDelete(novel); },
                }, icon('fa-solid fa-trash-can')),
            ) : null,
        ),
        h('div.book-info', {},
            h('h4.book-title', {},
                novel.volumes.length > 1
                    ? volumeHeading(novel.title, volume.title)
                    : novel.title,
                h(`span.book-status-badge.${statusClass}`, {}, volume.status),
                novel.year ? h('span.book-start-year', {}, novel.year) : null,
            ),
            h('p.book-summary', {}, volume.summary || ''),
            h('div.book-meta', {},
                h('span', {}, icon('fa-regular fa-bookmark'), ` ${novel.kind}`),
                h('span', {}, icon('fa-regular fa-file-lines'), ` ${novel.chapter_count} 章节`),
                h('span', {}, icon('fa-solid fa-pen-nib'), ` ${novel.word_count} 字`),
            ),
        ),
    );
}

function bookCard(novel, handlers) {
    const multi = novel.volumes.length > 1;
    const container = h(`div.book-card-container${multi ? '.reversible-card' : ''}`);
    const onFlip = multi ? () => container.classList.toggle('flipped') : null;

    const faces = [face(novel, novel.volumes[0], { className: 'book-card-front', onFlip, ...handlers })];
    if (multi) {
        faces.push(face(novel, novel.volumes[1], { className: 'book-card-back', onFlip, ...handlers }));
    }

    container.appendChild(h('div.book-card-inner', {}, faces));
    return container;
}

/**
 * @param {{onEdit: Function, onDelete: Function, onNew: Function}} handlers
 */
export function createBookshelf(handlers) {
    const grid = h('div.bookshelf-grid');
    const newButton = h('button.btn-primary.hidden', { onClick: handlers.onNew },
        icon('fa-solid fa-plus'), ' 新增作品');

    const root = h('div#folios-bookshelf-view', {},
        h('div.section-header', {},
            h('div.folios-header-row', {},
                h('div', {},
                    h('h2', {}, sections.folios.title),
                    h('p.section-subtitle', {}, sections.folios.subtitle),
                ),
                h('div.folios-header-actions', {}, newButton),
            ),
        ),
        grid,
    );

    // null until fetched — an empty shelf is a real answer.
    let novels = null;
    let observer = null;

    const paint = () => {
        // Cards from the previous paint are gone; stop watching them.
        if (observer) observer.disconnect();

        if (!novels || !novels.length) {
            fill(grid, empty('书架目前空空如也。', '.loading-state-grid'));
            return;
        }

        // Stagger the entrance as cards scroll into view.
        observer = new IntersectionObserver((entries, obs) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                entry.target.classList.add('in-view');
                obs.unobserve(entry.target);
            }
        }, { threshold: 0.05 });

        fill(grid, novels.map((novel, index) => {
            const card = bookCard(novel, handlers);
            card.style.transitionDelay = `${index * 50}ms`;
            observer.observe(card);
            return card;
        }));
    };

    return {
        root,

        setEditVisible(editing) {
            newButton.classList.toggle('hidden', !editing);
            if (novels) paint();
        },

        /** Fetch once; returning to the shelf reuses what is already loaded. */
        async ensure({ force = false } = {}) {
            if (novels && !force) {
                paint();
                return;
            }
            fill(grid, loading('正在加载书架...', '.loading-state-grid'));
            try {
                novels = await api.books.list();
                paint();
            } catch {
                novels = null;
                fill(grid, failed('加载书架失败', '.loading-state-grid'));
            }
        },

        invalidate() { novels = null; },
    };
}
