// ==========================================================================
// data/siteContent.js — Centralized UI Text & Site Resources Configuration
// All copywriting, links, and text resources are managed here, strictly
// decoupled from rendering logic and HTML templates.
// ==========================================================================

export const siteContent = {
    site: {
        name: 'rakuen',
        domain: '.live',
        kanji: '楽園',
        copyright: '© 2026 楽園 rakuen.live',
        authorCredits: 'Designed by toki; All rights reserved.',
    },
    navigation: [
        { id: 'hub', icon: 'fa-solid fa-compass', label: '楽園中枢 / Hub', shortLabel: '中枢' },
        { id: 'about', icon: 'fa-solid fa-user', label: '关于園長 / About', shortLabel: '关于' },
        { id: 'blog', icon: 'fa-solid fa-feather', label: '楽園随笔 / Blog', shortLabel: '随笔' },
        { id: 'folios', icon: 'fa-solid fa-book-bookmark', label: '朝花夕拾 / Folios', shortLabel: '朝花夕拾' },
    ],
    hub: {
        title: '楽園中枢',
        subtitle: '楽園是由園長 toki 维护的个人数字空间。在浩繁的互联网中，试图留存一隅冷静的孤岛。',
        cards: [
            {
                type: 'link',
                status: 'ONLINE',
                statusClass: 'active',
                icon: 'fa-solid fa-box-archive',
                title: 'K王朝吧 历史数据存档 (20260609)',
                description: '由于信不过度娘，建了个小网站保存K王朝吧的历史。欢迎新老吧友(?)访问。',
                linkUrl: 'http://k.rakuen.live',
                linkText: '访问 k.rakuen.live',
                isExternal: true,
            },
            {
                type: 'link',
                status: 'ACTIVE',
                statusClass: 'active',
                icon: 'fa-solid fa-feather',
                title: 'toki 的个人随笔',
                quote: '自其变者而观之，则天地曾不能以一瞬；自其不变者而观之，则物与我皆无尽也，而又何羡乎！',
                linkUrl: '#blog',
                linkText: '查看随笔',
                isExternal: false,
            },
            {
                type: 'link',
                status: 'ACTIVE',
                statusClass: 'active',
                icon: 'fa-solid fa-book-bookmark',
                title: '朝花夕拾',
                description: '園長の文学创作。欢迎翻阅。',
                linkUrl: '#folios',
                linkText: '批判作品',
                isExternal: false,
            },
            {
                type: 'disabled',
                status: 'STANDBY',
                statusClass: 'planning',
                icon: 'fa-solid fa-baseball',
                title: '未来的遗迹',
                description: '等待下一次的废墟重建。',
                linkText: '等待数据注入',
            },
        ],
    },
    about: {
        title: '关于園長',
        subtitle: '来自楽園维护者 toki 的一些陈述。',
        avatar: 'assets/toki_icon.PNG',
        authorName: 'toki',
        authorSubtitle: 'An awkward yet composed tech worker, world observer, fusion keyboardist, and storyteller.',
        bioParagraphs: [
            '欢迎来到楽園！我是園長 toki。请随便坐。',
            '总的来说，我不太喜欢人多的地方。所以提到个人主页，我脑中浮现的尽是世界尽头孤岛上早已荒废的游乐园。rakuen.live 的想法从 2017 年就有了，借着复刻老贴吧的契机，也感谢 Vibe Coding 的出现，让我终于能在这里升起一把火，搭起自己的小木屋。',
            '老实说，我实在厌恶为了什么争抢个你死我活。所以这里刚好，能躲一躲扑面而来的信息洪流。園長会尽可能体面地，把那些涌出脑海又即将消亡的思绪记录下来，小心晾晒在竹竿上。',
            '支撑着我生活下去的念头其实很简单：纵使我们现在深陷于光怪陆离的现实和牛鬼蛇神的包围中，这些在空中飘扬的痕迹，也或许能在亿万年后，与某种新鲜生物发生奇妙的共鸣。',
            '因此，只要当下还能发出声音，那一切就还没有特别糟。',
            '非常欢迎你来看看我这个诚实的家园。如果你刚好路过，可以通过以下方式联系我：',
        ],
        socialLinks: [
            { name: 'GitHub', icon: 'fa-brands fa-github', url: 'https://github.com/toki-sgr' },
            { name: 'Email', icon: 'fa-solid fa-envelope', url: 'mailto:toki.me@icloud.com' },
            { name: 'LinkedIn', icon: 'fa-brands fa-linkedin', url: 'https://www.linkedin.com/in/yubo-cheng-52b930208/' },
            { name: 'Facebook', icon: 'fa-brands fa-facebook', url: 'https://www.facebook.com/profile.php?id=100036074450664' },
        ],
    },
    folios: {
        title: '朝花夕拾',
        subtitle: '从岁月深处拾起的断章。在流逝的时间里，沉淀为旧的存在，又蔓延出新的荒芜。',
    },
    blog: {
        emptyStateText: '请在左侧选择一篇随笔开始阅读',
    },
};
