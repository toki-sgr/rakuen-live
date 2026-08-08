// ==========================================================================
// modules/folios/reader.js — Folios Reader View & Chapter Navigation
// ==========================================================================

import { appState } from '../state.js';
import { NovelsAPI, ChaptersAPI } from '../api.js';
import { el, show, hide, qsa, escapeHtml } from '../dom.js';
import { showToast } from '../toast.js';
import { highlightSubtitle, showBookshelf } from './bookshelf.js';

const getElements = () => ({
    bookshelfView:     el('folios-bookshelf-view'),
    readerView:        el('folios-reader-view'),
    novelEditView:     el('folios-novel-edit-view'),
    chaptersList:      el('folios-chapters-list'),
    drawerOverlay:     el('chapter-drawer-overlay'),
    drawerList:        el('chapter-drawer-list'),
    btnToggleDrawer:   el('btn-toggle-chapter-drawer'),
    btnCloseDrawer:    el('btn-close-chapter-drawer'),
    emptyState:        el('folios-empty-state'),
    chapterDetail:     el('folios-chapter-detail-view'),
    chapterEditView:   el('folios-chapter-edit-view'),
    foliosChapterPane: el('folios-chapter-pane'),
    novelOpsMenu:      el('novel-ops-menu'),
    chapterOpsMenu:    el('chapter-ops-menu'),
    btnNewChapter:     el('btn-new-chapter'),
    readerTitle:       el('reader-novel-title'),
});

export function initChapterDrawer() {
    const { drawerOverlay, btnToggleDrawer, btnCloseDrawer } = getElements();
    if (btnToggleDrawer) {
        btnToggleDrawer.addEventListener('click', () => {
            syncDrawerList();
            show(drawerOverlay);
        });
    }
    if (btnCloseDrawer) {
        btnCloseDrawer.addEventListener('click', () => hide(drawerOverlay));
    }
    if (drawerOverlay) {
        drawerOverlay.addEventListener('click', (e) => {
            if (e.target === drawerOverlay) hide(drawerOverlay);
        });
    }
}

function syncDrawerList() {
    const { chaptersList, drawerList, drawerOverlay } = getElements();
    if (!chaptersList || !drawerList) return;

    drawerList.innerHTML = '';
    const clone = chaptersList.cloneNode(true);
    clone.id = 'folios-chapters-list-drawer';

    qsa('.post-item-small', clone).forEach(item => {
        const num = item.getAttribute('data-chapter-num');
        const side = item.getAttribute('data-side');
        item.addEventListener('click', () => {
            hide(drawerOverlay);
            if (appState.currentNovel) {
                const novelSlug = appState.currentNovel.slug;
                window.location.hash = side
                    ? `folios/${novelSlug}/${side}/${num}`
                    : `folios/${novelSlug}/${num}`;
            }
        });
    });

    drawerList.appendChild(clone);
}

export function loadNovelDetail(novelSlug, selectedChapterNum = null, sideSlug = null) {
    const {
        bookshelfView,
        novelEditView,
        readerView,
        readerTitle,
        chaptersList,
        novelOpsMenu,
        btnNewChapter,
    } = getElements();

    hide(bookshelfView);
    hide(novelEditView);
    show(readerView);

    if (readerTitle)  readerTitle.textContent = 'Loading...';
    if (chaptersList) chaptersList.innerHTML  = `<div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i></div>`;

    NovelsAPI.get(novelSlug, sideSlug)
        .then(novel => {
            appState.currentNovel = novel;

            if (readerTitle) {
                if (novel.type === 'reversible') {
                    readerTitle.innerHTML = highlightSubtitle(novel.novel_title || novel.title, novel.side_title);
                } else {
                    readerTitle.textContent = novel.title;
                }
            }

            if (appState.isEditMode) {
                show(novelOpsMenu);
                show(btnNewChapter);
            } else {
                hide(novelOpsMenu);
                hide(btnNewChapter);
            }

            if (novel.type === 'reversible') {
                renderDualChaptersList(
                    novel.front_chapters || [],
                    novel.back_chapters  || [],
                    novel.front_title,
                    novel.back_title,
                    novelSlug
                );
            } else {
                renderChaptersList(novel.chapters, novelSlug, null);
            }

            if (selectedChapterNum !== null) {
                loadChapterDetail(novelSlug, selectedChapterNum, sideSlug);
            } else if (novel.type === 'reversible') {
                const activeSide = sideSlug === novel.back_slug ? (novel.back_chapters || []) : (novel.front_chapters || []);
                const fallback   = activeSide.length > 0 ? activeSide : (novel.front_chapters || []);
                if (fallback.length > 0) {
                    const ch = fallback[0];
                    window.location.hash = `folios/${novelSlug}/${ch.side}/${ch.chapter_num}`;
                } else {
                    showChapterEmptyState();
                }
            } else if (novel.chapters && novel.chapters.length > 0) {
                window.location.hash = `folios/${novelSlug}/${novel.chapters[0].chapter_num}`;
            } else {
                showChapterEmptyState();
            }
        })
        .catch(() => {
            showToast('获取作品信息失败', 'error');
            showBookshelf();
        });
}

function renderChaptersList(chapters, novelSlug, sideSlug = null) {
    const { chaptersList } = getElements();
    if (!chaptersList) return;
    chaptersList.innerHTML = '';

    if (!chapters || chapters.length === 0) {
        chaptersList.innerHTML = `<div class="loading-state" style="padding: 20px 0;"><i class="fa-regular fa-folder-open"></i> 暂无章节</div>`;
        return;
    }

    chapters.forEach(ch => {
        chaptersList.appendChild(buildChapterItem(ch, novelSlug, sideSlug, chapters));
    });
}

function renderDualChaptersList(frontChs, backChs, frontTitle, backTitle, novelSlug) {
    const { chaptersList } = getElements();
    if (!chaptersList) return;
    chaptersList.innerHTML = '';

    const hasFront = frontChs && frontChs.length > 0;
    const hasBack  = backChs  && backChs.length  > 0;

    if (!hasFront && !hasBack) {
        chaptersList.innerHTML = `<div class="loading-state" style="padding: 20px 0;"><i class="fa-regular fa-folder-open"></i> 暂无章节</div>`;
        return;
    }

    const appendSection = (chapters, label) => {
        if (label) {
            const lbl = document.createElement('div');
            lbl.className = 'chapters-side-label';
            lbl.textContent = label;
            chaptersList.appendChild(lbl);
        }
        chapters.forEach(ch => chaptersList.appendChild(buildChapterItem(ch, novelSlug, ch.side, chapters)));
    };

    if (hasFront) appendSection(frontChs, frontTitle || null);
    if (hasFront && hasBack) {
        const divider = document.createElement('div');
        divider.className = 'chapters-side-divider';
        chaptersList.appendChild(divider);
    }
    if (hasBack) appendSection(backChs, backTitle || null);
}

function getChapterTagCode(ch, allChapters = []) {
    const title = (ch.title || '').trim();
    const match = title.match(/^(.*?)\s*(\d+)$/);

    if (match && allChapters.length > 0) {
        const baseTitle = match[1].trim();
        const subNum = match[2];

        const firstMatchingCh = allChapters.find(c => {
            const m = (c.title || '').trim().match(/^(.*?)\s*\d+$/);
            const b = m ? m[1].trim() : (c.title || '').trim();
            return b === baseTitle;
        });

        const seriesStartNum = firstMatchingCh ? firstMatchingCh.chapter_num : ch.chapter_num;
        return `${seriesStartNum}.${subNum}`;
    }

    return `${ch.chapter_num}`;
}

function buildChapterItem(ch, novelSlug, sideSlug) {
    const item = document.createElement('div');
    item.className = 'post-item-small';
    item.setAttribute('data-chapter-num', ch.chapter_num);
    item.setAttribute('data-side', ch.side || '');

    const isActive = appState.currentChapter
        && String(appState.currentChapter.chapter_num) === String(ch.chapter_num)
        && (ch.side ? ch.side === appState.currentChapter.side : true);
    if (isActive) item.classList.add('active');

    item.addEventListener('click', () => {
        const side = ch.side || sideSlug;
        window.location.hash = side
            ? `folios/${novelSlug}/${side}/${ch.chapter_num}`
            : `folios/${novelSlug}/${ch.chapter_num}`;
    });

    item.innerHTML = `
        <h4><span class="chapter-item-num">#${ch.chapter_num}</span> <span>${escapeHtml(ch.title)}</span></h4>
        <div class="post-item-date"><i class="fa-solid fa-pen-nib" style="font-size: 0.68rem; margin-right: 3px;"></i>${ch.word_count} 字</div>
    `;
    return item;
}

export function loadChapterDetail(novelSlug, chapterNum, sideSlug = null) {
    if (!appState.currentNovel || appState.currentNovel.slug !== novelSlug) {
        loadNovelDetail(novelSlug, chapterNum, sideSlug);
        return;
    }

    const {
        bookshelfView,
        novelEditView,
        readerView,
        emptyState,
        chapterEditView,
        chapterDetail,
        readerTitle,
        foliosChapterPane,
        chapterOpsMenu,
    } = getElements();

    hide(bookshelfView);
    hide(novelEditView);
    show(readerView);

    hide(emptyState);
    hide(chapterEditView);
    show(chapterDetail);

    const titleEl   = el('chapter-detail-title');
    const metaEl    = el('chapter-detail-meta-info');
    const contentEl = el('chapter-detail-content');

    if (titleEl)   titleEl.textContent = 'Loading...';
    if (metaEl)    metaEl.textContent  = '';
    if (contentEl) contentEl.innerHTML = `<div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> 正在读取章节正文...</div>`;

    qsa('#folios-chapters-list .post-item-small, #chapter-drawer-list .post-item-small').forEach(item => {
        const itemNum  = item.getAttribute('data-chapter-num');
        const itemSide = item.getAttribute('data-side') || null;
        const match = String(itemNum) === String(chapterNum) && (!sideSlug || !itemSide || itemSide === sideSlug);
        item.classList.toggle('active', match);
    });

    ChaptersAPI.get(novelSlug, chapterNum, sideSlug)
        .then(chapter => {
            appState.currentChapter = chapter;

            if (appState.currentNovel && appState.currentNovel.type === 'reversible' && readerTitle) {
                const currentSide = chapter.side;
                const isFront = currentSide === appState.currentNovel.front_slug;
                const activeSideTitle = isFront ? appState.currentNovel.front_title : appState.currentNovel.back_title;
                readerTitle.innerHTML = highlightSubtitle(appState.currentNovel.novel_title || appState.currentNovel.title, activeSideTitle);
            }

            if (titleEl) titleEl.textContent = chapter.title;
            if (metaEl) {
                metaEl.innerHTML = chapter.history
                    ? `<i class="fa-solid fa-clock-rotate-left"></i> ${escapeHtml(chapter.history)} &nbsp;&bull;&nbsp; <i class="fa-solid fa-pen-nib"></i> ${chapter.word_count} 字`
                    : `<i class="fa-solid fa-pen-nib"></i> ${chapter.word_count} 字`;
            }

            if (contentEl) {
                contentEl.innerHTML = typeof marked !== 'undefined'
                    ? marked.parse(chapter.content)
                    : `<pre style="white-space: pre-wrap;">${escapeHtml(chapter.content)}</pre>`;
            }

            if (window.innerWidth < 850) {
                const rView = el('folios-reader-view');
                if (rView) {
                    rView.scrollIntoView({ behavior: 'auto', block: 'start' });
                }
            } else {
                const mainPane = document.querySelector('.folios-main-pane');
                if (mainPane) {
                    mainPane.scrollTop = 0;
                }
            }

            if (foliosChapterPane) {
                foliosChapterPane.classList.remove('animate-fade-in');
                void foliosChapterPane.offsetWidth;
                foliosChapterPane.classList.add('animate-fade-in');
            }

            if (appState.isEditMode) show(chapterOpsMenu);
            else hide(chapterOpsMenu);

            const prevBtn = el('btn-prev-chapter');
            const nextBtn = el('btn-next-chapter');

            const prevTarget = chapter.prev_chapter_num !== undefined && chapter.prev_chapter_num !== null ? chapter.prev_chapter_num : (chapterNum - 1);
            const nextTarget = chapter.next_chapter_num !== undefined && chapter.next_chapter_num !== null ? chapter.next_chapter_num : (chapterNum + 1);

            if (chapter.has_prev) {
                show(prevBtn);
                if (prevBtn) {
                    prevBtn.onclick = () => {
                        window.location.hash = sideSlug
                            ? `folios/${novelSlug}/${sideSlug}/${prevTarget}`
                            : `folios/${novelSlug}/${prevTarget}`;
                    };
                }
            } else { hide(prevBtn); }

            if (chapter.has_next) {
                show(nextBtn);
                if (nextBtn) {
                    nextBtn.onclick = () => {
                        window.location.hash = sideSlug
                            ? `folios/${novelSlug}/${sideSlug}/${nextTarget}`
                            : `folios/${novelSlug}/${nextTarget}`;
                    };
                }
            } else { hide(nextBtn); }
        })
        .catch(() => {
            if (contentEl) {
                contentEl.innerHTML = `
                    <div class="loading-state text-danger">
                        <i class="fa-solid fa-circle-exclamation"></i> 读取章节失败。
                    </div>
                `;
            }
            hide(chapterOpsMenu);
        });
}

export function showChapterEmptyState() {
    const { emptyState, chapterDetail, chapterEditView, chapterOpsMenu } = getElements();
    appState.currentChapter = null;
    show(emptyState);
    hide(chapterDetail);
    hide(chapterEditView);
    hide(chapterOpsMenu);
}
