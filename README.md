# rakuen.live - Personal Website

Welcome to the repository for `rakuen.live`, my personal website.

This website is designed with a **clean, Apple/Notion-like minimalist light theme** and is structured as a fast, high-performance static single-page application (SPA).

## Features
- **Segmented Control Navigation**: A smooth, iOS-style tab navigation container switching between Hub, About, and Blog panels.
- **Portal Hub**: Links and metadata for various subdomains and projects (e.g. `k.rakuen.live` for the K-王朝 Tieba Archive).
- **Dynamic Markdown Blog**: A client-side markdown loader. Blog posts are written in standard Markdown (`.md` files) and dynamically compiled on-the-fly via `marked.js` in the browser.
- **SEO & Hash Routing**: Supports full URL state routing (`#hub`, `#about`, `#blog`, `#blog/post-slug`) allowing bookmarks and native browser navigation history.

## File Structure
```text
rakuen-live/
├── index.html         # Main entry page
├── style.css          # Minimalist layout styling
├── main.js            # Router, tab animations & Markdown fetching
├── blog/
│   ├── posts.json     # Blog metadata registry index
│   └── posts/
│       ├── hello-world.md
│       └── k-wangchao-preservation.md
└── README.md
```

## Running Locally
Since the blog engine relies on `fetch()` to load Markdown documents and JSON metadata, running this site requires a local HTTP server (browsers block file-system fetches via `file://` protocol due to CORS security policies).

You can easily run a local server using Python:
```bash
# In the project directory:
python -m http.server 8000
```
Then open `http://localhost:8000` in your web browser.

## Deployment
This website is completely static and can be hosted for free on:
- **GitHub Pages**: Go to Repository Settings -> Pages, select the `main` branch, and click Save. Add a custom CNAME `rakuen.live`.
- **Render**: Create a new static site service, link it to this repository, and set the build command to empty and publish directory to `.`.
- **Vercel**: Link repository, select "Other" framework, and deploy.
