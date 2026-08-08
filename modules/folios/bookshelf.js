// ==========================================================================
// modules/folios/bookshelf.js — Bookshelf View & Book Card Rendering
// ==========================================================================

import { appState } from '../state.js';
import { NovelsAPI } from '../api.js';
import { el, show, hide, escapeHtml } from '../dom.js';
import { showNovelEditForm, executeDeleteNovel } from './crud.js';

const getElements = () => ({
    bookshelfView: el('folios-bookshelf-view'),
    readerView:    el('folios-reader-view'),
    novelEditView: el('folios-novel-edit-view'),
    bookshelfGrid: el('folios-bookshelf-grid'),
    btnNewNovel:   el('btn-new-novel'),
});

export function showBookshelf() {
    appState.currentNovel   = null;
    appState.currentChapter = null;

    const { bookshelfView, readerView, novelEditView, btnNewNovel } = getElements();
    show(bookshelfView);
    hide(readerView);
    hide(novelEditView);

    if (appState.isEditMode) show(btnNewNovel);
    else hide(btnNewNovel);

    fetchNovelsList();
}

export function fetchNovelsList() {
    const { bookshelfGrid } = getElements();
    if (!bookshelfGrid) return;

    bookshelfGrid.innerHTML = `
        <div class="loading-state loading-state-grid">
            <i class="fa-solid fa-spinner fa-spin"></i> 正在加载书架...
        </div>
    `;

    NovelsAPI.list()
        .then(novels => {
            appState.foliosData = novels;
            renderBookshelf(novels);
        })
        .catch(() => {
            bookshelfGrid.innerHTML = `
                <div class="loading-state loading-state-grid text-danger">
                    <i class="fa-solid fa-circle-exclamation"></i> 加载书架失败
                </div>
            `;
        });
}

export function renderBookshelf(novels) {
    const { bookshelfGrid } = getElements();
    if (!bookshelfGrid) return;

    bookshelfGrid.innerHTML = '';

    if (novels.length === 0) {
        bookshelfGrid.innerHTML = `
            <div class="loading-state loading-state-grid" style="padding: 40px 0;">
                <i class="fa-regular fa-folder-open"></i> 书架目前空空如也。
            </div>
        `;
        return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.05 });

    novels.forEach((novel, index) => {
        const container = novel.type === 'reversible'
            ? buildReversibleCard(novel)
            : buildStandardCard(novel);

        // Stagger entrance transition delay
        container.style.transitionDelay = `${index * 50}ms`;
        bookshelfGrid.appendChild(container);
        observer.observe(container);
    });
}

function buildStandardCard(novel) {
    const container = document.createElement('div');
    container.className = 'book-card-container';

    const statusClass = novel.status === '已完结' ? 'completed' : 'serializing';
    const coverImg    = escapeHtml(novel.cover_image || '/assets/ruined_library.png');

    const actionsHtml = appState.isEditMode ? `
        <div class="book-card-actions">
            <button class="btn-card-edit" title="编辑作品"><i class="fa-solid fa-pencil"></i></button>
            <button class="btn-card-delete" title="删除作品"><i class="fa-solid fa-trash-can"></i></button>
        </div>
    ` : '';

    container.innerHTML = `
        <div class="book-card-inner">
            <div class="book-card-front">
                <div class="book-cover-wrapper" style="--cover-url: url('${coverImg}');">
                    <img src="${coverImg}" alt="${escapeHtml(novel.title)}" class="book-cover-img" onerror="this.src='/assets/ruined_library.png'">
                    ${actionsHtml}
                </div>
                <div class="book-info">
                    <h4 class="book-title">
                        ${escapeHtml(novel.title)}
                        <span class="book-status-badge ${statusClass}">${escapeHtml(novel.status)}</span>
                        ${novel.year ? `<span class="book-start-year">${escapeHtml(novel.year)}</span>` : ''}
                    </h4>
                    <p class="book-summary">${escapeHtml(novel.summary || '')}</p>
                    <div class="book-meta">
                        <span><i class="fa-regular fa-bookmark"></i> ${escapeHtml(novel.classification || '短篇')}</span>
                        <span><i class="fa-regular fa-file-lines"></i> ${novel.chapter_count} 章节</span>
                        <span><i class="fa-solid fa-pen-nib"></i> ${novel.total_word_count} 字</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    const front = container.querySelector('.book-card-front');
    front.addEventListener('click', e => {
        if (!e.target.closest('.book-card-actions')) {
            window.location.hash = `folios/${novel.slug}`;
        }
    });

    if (appState.isEditMode) wireEditDeleteBtns(container, novel);

    return container;
}

function buildReversibleCard(novel) {
    const container = document.createElement('div');
    container.className = 'book-card-container reversible-card';

    const frontStatusClass = novel.front_status === '已完结' ? 'completed' : 'serializing';
    const backStatusClass  = novel.back_status  === '已完结' ? 'completed' : 'serializing';
    const frontCover = escapeHtml(novel.front_cover || '/assets/ruined_library.png');
    const backCover  = escapeHtml(novel.back_cover  || '/assets/ruined_library.png');

    const frontTitleHtml = highlightSubtitle(novel.title, novel.front_title);
    const backTitleHtml  = highlightSubtitle(novel.title, novel.back_title);

    const actionsHtml = appState.isEditMode ? `
        <div class="book-card-actions">
            <button class="btn-card-edit" title="编辑作品"><i class="fa-solid fa-pencil"></i></button>
            <button class="btn-card-delete" title="删除作品"><i class="fa-solid fa-trash-can"></i></button>
        </div>
    ` : '';

    const flipBtn = `
        <div class="book-card-flip-action">
            <button class="btn-card-flip" title="翻转封面">
                <i class="fa-solid fa-arrows-rotate"></i> 翻转封面
            </button>
        </div>
    `;

    container.innerHTML = `
        <div class="book-card-inner">
            <!-- Front -->
            <div class="book-card-front">
                <div class="book-cover-wrapper" style="--cover-url: url('${frontCover}');">
                    <img src="${frontCover}" alt="${escapeHtml(novel.front_title)}" class="book-cover-img" onerror="this.src='/assets/ruined_library.png'">
                    ${flipBtn}
                    ${actionsHtml}
                </div>
                <div class="book-info">
                    <h4 class="book-title">
                        ${frontTitleHtml}
                        <span class="book-status-badge ${frontStatusClass}">${escapeHtml(novel.front_status)}</span>
                        ${novel.year ? `<span class="book-start-year">${escapeHtml(novel.year)}</span>` : ''}
                    </h4>
                    <p class="book-summary">${escapeHtml(novel.front_summary || '')}</p>
                    <div class="book-meta">
                        <span><i class="fa-regular fa-bookmark"></i> ${escapeHtml(novel.classification || '短篇集')}</span>
                        <span><i class="fa-regular fa-file-lines"></i> ${novel.chapter_count} 章节</span>
                        <span><i class="fa-solid fa-pen-nib"></i> ${novel.total_word_count} 字</span>
                    </div>
                </div>
            </div>
            <!-- Back -->
            <div class="book-card-back">
                <div class="book-cover-wrapper" style="--cover-url: url('${backCover}');">
                    <img src="${backCover}" alt="${escapeHtml(novel.back_title)}" class="book-cover-img" onerror="this.src='/assets/ruined_library.png'">
                    ${flipBtn}
                    ${actionsHtml}
                </div>
                <div class="book-info">
                    <h4 class="book-title">
                        ${backTitleHtml}
                        <span class="book-status-badge ${backStatusClass}">${escapeHtml(novel.back_status)}</span>
                        ${novel.year ? `<span class="book-start-year">${escapeHtml(novel.year)}</span>` : ''}
                    </h4>
                    <p class="book-summary">${escapeHtml(novel.back_summary || '')}</p>
                    <div class="book-meta">
                        <span><i class="fa-regular fa-bookmark"></i> ${escapeHtml(novel.classification || '短篇集')}</span>
                        <span><i class="fa-regular fa-file-lines"></i> ${novel.chapter_count} 章节</span>
                        <span><i class="fa-solid fa-pen-nib"></i> ${novel.total_word_count} 字</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    container.querySelector('.book-card-front').addEventListener('click', e => {
        if (!e.target.closest('.book-card-actions') && !e.target.closest('.book-card-flip-action')) {
            window.location.hash = `folios/${novel.slug}/${novel.front_slug}`;
        }
    });

    container.querySelector('.book-card-back').addEventListener('click', e => {
        if (!e.target.closest('.book-card-actions') && !e.target.closest('.book-card-flip-action')) {
            window.location.hash = `folios/${novel.slug}/${novel.back_slug}`;
        }
    });

    container.querySelectorAll('.btn-card-flip').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            container.classList.toggle('flipped');
        });
    });

    if (appState.isEditMode) wireEditDeleteBtns(container, novel);

    return container;
}

export function highlightSubtitle(fullTitle, subTitle) {
    if (!subTitle || !fullTitle.includes(subTitle)) return escapeHtml(fullTitle);
    const escaped    = escapeHtml(fullTitle);
    const escapedSub = escapeHtml(subTitle);
    return escaped.replace(escapedSub, `<span class="book-title-highlight">${escapedSub}</span>`);
}

function wireEditDeleteBtns(container, novel) {
    container.querySelectorAll('.btn-card-edit').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            appState.currentNovel = novel;
            showNovelEditForm();
        });
    });
    container.querySelectorAll('.btn-card-delete').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            appState.currentNovel = novel;
            executeDeleteNovel();
        });
    });
}
