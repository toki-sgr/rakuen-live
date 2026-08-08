// ==========================================================================
// modules/blog.js — Blog Section: List, Detail, Create/Edit/Delete
// ==========================================================================

import { appState } from './state.js';
import { PostsAPI } from './api.js';
import { el, show, hide, qsa, isVisible, escapeHtml } from './dom.js';
import { showToast, confirmDialog } from './toast.js';

// Lazy DOM getters
const getBlogElements = () => ({
    blogPostsList:  el('blog-posts-list'),
    blogDetailView: el('blog-detail-view'),
    blogEditView:   el('blog-edit-view'),
    blogEmptyState: el('blog-empty-state'),
    blogDetailPane: el('blog-detail-pane'),
    postForm:       el('post-form'),
    formPostId:     el('form-post-id'),
    formTitle:      el('form-title'),
    formTags:       el('form-tags'),
    formSummary:    el('form-summary'),
    formDate:       el('form-date'),
    formContent:    el('form-content'),
    formViewTitle:  el('form-view-title'),
    detailTitle:    el('post-detail-title'),
    detailDate:     el('post-detail-date'),
    detailTags:     el('post-detail-tags'),
    detailContent:  el('post-detail-content'),
    postOpsMenu:    el('post-ops-menu'),
    btnNewPost:     el('btn-new-post'),
    btnEditPost:    el('btn-edit-post'),
    btnDeletePost:  el('btn-delete-post'),
    btnCancelEdit:  el('btn-cancel-edit'),
    btnSubmitPost:  el('btn-submit-post'),
});

// --------------------------------------------------------------------------
// Init
// --------------------------------------------------------------------------
export function initBlog() {
    const {
        btnNewPost,
        btnCancelEdit,
        btnSubmitPost,
        btnEditPost,
        btnDeletePost,
    } = getBlogElements();

    if (btnNewPost)    btnNewPost.addEventListener('click', showCreateForm);
    if (btnCancelEdit) btnCancelEdit.addEventListener('click', cancelFormEdit);
    if (btnSubmitPost) btnSubmitPost.addEventListener('click', submitPostForm);
    if (btnEditPost)   btnEditPost.addEventListener('click', showEditForm);
    if (btnDeletePost) btnDeletePost.addEventListener('click', executeDeletePost);

    fetchBlogList();
}

// --------------------------------------------------------------------------
// Edit Mode UI Update
// --------------------------------------------------------------------------
export function updateBlogEditModeUI() {
    const { btnNewPost, postOpsMenu, blogEditView } = getBlogElements();
    if (appState.isEditMode) {
        show(btnNewPost);
        if (appState.currentActivePost) show(postOpsMenu);
    } else {
        hide(btnNewPost);
        hide(postOpsMenu);
        if (isVisible(blogEditView)) cancelFormEdit();
    }
}

// --------------------------------------------------------------------------
// Data Fetching
// --------------------------------------------------------------------------
export function fetchBlogList(selectedSlug = null) {
    const { blogPostsList } = getBlogElements();
    PostsAPI.list()
        .then(posts => {
            appState.blogPostsData = posts;
            renderBlogList(posts, selectedSlug);
        })
        .catch(() => {
            if (blogPostsList) {
                blogPostsList.innerHTML = `
                    <div class="loading-state text-danger">
                        <i class="fa-solid fa-circle-exclamation"></i> 加载列表失败
                    </div>
                `;
            }
        });
}

// --------------------------------------------------------------------------
// Render List
// --------------------------------------------------------------------------
function renderBlogList(posts, selectedSlug = null) {
    const { blogPostsList } = getBlogElements();
    if (!blogPostsList) return;

    if (posts.length === 0) {
        blogPostsList.innerHTML = `
            <div class="loading-state">
                <i class="fa-regular fa-folder-open"></i> 暂无随笔。
            </div>
        `;
        return;
    }

    blogPostsList.innerHTML = '';
    posts.forEach(post => {
        const item = document.createElement('div');
        item.className = 'post-item-small';
        if (selectedSlug === post.slug) item.classList.add('active');

        item.addEventListener('click', () => {
            window.location.hash = `blog/${post.slug}`;
        });

        const tagsHtml = (post.tags && post.tags.length)
            ? `<div class="post-item-tags">${post.tags.slice(0, 3).map(t => `#${escapeHtml(t)}`).join(' ')}</div>`
            : '';

        const summaryHtml = post.summary
            ? `<p class="post-item-summary-preview">${escapeHtml(post.summary)}</p>`
            : '';

        item.innerHTML = `
            <h4>${escapeHtml(post.title)}</h4>
            ${summaryHtml}
            <div class="post-item-meta-row">
                <span class="post-item-date">${post.date || ''}</span>
                ${tagsHtml}
            </div>
        `;
        blogPostsList.appendChild(item);
    });
}

// --------------------------------------------------------------------------
// Load Post Detail
// --------------------------------------------------------------------------
export function loadBlogPostDetail(slug) {
    const {
        blogEmptyState,
        blogEditView,
        blogDetailView,
        detailTitle,
        detailDate,
        detailTags,
        detailContent,
        blogPostsList,
        blogDetailPane,
        postOpsMenu,
    } = getBlogElements();

    hide(blogEmptyState);
    hide(blogEditView);
    show(blogDetailView);

    if (detailTitle) detailTitle.textContent = '';
    if (detailDate)  detailDate.textContent  = '';
    if (detailTags)  detailTags.textContent  = '';
    if (detailContent) {
        detailContent.innerHTML = `
            <div class="loading-state">
                <i class="fa-solid fa-spinner fa-spin"></i> 正在读取文章正文...
            </div>
        `;
    }

    // Sync active state in list
    if (blogPostsList) {
        qsa('.post-item-small', blogPostsList).forEach(i => i.classList.remove('active'));
    }

    PostsAPI.get(slug)
        .then(post => {
            appState.currentActivePost = post;

            if (detailTitle) detailTitle.textContent = post.title;
            if (detailDate)  detailDate.innerHTML = `<i class="fa-regular fa-calendar"></i> ${post.date}`;
            if (detailTags) {
                detailTags.innerHTML = post.tags && post.tags.length
                    ? `<i class="fa-solid fa-tags"></i> ` + post.tags.map(t => `<span>#${escapeHtml(t)}</span>`).join(' ')
                    : '';
            }

            if (detailContent) {
                detailContent.innerHTML = typeof marked !== 'undefined'
                    ? marked.parse(post.content)
                    : `<pre>${escapeHtml(post.content)}</pre>`;
            }

            // Scroll to the start of the post
            if (window.innerWidth < 850) {
                const bDetailView = el('blog-detail-view');
                if (bDetailView) {
                    bDetailView.scrollIntoView({ behavior: 'auto', block: 'start' });
                }
            } else {
                const mainPane = document.querySelector('.blog-main-pane');
                if (mainPane) {
                    mainPane.scrollTop = 0;
                }
            }

            if (blogDetailPane) {
                blogDetailPane.classList.remove('animate-fade-in');
                void blogDetailPane.offsetWidth; // Force reflow
                blogDetailPane.classList.add('animate-fade-in');
            }

            if (appState.isEditMode) show(postOpsMenu);
            else hide(postOpsMenu);

            renderBlogList(appState.blogPostsData, slug);
        })
        .catch(() => {
            if (detailContent) {
                detailContent.innerHTML = `
                    <div class="loading-state text-danger">
                        <i class="fa-solid fa-circle-exclamation"></i> 读取文章内容失败，该文章可能已被删除。
                    </div>
                `;
            }
            hide(postOpsMenu);
        });
}

// --------------------------------------------------------------------------
// Forms: Create / Edit / Cancel
// --------------------------------------------------------------------------
function showCreateForm() {
    if (!appState.isEditMode) return;
    const {
        blogEmptyState,
        blogDetailView,
        blogEditView,
        formViewTitle,
        formPostId,
        formTitle,
        formTags,
        formSummary,
        formDate,
        formContent,
    } = getBlogElements();

    hide(blogEmptyState);
    hide(blogDetailView);
    show(blogEditView);

    if (formViewTitle) formViewTitle.textContent = '撰写随笔';
    if (formPostId)    formPostId.value  = '';
    if (formTitle)     formTitle.value   = '';
    if (formTags)      formTags.value    = '';
    if (formSummary)   formSummary.value = '';
    if (formDate)      formDate.value    = new Date().toISOString().split('T')[0];
    if (formContent)   formContent.value = '';
}

function showEditForm() {
    if (!appState.isEditMode || !appState.currentActivePost) return;
    const post = appState.currentActivePost;
    const {
        blogEmptyState,
        blogDetailView,
        blogEditView,
        formViewTitle,
        formPostId,
        formTitle,
        formTags,
        formSummary,
        formDate,
        formContent,
    } = getBlogElements();

    hide(blogEmptyState);
    hide(blogDetailView);
    show(blogEditView);

    if (formViewTitle) formViewTitle.textContent = '编辑随笔';
    if (formPostId)    formPostId.value = post.id;
    if (formTitle)     formTitle.value  = post.title;
    if (formTags)      formTags.value   = (post.tags || []).join(', ');
    if (formSummary)   formSummary.value = post.summary || '';
    if (formDate)      formDate.value    = post.date    || '';
    if (formContent)   formContent.value = post.content || '';
}

function cancelFormEdit() {
    const { blogEditView, blogDetailView, postOpsMenu, blogEmptyState } = getBlogElements();
    hide(blogEditView);
    if (appState.currentActivePost) {
        show(blogDetailView);
        if (appState.isEditMode) show(postOpsMenu);
    } else {
        show(blogEmptyState);
    }
}

// --------------------------------------------------------------------------
// Submit (Create or Update)
// --------------------------------------------------------------------------
function submitPostForm() {
    if (!appState.isEditMode) return;
    const { formTitle, formContent, formSummary, formTags, formDate, formPostId } = getBlogElements();

    const title   = formTitle ? formTitle.value.trim() : '';
    const content = formContent ? formContent.value.trim() : '';
    const summary = formSummary ? formSummary.value.trim() : '';
    const tags    = formTags ? formTags.value.trim() : '';
    const date    = formDate ? formDate.value.trim() : '';
    const id      = formPostId ? formPostId.value : '';

    if (!title || !content) {
        showToast('请填入必填项（标题和内容）', 'error');
        return;
    }

    const payload   = { title, content, summary, tags, date };
    const operation = id ? PostsAPI.update(id, payload) : PostsAPI.create(payload);

    operation
        .then(data => {
            const slug = data.slug || id;
            showToast(id ? '随笔已更新' : '随笔已创建', 'success');
            if (!slug) {
                fetchBlogList();
                window.location.hash = 'blog';
                return;
            }
            fetchBlogList(slug);
            window.location.hash = `blog/${slug}`;
        })
        .catch(err => showToast(`保存随笔失败：${err.message}`, 'error'));
}

// --------------------------------------------------------------------------
// Delete
// --------------------------------------------------------------------------
async function executeDeletePost() {
    if (!appState.isEditMode || !appState.currentActivePost) return;

    const confirmed = await confirmDialog('确认要删除这篇随笔吗？此操作不可撤销。');
    if (!confirmed) return;

    PostsAPI.delete(appState.currentActivePost.id)
        .then(() => {
            showToast('随笔已成功删除', 'success');
            appState.currentActivePost = null;
            fetchBlogList();
            closePostDetail();
        })
        .catch(err => showToast(`删除随笔失败：${err.message}`, 'error'));
}

export function closePostDetail() {
    const { blogDetailView, blogEditView, blogEmptyState, postOpsMenu, blogPostsList } = getBlogElements();
    hide(blogDetailView);
    hide(blogEditView);
    show(blogEmptyState);
    hide(postOpsMenu);

    if (blogPostsList) {
        qsa('.post-item-small', blogPostsList).forEach(i => i.classList.remove('active'));
    }
    fetchBlogList();
}
