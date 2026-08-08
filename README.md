# rakuen.live

園長 toki 的个人网站。内容全部是磁盘上的 Markdown，没有数据库。

前端是 Vite + 原生 ES 模块的单页应用，后端是一个把 `content/` 读成 JSON 的 Flask API。

---

## 一、加内容

只有一条规则：

> **一个条目 = 一个目录。它用到的图片、音频，就放在同一个目录里。**

```text
content/
├── posts/
│   ├── hello-world.md              # 没有配图时，单文件就够
│   └── 某篇带图的随笔/
│       ├── index.md
│       └── 配图.png                 # 正文里写 ![](配图.png) 即可
├── books/
│   ├── progressive-time/           # 单卷：章节直接放在书目录下
│   │   ├── index.md
│   │   ├── cover.png
│   │   ├── 01-氤氲晚霞 1.md
│   │   ├── 02-氤氲晚霞 2.md
│   │   └── _source/                # ← 下划线开头，站点永远看不见
│   │       └── cover_original.png
│   └── cloudshore-wildfire/        # 多卷：一卷一个子目录
│       ├── index.md                #   整本：title / kind / year
│       ├── 云岸/
│       │   ├── index.md            #   这一卷：title / cover / status / summary
│       │   ├── cover.png
│       │   └── 01-滨海邮轮.md
│       └── 山火/…
└── albums/
    └── Rain of 2010/
        ├── index.md
        ├── cover.png
        ├── 01-灯火和夜晚的境界线.md
        └── Where the light meets the night.wav
```

三件事因此成立：

- **加一卷 = 新建一个子目录。** 卷数没有上限。
  （书架封面卡片只翻转前两卷，再多的卷在阅读器目录里正常显示。）
- **`_` 开头的文件和目录一律忽略。** 原图、草稿、笔记随便堆在 `_source/` 里，不会被读取、不会被serve、不会进部署包。
- **目录名随你改。** 见下。

### 文件名定顺序，`slug` 定网址

章节和曲目的文件名是 `序号-标题.md`：

```text
01-莫托瓦岛.md
02-余烬.md
03.1-妙境 1.md      ← 想插在 3 和 4 之间就写 03.1
03.2-妙境 2.md
```

**序号前缀既决定排序，也就是显示出来的序号**（`03.1` 显示为 `3.1`）。想显示别的（比如「序章」），在 frontmatter 里写 `number: 序章` 覆盖。

目录名只是你的归档标签，网址由 frontmatter 的 `slug` 决定：

```markdown
---
title: 2010年的雨
slug: rain-of-2010
---
```

不写 `slug` 就自动从目录名生成。**写了之后，目录名怎么改都不会断链。**

### 字段表

一套词汇，跨内容类型通用。

| 字段 | 含义 | 用在 |
| --- | --- | --- |
| `title` | 标题（必填） | 全部 |
| `slug` | 网址，缺省取目录名 | 随笔 / 作品 / 专辑 |
| `summary` | 一句话简介 | 随笔 / 卷 / 专辑 |
| `cover` | 封面，写同目录的文件名 | 卷 / 专辑 / 曲目 |
| `number` | **显示**序号，缺省取文件名前缀 | 章节 / 曲目 |
| `note` | 附注、改写记录、创作地点 | 章节 / 曲目 |
| `date` | 日期 | 随笔 |
| `tags` | 标签，逗号分隔 | 随笔 |
| `status` | `连载中` / `已完结` | 卷 |
| `kind` | `短篇` / `长篇` / `短篇集` | 作品 |
| `year` | 创作年限，如 `2013~` | 作品 / 专辑 |
| `artist` `audio` `duration` `quote` | 曲目专有 | 曲目 |

单卷作品没有卷子目录，所以它的 `index.md` 同时写作品字段和卷字段。

`duration` 不写就由播放器从音频元数据自动读出。`audio` 不写就自动挑目录里第一个音频文件。

### 打错了怎么办

```bash
npm run check
```

扫描全部内容文件，报告未知字段、缺失必填项、指向不存在的文件、重复的 slug。
字段拼错算**错误**（退出码 1）；文件还没放算**待办**（退出码 0）。推送前跑一下。

它没有挂在 `npm run build` 上，是有意的 —— 部署构建不该依赖构建环境里有没有 Python。

---

## 二、本地运行

```bash
npm install
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
```

内容 API（读取，以及编辑模式下的写入）：

```bash
npm run api
```

前端（Vite 把 `/api` 代理到上面的 8001 端口）：

```bash
npm run dev
```

打开 http://localhost:3000 。编辑模式口令默认 `rakuen`，用环境变量覆盖：

```bash
RAKUEN_EDIT_PASSWORD=你的口令 npm run api
```

---

## 三、代码结构

```text
index.html              壳：侧栏骨架 + 两个挂载点，不含内容
main.js                 入口：渲染壳、装配路由
data/site.js            所有文案与站点资源

modules/core/           与具体栏目无关的底座
├── dom.js              h() 建元素（文本自动转义，没有手写 escapeHtml）
├── router.js           hash 路由；导航与 tab 面板都由 views 注册表生成
├── api.js              内容 API 客户端
├── edit.js             编辑模式 + 口令弹窗
├── markdown.js         marked 渲染；相对图片路径按条目目录解析
└── toast.js            提示与确认框

modules/components/     跨栏目复用的 UI
├── form.js             用数据描述表单
├── readingLayout.js    「左列表 + 右正文」布局与文章面板
├── states.js           加载 / 空 / 失败占位
└── photoWall.js        侧栏图片轮换

modules/views/          一个栏目一个模块
├── index.js            ★ 注册表：加一个 tab 只需在这里加一行
├── hub.js  about.js  blog.js  music.js
└── folios/             书架 / 阅读器 / 表单

api/
├── index.py            入口（Vercel 与本地共用）
└── _lib/
    ├── config.py       目录位置与运行设置
    ├── md.py           frontmatter 解析、slug、编号排序、URL 解析
    ├── schema.py       字段声明 + 校验；frontmatter ⇄ JSON 只写一次
    ├── store.py        内容目录的读写
    ├── models.py       ★ 内容类型：posts / books / albums
    ├── http.py         鉴权与错误处理
    └── app.py          路由装配

scripts/check_content.py  内容校验（npm run check）
styles/                   分片 CSS，由 style.css 汇总
```

栏目的界面名字和代码里的名词是分开的 —— 界面叫「朝花夕拾 / Folios」，路由是 `#folios`，
而内容类型就叫 `books`。随笔同理：路由 `#blog`，类型 `posts`。

### 加一个新栏目

1. 写 `modules/views/<名字>.js`，导出 `{ id, nav, render, route }`；
2. 在 `modules/views/index.js` 的数组里加一项。

导航按钮、tab 面板、`#<id>` 路由都会自动出现。若还需要自己的内容目录，
在 `api/_lib/models.py` 里加一个继承 `Collection` 的类，并在 `api/_lib/app.py` 加一行 `crud(...)`。

---

## 四、API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/posts` · `/api/posts/<slug>` | 随笔 |
| GET | `/api/books` · `/api/books/<slug>` | 作品（含 `volumes[]`） |
| GET | `/api/books/<slug>/chapters/<number>?volume=<卷>` | 章节 |
| GET | `/api/albums` · `/api/albums/<slug>` | 专辑（含 `tracks[]`） |
| POST/PUT/DELETE | 同上（albums 除外） | 需 `X-Edit-Password` 请求头 |
| POST | `/api/auth` | 校验口令 |

单卷作品的 `volume` 是空字符串，因此前后端都只有一条代码路径。
每个条目还会带一个 `assets` 字段，指向它自己的目录，正文里的相对图片路径按它解析。

---

## 五、部署

Vercel：`vercel.json` 用 `npm run build` 产出 `dist/`，`/api/*` 交给 `api/index.py`
（`includeFiles: content/**` 保证内容随函数一起打包）。构建会跳过所有 `_` 开头的文件。

Serverless 文件系统只读，因此线上只能浏览，编辑请在本地进行 —— 写入接口返回明确的 503
而不是静默失败。设 `RAKUEN_READONLY=1` 可让它直接拒绝。
