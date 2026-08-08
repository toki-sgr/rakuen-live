// ==========================================================================
// modules/folios/crud.js — Novel & Chapter Form Handling & CRUD Actions
// ==========================================================================

import { appState } from '../state.js';
import { NovelsAPI, ChaptersAPI } from '../api.js';
import { el, show, hide, escapeHtml } from '../dom.js';
import { showToast, confirmDialog } from '../toast.js';
import { showBookshelf } from './bookshelf.js';
import { showChapterEmptyState } from './reader.js';

const getElements = () => ({
    bookshelfView:   el('folios-bookshelf-view'),
    readerView:      el('folios-reader-view'),
    novelEditView:   el('folios-novel-edit-view'),
    chapterDetail:   el('folios-chapter-detail-view'),
    chapterEditView: el('folios-chapter-edit-view'),
    emptyState:      el('folios-empty-state'),
});

// ==========================================================================
// NOVEL CRUD
// ==========================================================================
export function showNovelCreateForm() {
    if (!appState.isEditMode) return;
    const { bookshelfView, readerView, novelEditView } = getElements();
    hide(bookshelfView);
    hide(readerView);
    show(novelEditView);

    el('novel-form-view-title').textContent      = '新增作品';
    el('form-novel-id').value                    = '';
    el('form-novel-title').value                 = '';
    el('form-novel-classification').value        = '短篇';
    el('form-novel-year').value                  = '';

    const checkbox = el('form-novel-is-reversible');
    if (checkbox) {
        checkbox.checked = false;
        show(el('standard-novel-fields'));
        hide(el('reversible-novel-fields'));
    }

    el('form-novel-status').value        = '连载中';
    el('form-novel-cover').value         = '';
    el('form-novel-summary').value       = '';
    el('form-novel-front-title').value   = '';
    el('form-novel-front-cover').value   = '';
    el('form-novel-front-status').value  = '连载中';
    el('form-novel-front-summary').value = '';
    el('form-novel-back-title').value    = '';
    el('form-novel-back-cover').value    = '';
    el('form-novel-back-status').value   = '已完结';
    el('form-novel-back-summary').value  = '';
}

export function showNovelEditForm() {
    if (!appState.isEditMode || !appState.currentNovel) return;
    const novel = appState.currentNovel;
    const { bookshelfView, readerView, novelEditView } = getElements();

    hide(bookshelfView);
    hide(readerView);
    show(novelEditView);

    el('novel-form-view-title').textContent      = '编辑作品';
    el('form-novel-id').value                    = novel.slug;
    el('form-novel-title').value                 = novel.novel_title || novel.title;
    el('form-novel-classification').value        = novel.classification || (novel.type === 'reversible' ? '短篇集' : '短篇');
    el('form-novel-year').value                  = novel.year || '';

    const checkbox         = el('form-novel-is-reversible');
    const standardFields   = el('standard-novel-fields');
    const reversibleFields = el('reversible-novel-fields');

    if (novel.type === 'reversible') {
        if (checkbox) { checkbox.checked = true; hide(standardFields); show(reversibleFields); }
        el('form-novel-front-title').value   = novel.front_title   || '';
        el('form-novel-front-cover').value   = novel.front_cover   || '';
        el('form-novel-front-status').value  = novel.front_status  || '连载中';
        el('form-novel-front-summary').value = novel.front_summary || '';
        el('form-novel-back-title').value    = novel.back_title    || '';
        el('form-novel-back-cover').value    = novel.back_cover    || '';
        el('form-novel-back-status').value   = novel.back_status   || '已完结';
        el('form-novel-back-summary').value  = novel.back_summary  || '';
    } else {
        if (checkbox) { checkbox.checked = false; show(standardFields); hide(reversibleFields); }
        el('form-novel-status').value  = novel.status      || '连载中';
        el('form-novel-cover').value   = novel.cover_image || '';
        el('form-novel-summary').value = novel.summary     || '';
    }
}

export function cancelNovelEdit() {
    const { novelEditView, readerView } = getElements();
    hide(novelEditView);
    if (appState.currentNovel) show(readerView);
    else showBookshelf();
}

export function submitNovelForm() {
    if (!appState.isEditMode) return;

    const title          = el('form-novel-title').value.trim();
    const classification = el('form-novel-classification').value;
    const year           = el('form-novel-year').value.trim();
    const id             = el('form-novel-id').value;

    if (!title) { showToast('请填入作品名称', 'error'); return; }

    const isReversible = el('form-novel-is-reversible')?.checked || false;
    const payload      = { title, classification, year };

    if (isReversible) {
        const frontTitle   = el('form-novel-front-title').value.trim();
        const frontCover   = el('form-novel-front-cover').value.trim();
        const frontStatus  = el('form-novel-front-status').value;
        const frontSummary = el('form-novel-front-summary').value.trim();
        const backTitle    = el('form-novel-back-title').value.trim();
        const backCover    = el('form-novel-back-cover').value.trim();
        const backStatus   = el('form-novel-back-status').value;
        const backSummary  = el('form-novel-back-summary').value.trim();

        if (!frontTitle || !frontSummary || !backTitle || !backSummary) {
            showToast('请填写双面书籍的所有必填字段', 'error');
            return;
        }

        Object.assign(payload, {
            type: 'reversible',
            front_title: frontTitle, front_cover: frontCover,
            front_status: frontStatus, front_summary: frontSummary,
            back_title: backTitle,  back_cover: backCover,
            back_status: backStatus, back_summary: backSummary,
        });
    } else {
        const status  = el('form-novel-status').value;
        const cover   = el('form-novel-cover').value.trim() || '/assets/ruined_library.png';
        const summary = el('form-novel-summary').value.trim();
        if (!summary) { showToast('请填写作品简介', 'error'); return; }
        Object.assign(payload, { status, cover_image: cover, summary });
    }

    const operation = id ? NovelsAPI.update(id, payload) : NovelsAPI.create(payload);
    operation
        .then(data => {
            showToast(id ? '作品已成功更新' : '作品已成功创建', 'success');
            appState.currentNovel = null;
            const slug = data.slug || id;
            if (isReversible) {
                NovelsAPI.get(slug)
                    .then(novel => { window.location.hash = `folios/${slug}/${novel.front_slug}`; })
                    .catch(() => { window.location.hash = `folios/${slug}`; });
            } else {
                window.location.hash = `folios/${slug}`;
            }
        })
        .catch(err => showToast(`保存作品失败：${err.message}`, 'error'));
}

export async function executeDeleteNovel() {
    if (!appState.isEditMode || !appState.currentNovel) return;
    const confirmed = await confirmDialog('确认要删除这部作品及所有章节吗？此操作不可撤销！');
    if (!confirmed) return;

    NovelsAPI.delete(appState.currentNovel.slug)
        .then(() => {
            showToast('作品已成功删除', 'success');
            appState.currentNovel   = null;
            appState.currentChapter = null;
            window.location.hash = 'folios';
        })
        .catch(err => showToast(`删除作品失败：${err.message}`, 'error'));
}

// ==========================================================================
// CHAPTER CRUD
// ==========================================================================
export function showChapterCreateForm() {
    if (!appState.isEditMode || !appState.currentNovel) return;
    const { chapterDetail, emptyState, chapterEditView } = getElements();

    hide(chapterDetail);
    hide(emptyState);
    show(chapterEditView);

    el('chapter-form-view-title').textContent = '新增章节';
    el('form-chapter-id').value               = '';
    el('form-chapter-title').value            = '';
    el('form-chapter-num').value              = '';
    el('form-chapter-history').value          = '';
    el('form-chapter-content').value          = '';

    const sideGroup = el('form-chapter-side-group');
    if (appState.currentNovel.type === 'reversible') {
        show(sideGroup);
        const selectSide = el('form-chapter-side');
        const frontSlug  = appState.currentNovel.front_slug || 'front';
        const backSlug   = appState.currentNovel.back_slug  || 'back';
        selectSide.innerHTML = `
            <option value="${escapeHtml(frontSlug)}">${escapeHtml(appState.currentNovel.front_title || '正面')}</option>
            <option value="${escapeHtml(backSlug)}">${escapeHtml(appState.currentNovel.back_title  || '反面')}</option>
        `;
        selectSide.value = appState.currentNovel.side || frontSlug;
    } else {
        hide(sideGroup);
    }
}

export function showChapterEditForm() {
    if (!appState.isEditMode || !appState.currentChapter) return;
    const ch = appState.currentChapter;
    const { chapterDetail, emptyState, chapterEditView } = getElements();

    hide(chapterDetail);
    hide(emptyState);
    show(chapterEditView);

    el('chapter-form-view-title').textContent = '编辑章节';
    el('form-chapter-id').value               = ch.id;
    el('form-chapter-title').value            = ch.title;
    el('form-chapter-num').value              = ch.chapter_num;
    el('form-chapter-history').value          = ch.history || '';
    el('form-chapter-content').value          = ch.content || '';
    hide(el('form-chapter-side-group'));
}

export function cancelChapterEdit() {
    const { chapterEditView, chapterDetail } = getElements();
    hide(chapterEditView);
    if (appState.currentChapter) show(chapterDetail);
    else showChapterEmptyState();
}

export function submitChapterForm() {
    if (!appState.isEditMode || !appState.currentNovel) return;

    const title         = el('form-chapter-title').value.trim();
    const chapterNumVal = el('form-chapter-num').value.trim();
    const history       = el('form-chapter-history').value.trim();
    const content       = el('form-chapter-content').value.trim();
    const id            = el('form-chapter-id').value;

    if (!title || !content) { showToast('请填入必填项（章节标题和章节内容）', 'error'); return; }

    const payload = { title, content, history };
    if (chapterNumVal !== '') payload.chapter_num = parseInt(chapterNumVal, 10);

    const novelSlug = appState.currentNovel.slug;

    if (!id) {
        if (appState.currentNovel.type === 'reversible') {
            payload.side = el('form-chapter-side').value;
        }
        ChaptersAPI.create(novelSlug, payload)
            .then(data => {
                showToast('章节已成功保存', 'success');
                const targetNum = data.chapter_num;
                const sideSlug  = appState.currentNovel.type === 'reversible' ? payload.side : null;
                appState.currentNovel   = null;
                appState.currentChapter = null;
                window.location.hash = sideSlug
                    ? `folios/${novelSlug}/${sideSlug}/${targetNum}`
                    : `folios/${novelSlug}/${targetNum}`;
            })
            .catch(err => showToast(`保存章节失败：${err.message}`, 'error'));
    } else {
        const editNum  = appState.currentChapter.chapter_num;
        const sideSlug = (appState.currentNovel.type === 'reversible' && appState.currentChapter.side)
            ? appState.currentChapter.side : null;
        if (sideSlug) payload.side = sideSlug;

        ChaptersAPI.update(novelSlug, editNum, payload)
            .then(() => {
                showToast('章节已成功更新', 'success');
                const targetNum = payload.chapter_num || editNum;
                appState.currentNovel   = null;
                appState.currentChapter = null;
                window.location.hash = sideSlug
                    ? `folios/${novelSlug}/${sideSlug}/${targetNum}`
                    : `folios/${novelSlug}/${targetNum}`;
            })
            .catch(err => showToast(`保存章节失败：${err.message}`, 'error'));
    }
}

export async function executeDeleteChapter() {
    if (!appState.isEditMode || !appState.currentChapter || !appState.currentNovel) return;
    const confirmed = await confirmDialog('确认要删除这一章吗？后面章节的序号会自动调整。');
    if (!confirmed) return;

    const novelSlug  = appState.currentNovel.slug;
    const chapterNum = appState.currentChapter.chapter_num;
    const sideSlug   = appState.currentChapter.side || null;

    ChaptersAPI.delete(novelSlug, chapterNum, sideSlug)
        .then(() => {
            showToast('章节已成功删除', 'success');
            appState.currentNovel   = null;
            appState.currentChapter = null;
            window.location.hash = sideSlug
                ? `folios/${novelSlug}/${sideSlug}`
                : `folios/${novelSlug}`;
        })
        .catch(err => showToast(`删除章节失败：${err.message}`, 'error'));
}
