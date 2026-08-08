// ==========================================================================
// views/folios/reader.js — Chapter index plus the chapter being read
//
// Volumes are a list, so a single-volume book and a multi-volume one take the
// same path; the only difference is whether section labels are drawn.
// ==========================================================================

import * as api from '../../core/api.js';
import { fill, h, hide, icon, show } from '../../core/dom.js';
import { isEditing } from '../../core/edit.js';
import { renderMarkdown } from '../../core/markdown.js';
import { go } from '../../core/router.js';
import {
    createArticlePane, createSplitPane, markActive,
} from '../../components/readingLayout.js';
import { empty, failed, loading } from '../../components/states.js';
import { sections } from '../../../data/site.js';

/** Volume-qualified chapter link; the volume segment is omitted for lone volumes. */
const chapterHash = (novelSlug, volumeSlug, num) =>
    ['folios', novelSlug, volumeSlug, num].filter(Boolean);

export function createReader(handlers) {
    let novel = null;
    let chapter = null;
    let volumeSlug = '';

    // -- chrome ----------------------------------------------------------
    const title = h('h3.reader-novel-title');

    const ops = h('div.reader-novel-ops.hidden', {},
        h('button.btn-op.btn-edit', { onClick: () => handlers.onEditNovel(novel) },
            icon('fa-solid fa-pencil'), ' 编辑作品'),
        h('button.btn-op.btn-delete', { onClick: () => handlers.onDeleteNovel(novel) },
            icon('fa-solid fa-trash-can'), ' 删除作品'),
    );

    const drawerList = h('div.drawer-body');
    const drawer = h('div.drawer-overlay.hidden', {
        onClick: (e) => { if (e.target === drawer) hide(drawer); },
    },
        h('div.drawer-sheet', {},
            h('div.drawer-header', {},
                h('h3', {}, icon('fa-solid fa-list-ul'), ' 章节目录'),
                h('button.btn-close-modal', { onClick: () => hide(drawer), html: '&times;' }),
            ),
            drawerList,
        ),
    );
    document.body.appendChild(drawer);

    const pane = createSplitPane({
        prefix: 'folios',
        newLabel: '新增章节',
        emptyText: sections.folios.emptyText,
        onNew: () => handlers.onNewChapter(novel, volumeSlug),
    });

    const article = createArticlePane({
        editLabel: '编辑章节',
        deleteLabel: '删除章节',
        paneSelector: '.folios-main-pane',
        onEdit: () => handlers.onEditChapter(novel, chapter),
        onDelete: () => handlers.onDeleteChapter(novel, chapter),
    });

    const root = h('div#folios-reader-view.hidden', {},
        h('div.reader-header-bar', {},
            h('button.btn-folios-back', { onClick: () => go('folios') },
                icon('fa-solid fa-arrow-left'), ' 返回书架'),
            title,
            h('button.btn-op.btn-chapter-drawer-toggle', {
                title: '呼出章节目录',
                onClick: () => { paintChapters(); show(drawer); },
            }, icon('fa-solid fa-list-ul'), ' 目录'),
            ops,
        ),
        pane.root,
    );

    // -- chapter index ---------------------------------------------------
    function chapterItem(volume, ch) {
        return h('div', {
            dataset: { num: ch.number, volume: volume.slug },
            onClick: () => {
                hide(drawer);
                go(...chapterHash(novel.slug, volume.slug, ch.number));
            },
        },
            h('h4', {}, h('span.chapter-item-num', {}, `#${ch.number}`), ' ', h('span', {}, ch.title)),
            h('div.post-item-date', {}, icon('fa-solid fa-pen-nib'), ` ${ch.word_count} 字`),
        );
    }

    /** Flatten volumes into one list, labelling each section when there is more than one. */
    function chapterNodes() {
        const multi = novel.volumes.length > 1;
        const nodes = [];
        novel.volumes.forEach((volume, index) => {
            if (!volume.chapters.length) return;
            if (multi && index > 0) nodes.push(h('div.chapters-side-divider'));
            if (multi) nodes.push(h('div.chapters-side-label', {}, volume.title));
            nodes.push(...volume.chapters.map((ch) => {
                const node = chapterItem(volume, ch);
                node.classList.add('post-item-small');
                return node;
            }));
        });
        return nodes;
    }

    function paintChapters() {
        const nodes = novel.chapter_count ? chapterNodes() : [empty('暂无章节')];
        fill(pane.list, nodes);
        fill(drawerList, novel.chapter_count ? chapterNodes() : [empty('暂无章节')]);
        highlight();
    }

    function highlight() {
        const match = (data) =>
            !!chapter && data.num === String(chapter.number) && data.volume === (chapter.volume || '');
        markActive(pane.list, match);
        markActive(drawerList, match);
    }

    // -- reading ---------------------------------------------------------
    function headingFor(volume) {
        if (novel.volumes.length < 2 || !volume) return [novel.title];
        if (!novel.title.includes(volume.title)) return [`${novel.title}：${volume.title}`];
        const [before, after] = novel.title.split(volume.title);
        return [before, h('span.book-title-highlight', {}, volume.title), after];
    }

    async function openChapter(num) {
        pane.show(article.root);
        article.setTitle('Loading...');
        article.setMeta();
        article.setOpsVisible(false);
        fill(article.body, loading('正在读取章节正文...'));
        fill(article.footer);

        try {
            chapter = await api.chapters.get(novel.slug, num, volumeSlug);
        } catch {
            fill(article.body, failed('读取章节失败。'));
            return;
        }

        const volume = novel.volumes.find((v) => v.slug === chapter.volume);
        fill(title, headingFor(volume));

        article.setTitle(chapter.title);
        article.setMeta(
            chapter.note
                ? h('span', {}, icon('fa-solid fa-clock-rotate-left'), ` ${chapter.note} · `)
                : null,
            h('span', {}, icon('fa-solid fa-pen-nib'), ` ${chapter.word_count} 字`),
        );
        renderMarkdown(article.body, chapter.content, chapter.assets);

        fill(article.footer,
            chapter.prev ? h('button.btn-secondary', {
                onClick: () => go(...chapterHash(novel.slug, chapter.volume, chapter.prev)),
            }, icon('fa-solid fa-chevron-left'), ' 上一章') : null,
            chapter.next ? h('button.btn-secondary', {
                onClick: () => go(...chapterHash(novel.slug, chapter.volume, chapter.next)),
            }, '下一章 ', icon('fa-solid fa-chevron-right')) : null,
        );

        article.setOpsVisible(isEditing());
        article.reveal();
        highlight();
    }

    // -- entry point -----------------------------------------------------
    async function open(novelSlug, wantedVolume, num) {
        show(root);

        if (!novel || novel.slug !== novelSlug) {
            fill(title, 'Loading...');
            fill(pane.list, loading(''));
            try {
                novel = await api.books.get(novelSlug);
            } catch {
                novel = null;
                go('folios');
                return;
            }
        }

        const volume = novel.volumes.find((v) => v.slug === wantedVolume) || novel.volumes[0];
        volumeSlug = volume.slug;
        fill(title, headingFor(volume));
        setEditVisible(isEditing());
        paintChapters();

        if (num !== undefined && num !== null) {
            await openChapter(num);
            return;
        }

        // No chapter asked for: land on the first one this volume has.
        const first = volume.chapters[0]
            || novel.volumes.flatMap((v) => v.chapters)[0];
        if (first) {
            go(...chapterHash(novel.slug, first.volume, first.number));
        } else {
            chapter = null;
            pane.showEmpty();
        }
    }

    function setEditVisible(editing) {
        ops.classList.toggle('hidden', !editing);
        pane.setNewVisible(editing);
        article.setOpsVisible(editing && !!chapter);
    }

    return {
        root,
        pane,
        open,
        setEditVisible,
        reset() { novel = null; chapter = null; volumeSlug = ''; hide(root); },
        current: () => ({ novel, chapter, volumeSlug }),
        refresh: () => { novel = null; },
    };
}
