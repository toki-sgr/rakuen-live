// ==========================================================================
// views/blog.js — 楽園随笔
// ==========================================================================

import * as api from '../core/api.js';
import { h, icon } from '../core/dom.js';
import { isEditing, onEditChange } from '../core/edit.js';
import { renderMarkdown } from '../core/markdown.js';
import { go } from '../core/router.js';
import { confirmDialog, toast } from '../core/toast.js';
import { createForm } from '../components/form.js';
import {
    createArticlePane, createSplitPane, markActive, renderItems,
} from '../components/readingLayout.js';
import { empty, failed, loading } from '../components/states.js';
import { sections } from '../../data/site.js';

const FIELDS = [
    { name: 'title', label: '标题 *', placeholder: '文章标题...' },
    {
        row: [
            { name: 'tags', label: '标签', placeholder: '逗号分隔' },
            { name: 'date', label: '日期', type: 'date' },
        ],
    },
    { name: 'summary', label: '概要介绍', placeholder: '输入文章简短概要...' },
    { name: 'content', label: '内容 (Markdown) *', type: 'textarea', rows: 14, placeholder: '使用 Markdown 语法书写正文内容...' },
];

// null until the index has been fetched — an empty array is a real answer.
let cached = null;
let active = null;

const pane = createSplitPane({
    prefix: 'blog',
    newLabel: '新增',
    emptyText: sections.blog.emptyText,
    onNew: () => openForm(null),
});

const article = createArticlePane({
    editLabel: '编辑',
    deleteLabel: '删除',
    paneSelector: '.blog-main-pane',
    onEdit: () => openForm(active),
    onDelete: () => removePost(),
});

const form = createForm(FIELDS, {
    submitText: '保存文章',
    onCancel: () => (active ? showArticle() : pane.showEmpty()),
    onSubmit: () => submit(),
});

// --------------------------------------------------------------------------
// List
// --------------------------------------------------------------------------
function listItem(post) {
    return h('div', { dataset: { slug: post.slug }, onClick: () => go('blog', post.slug) },
        h('h4', {}, post.title),
        post.summary ? h('p.post-item-summary-preview', {}, post.summary) : null,
        h('div.post-item-meta-row', {},
            h('span.post-item-date', {}, post.date || ''),
            post.tags.length
                ? h('div.post-item-tags', {}, post.tags.slice(0, 3).map((t) => `#${t}`).join(' '))
                : null,
        ),
    );
}

/**
 * Fetch and render the index once, then reuse it.
 *
 * Navigating between posts used to refetch the whole list and rebuild every
 * row, which also threw away the list's scroll position.
 */
async function ensureList({ force = false } = {}) {
    if (cached && !force) return cached;

    try {
        cached = await api.posts.list();
    } catch {
        pane.list.replaceChildren(failed('加载列表失败'));
        return null;
    }

    if (!cached.length) pane.list.replaceChildren(empty('暂无随笔。'));
    else renderItems(pane.list, cached, listItem);

    return cached;
}

// --------------------------------------------------------------------------
// Detail
// --------------------------------------------------------------------------
function showArticle() {
    pane.show(article.root);
    article.setOpsVisible(isEditing());
}

async function openPost(slug) {
    pane.show(article.root);
    article.setTitle('');
    article.setMeta();
    article.setOpsVisible(false);
    article.body.replaceChildren(loading('正在读取文章正文...'));

    try {
        active = await api.posts.get(slug);
    } catch {
        article.body.replaceChildren(failed('读取文章内容失败，该文章可能已被删除。'));
        return;
    }

    article.setTitle(active.title);
    article.setMeta(
        h('span', {}, icon('fa-regular fa-calendar'), ` ${active.date}`),
        active.tags.length
            ? h('span', {}, icon('fa-solid fa-tags'), ' ', active.tags.map((t) => h('span', {}, `#${t} `)))
            : null,
    );
    renderMarkdown(article.body, active.content, active.assets);
    article.setOpsVisible(isEditing());
    article.reveal();
    markActive(pane.list, (data) => data.slug === slug);
}

// --------------------------------------------------------------------------
// Editing
// --------------------------------------------------------------------------
function openForm(post) {
    if (!isEditing()) return;
    form.setTitle(post ? '编辑随笔' : '撰写随笔');
    form.setValues(post
        ? { ...post, tags: post.tags.join(', ') }
        : { date: new Date().toISOString().slice(0, 10) });
    pane.show(form.root);
    form.focus('title');
}

async function submit() {
    const values = form.values();
    if (!values.title || !values.content) {
        toast('请填入必填项（标题和内容）', 'error');
        return;
    }

    const payload = { ...values, tags: values.tags.split(',').map((t) => t.trim()).filter(Boolean) };

    try {
        const saved = active
            ? await api.posts.update(active.slug, payload)
            : await api.posts.create(payload);
        toast(active ? '随笔已更新' : '随笔已创建', 'success');
        await ensureList({ force: true });
        go('blog', saved.slug);
    } catch (err) {
        toast(`保存随笔失败：${err.message}`, 'error');
    }
}

async function removePost() {
    if (!isEditing() || !active) return;
    if (!await confirmDialog('确认要删除这篇随笔吗？此操作不可撤销。')) return;

    try {
        await api.posts.remove(active.slug);
        toast('随笔已成功删除', 'success');
        active = null;
        await ensureList({ force: true });
        go('blog');
    } catch (err) {
        toast(`删除随笔失败：${err.message}`, 'error');
    }
}

onEditChange((editing) => {
    pane.setNewVisible(editing);
    article.setOpsVisible(editing && !!active);
    if (!editing && pane.main.firstChild === form.root) {
        active ? showArticle() : pane.showEmpty();
    }
});

export default {
    id: 'blog',
    nav: { icon: 'fa-solid fa-feather', label: '楽園随笔 / Blog', short: '随笔' },

    render: () => pane.root,

    async route([slug]) {
        const posts = await ensureList();

        if (slug) {
            openPost(slug);
            return;
        }

        // Landing on the section with nothing chosen used to show a "pick
        // something on the left" placeholder — a dead end on a first visit.
        // Open the most recent piece instead and let the reader start reading.
        if (posts && posts.length) {
            go('blog', posts[0].slug);
            return;
        }

        active = null;
        pane.showEmpty();
    },
};
