// ==========================================================================
// modules/folios.js — Folios Barrel Export & Initialization
// ==========================================================================

import { appState } from './state.js';
import { el, hide, show, isVisible } from './dom.js';
import { showBookshelf, renderBookshelf } from './folios/bookshelf.js';
import { loadNovelDetail, loadChapterDetail, initChapterDrawer } from './folios/reader.js';
import {
    showNovelCreateForm,
    showNovelEditForm,
    cancelNovelEdit,
    submitNovelForm,
    executeDeleteNovel,
    showChapterCreateForm,
    showChapterEditForm,
    cancelChapterEdit,
    submitChapterForm,
    executeDeleteChapter,
} from './folios/crud.js';

export { showBookshelf, loadNovelDetail, loadChapterDetail };

export function initFolios() {
    initChapterDrawer();
    const btnNewNovel      = el('btn-new-novel');
    const btnCancelNovel   = el('btn-cancel-novel-edit');
    const btnSubmitNovel   = el('btn-submit-novel');
    const btnEditNovel     = el('btn-edit-novel');
    const btnDeleteNovel   = el('btn-delete-novel');
    const btnBack          = el('btn-folios-back');
    const btnNewChapter    = el('btn-new-chapter');
    const btnCancelChapter = el('btn-cancel-chapter-edit');
    const btnSubmitChapter = el('btn-submit-chapter');
    const btnEditChapter   = el('btn-edit-chapter');
    const btnDeleteChapter = el('btn-delete-chapter');

    if (btnNewNovel)      btnNewNovel.addEventListener('click', showNovelCreateForm);
    if (btnCancelNovel)   btnCancelNovel.addEventListener('click', cancelNovelEdit);
    if (btnSubmitNovel)   btnSubmitNovel.addEventListener('click', submitNovelForm);
    if (btnEditNovel)     btnEditNovel.addEventListener('click', showNovelEditForm);
    if (btnDeleteNovel)   btnDeleteNovel.addEventListener('click', executeDeleteNovel);
    if (btnBack)          btnBack.addEventListener('click', () => { window.location.hash = 'folios'; });

    if (btnNewChapter)    btnNewChapter.addEventListener('click', showChapterCreateForm);
    if (btnCancelChapter) btnCancelChapter.addEventListener('click', cancelChapterEdit);
    if (btnSubmitChapter) btnSubmitChapter.addEventListener('click', submitChapterForm);
    if (btnEditChapter)   btnEditChapter.addEventListener('click', showChapterEditForm);
    if (btnDeleteChapter) btnDeleteChapter.addEventListener('click', executeDeleteChapter);

    const checkboxReversible = el('form-novel-is-reversible');
    const standardFields     = el('standard-novel-fields');
    const reversibleFields   = el('reversible-novel-fields');
    if (checkboxReversible) {
        checkboxReversible.addEventListener('change', () => {
            if (checkboxReversible.checked) {
                hide(standardFields);
                show(reversibleFields);
            } else {
                show(standardFields);
                hide(reversibleFields);
            }
        });
    }
}

export function updateFoliosEditModeUI() {
    const bookshelfView   = el('folios-bookshelf-view');
    const btnNewNovel     = el('btn-new-novel');
    const novelOpsMenu    = el('novel-ops-menu');
    const btnNewChapter   = el('btn-new-chapter');
    const chapterOpsMenu  = el('chapter-ops-menu');
    const novelEditView   = el('folios-novel-edit-view');
    const chapterEditView = el('folios-chapter-edit-view');

    if (bookshelfView && isVisible(bookshelfView)) {
        renderBookshelf(appState.foliosData);
    }

    if (appState.isEditMode) {
        show(btnNewNovel);
        show(novelOpsMenu);
        show(btnNewChapter);
        if (appState.currentChapter) show(chapterOpsMenu);
    } else {
        hide(btnNewNovel);
        hide(novelOpsMenu);
        hide(btnNewChapter);
        hide(chapterOpsMenu);

        if (novelEditView   && isVisible(novelEditView))   cancelNovelEdit();
        if (chapterEditView && isVisible(chapterEditView)) cancelChapterEdit();
    }
}
