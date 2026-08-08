// ==========================================================================
// views/folios/index.js — 朝花夕拾
//
// Three screens share this tab: the bookshelf, the reader, and the book form.
// Routing decides which one is on show.
// ==========================================================================

import * as api from '../../core/api.js';
import { hide, show } from '../../core/dom.js';
import { isEditing, onEditChange } from '../../core/edit.js';
import { go } from '../../core/router.js';
import { confirmDialog, toast } from '../../core/toast.js';
import { createBookshelf } from './bookshelf.js';
import { createChapterForm, createNovelForm } from './forms.js';
import { createReader } from './reader.js';

const isChapterNumber = (segment) => /^\d+(\.\d+)*$/.test(segment);

// --------------------------------------------------------------------------
// Screens
// --------------------------------------------------------------------------
const bookshelf = createBookshelf({
    onNew: () => openNovelForm(null),
    onEdit: (novel) => openNovelForm(novel),
    onDelete: (novel) => removeNovel(novel),
});

const reader = createReader({
    onEditNovel: (novel) => openNovelForm(novel),
    onDeleteNovel: (novel) => removeNovel(novel),
    onNewChapter: (novel, volumeSlug) => openChapterForm(novel, null, volumeSlug),
    onEditChapter: (novel, chapter) => openChapterForm(novel, chapter, chapter.volume),
    onDeleteChapter: (novel, chapter) => removeChapter(novel, chapter),
});

const novelForm = createNovelForm({
    onCancel: () => go('folios'),
    onSubmit: (payload, slug) => saveNovel(payload, slug),
});

const chapterForm = createChapterForm({
    onCancel: () => {
        const { novel, chapter, volumeSlug } = reader.current();
        go(...['folios', novel.slug, chapter ? chapter.volume : volumeSlug, chapter && chapter.number].filter(Boolean));
    },
    onSubmit: (values, chapter) => saveChapter(values, chapter),
});

novelForm.root.id = 'folios-novel-edit-view';
novelForm.root.classList.add('hidden');

function showScreen(name) {
    for (const [key, node] of [['shelf', bookshelf.root], ['reader', reader.root], ['form', novelForm.root]]) {
        if (key === name) show(node); else hide(node);
    }
}

// --------------------------------------------------------------------------
// Books
// --------------------------------------------------------------------------
function openNovelForm(novel) {
    if (!isEditing()) return;
    novelForm.open(novel);
    showScreen('form');
}

async function saveNovel(payload, slug) {
    if (!payload.title) {
        toast('请填入作品名称', 'error');
        return;
    }
    if (payload.volumes.some((v) => !v.summary) ||
        (payload.volumes.length > 1 && payload.volumes.some((v) => !v.title))) {
        toast('请填写每一卷的名称与简介', 'error');
        return;
    }

    try {
        const saved = slug
            ? await api.books.update(slug, payload)
            : await api.books.create(payload);
        toast(slug ? '作品已成功更新' : '作品已成功创建', 'success');
        reader.refresh();
        go('folios', saved.slug, saved.volumes[0].slug);
    } catch (err) {
        toast(`保存作品失败：${err.message}`, 'error');
    }
}

async function removeNovel(novel) {
    if (!isEditing() || !novel) return;
    if (!await confirmDialog('确认要删除这部作品及所有章节吗？此操作不可撤销！')) return;

    try {
        await api.books.remove(novel.slug);
        toast('作品已成功删除', 'success');
        reader.reset();
        go('folios');
    } catch (err) {
        toast(`删除作品失败：${err.message}`, 'error');
    }
}

// --------------------------------------------------------------------------
// Chapters
// --------------------------------------------------------------------------
function openChapterForm(novel, chapter, volumeSlug) {
    if (!isEditing() || !novel) return;
    chapterForm.open(novel, chapter, volumeSlug);
    reader.pane.show(chapterForm.root);
}

async function saveChapter(values, chapter) {
    const { novel } = reader.current();
    if (!values.title || !values.content) {
        toast('请填入必填项（章节标题和章节内容）', 'error');
        return;
    }

    const payload = {
        title: values.title,
        content: values.content,
        note: values.note,
        number: values.number,
        volume: chapter ? chapter.volume : values.volume,
    };

    try {
        const saved = chapter
            ? await api.chapters.update(novel.slug, chapter.number, payload)
            : await api.chapters.create(novel.slug, payload);
        toast(chapter ? '章节已成功更新' : '章节已成功保存', 'success');
        reader.refresh();
        go(...['folios', novel.slug, saved.volume, saved.number].filter(Boolean));
    } catch (err) {
        toast(`保存章节失败：${err.message}`, 'error');
    }
}

async function removeChapter(novel, chapter) {
    if (!isEditing() || !chapter) return;
    if (!await confirmDialog('确认要删除这一章吗？此操作不可撤销。')) return;

    try {
        await api.chapters.remove(novel.slug, chapter.number, chapter.volume);
        toast('章节已成功删除', 'success');
        reader.refresh();
        go(...['folios', novel.slug, chapter.volume].filter(Boolean));
    } catch (err) {
        toast(`删除章节失败：${err.message}`, 'error');
    }
}

// --------------------------------------------------------------------------
onEditChange((editing) => {
    bookshelf.setEditVisible(editing);
    reader.setEditVisible(editing);
    if (!editing && !novelForm.root.classList.contains('hidden')) go('folios');
});

export default {
    id: 'folios',
    nav: { icon: 'fa-solid fa-book-bookmark', label: '朝花夕拾 / Folios', short: '朝花夕拾' },

    // Three siblings, sized directly by the stylesheet — no wrapper.
    render: () => [bookshelf.root, reader.root, novelForm.root],

    /**
     * #folios                          the shelf
     * #folios/<book>                   first chapter of the first volume
     * #folios/<book>/<n>               chapter n of a single-volume book
     * #folios/<book>/<volume>          first chapter of that volume
     * #folios/<book>/<volume>/<n>      chapter n of that volume
     */
    route(parts) {
        const [slug, second, third] = parts;

        if (!slug) {
            reader.reset();
            showScreen('shelf');
            bookshelf.refresh();
            return;
        }

        showScreen('reader');
        if (third !== undefined) {
            reader.open(slug, second, third);
        } else if (second !== undefined && isChapterNumber(second)) {
            reader.open(slug, undefined, second);
        } else {
            reader.open(slug, second, undefined);
        }
    },
};
