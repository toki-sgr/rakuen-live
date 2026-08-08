// ==========================================================================
// views/folios/forms.js — Editing books and chapters
// ==========================================================================

import { h } from '../../core/dom.js';
import { createForm } from '../../components/form.js';

const STATUS = ['连载中', '已完结'];
const KINDS = ['短篇', '长篇', '短篇集'];

/** The four fields that describe one volume, prefixed so names stay unique. */
const volumeFields = (prefix, titleLabel, coverHint) => [
    { name: `${prefix}_title`, label: `${titleLabel} *`, placeholder: 'e.g. 云岸' },
    {
        row: [
            { name: `${prefix}_cover`, label: '封面路径', placeholder: coverHint },
            { name: `${prefix}_status`, label: '更新状态 *', type: 'select', options: STATUS },
        ],
    },
    { name: `${prefix}_summary`, label: '简介 *', type: 'textarea', rows: 3, placeholder: '简要描述作品的背景与故事概要...' },
];

/**
 * @param {{onSubmit: (payload, slug) => void, onCancel: Function}} handlers
 */
export function createNovelForm({ onSubmit, onCancel }) {
    let editing = null;

    const form = createForm([
        { name: 'title', label: '作品名称 *', placeholder: 'e.g. 渐进的时间' },
        {
            row: [
                { name: 'kind', label: '作品类别 *', type: 'select', options: KINDS },
                { name: 'year', label: '创作年限', placeholder: 'e.g. 2025~ 或 2021~2024' },
            ],
        },
        { name: 'multi', label: '是否为双面翻转书 (Reversible Book)', type: 'checkbox' },
        {
            group: 'single',
            fields: [
                {
                    row: [
                        { name: 'cover', label: '封面图片路径', placeholder: '同目录文件名，如 cover.png' },
                        { name: 'status', label: '更新状态 *', type: 'select', options: STATUS },
                    ],
                },
                { name: 'summary', label: '作品简介 *', type: 'textarea', rows: 5, placeholder: '简要描述作品的背景与故事概要...' },
            ],
        },
        {
            group: 'v1',
            title: '正面 (Front Face) 配置',
            fields: volumeFields('v1', '正面子集书名', '同目录文件名，如 cover.png'),
        },
        {
            group: 'v2',
            title: '反面 (Back Face) 配置',
            fields: volumeFields('v2', '反面子集书名', '同目录文件名，如 cover.png'),
        },
    ], {
        className: '.novel-form-constrained',
        submitText: '保存作品',
        onCancel,
        onSubmit: () => onSubmit(payload(), editing && editing.slug),
    });

    function applyMode(multi) {
        form.setGroupVisible('single', !multi);
        form.setGroupVisible('v1', multi);
        form.setGroupVisible('v2', multi);
    }
    form.onChange('multi', applyMode);

    /** Reuse the existing directory so renaming a volume never moves files. */
    const volumeDir = (index) =>
        (editing && editing.volumes[index] && editing.volumes[index].dir) || '';

    function payload() {
        const v = form.values();
        const volumes = v.multi
            ? [
                { dir: volumeDir(0), title: v.v1_title, cover: v.v1_cover, status: v.v1_status, summary: v.v1_summary },
                { dir: volumeDir(1), title: v.v2_title, cover: v.v2_cover, status: v.v2_status, summary: v.v2_summary },
            ]
            : [{ title: v.title, cover: v.cover, status: v.status, summary: v.summary }];

        return { title: v.title, kind: v.kind, year: v.year, volumes };
    }

    return {
        root: form.root,

        open(novel) {
            editing = novel;
            const multi = !!novel && novel.volumes.length > 1;
            const [first, second] = novel ? novel.volumes : [];

            form.setTitle(novel ? '编辑作品' : '新增作品');
            form.setValues({
                title: novel ? novel.title : '',
                kind: novel ? novel.kind : '短篇',
                year: novel ? novel.year : '',
                multi,
                cover: !multi && first ? first.cover : '',
                status: !multi && first ? first.status : '连载中',
                summary: !multi && first ? first.summary : '',
                v1_title: multi ? first.title : '',
                v1_cover: multi ? first.cover : '',
                v1_status: multi ? first.status : '连载中',
                v1_summary: multi ? first.summary : '',
                v2_title: multi ? second.title : '',
                v2_cover: multi ? second.cover : '',
                v2_status: multi ? second.status : '已完结',
                v2_summary: multi ? second.summary : '',
            });
            applyMode(multi);
            form.focus('title');
        },
    };
}

/**
 * @param {{onSubmit: (payload, chapter) => void, onCancel: Function}} handlers
 */
export function createChapterForm({ onSubmit, onCancel }) {
    let editing = null;

    const form = createForm([
        { name: 'volume', label: '选择分卷 *', type: 'select', options: [] },
        { name: 'title', label: '章节标题 *', placeholder: '章节标题...' },
        {
            row: [
                { name: 'number', label: '章节序号 (留空则自动递增，支持 3.1)', placeholder: 'e.g. 1 或 3.1' },
                { name: 'note', label: '改写记录/历史', placeholder: 'e.g. 2020.9.12 广州' },
            ],
        },
        { name: 'content', label: '章节内容 (Markdown) *', type: 'textarea', rows: 18, placeholder: '书写章节正文内容...' },
    ], {
        submitText: '保存章节',
        onCancel,
        onSubmit: () => onSubmit(form.values(), editing),
    });

    const volumeSelect = form.get('volume');
    const volumeGroup = volumeSelect.closest('.form-group');

    return {
        root: form.root,

        /** @param {object} novel @param {object|null} chapter @param {string} volumeSlug */
        open(novel, chapter, volumeSlug) {
            editing = chapter;

            // Choosing a volume only makes sense while creating, and only for
            // books that have more than one.
            const choosable = !chapter && novel.volumes.length > 1;
            volumeGroup.classList.toggle('hidden', !choosable);
            volumeSelect.replaceChildren(...novel.volumes.map((v) =>
                h('option', { value: v.slug }, v.title)));
            volumeSelect.value = chapter ? (chapter.volume || '') : (volumeSlug || novel.volumes[0].slug);

            form.setTitle(chapter ? '编辑章节' : '新增章节');
            form.setValues({
                volume: volumeSelect.value,
                title: chapter ? chapter.title : '',
                number: chapter ? chapter.number : '',
                note: chapter ? chapter.note : '',
                content: chapter ? chapter.content : '',
            });
            volumeSelect.value = chapter ? (chapter.volume || '') : (volumeSlug || novel.volumes[0].slug);
            form.focus('title');
        },
    };
}
