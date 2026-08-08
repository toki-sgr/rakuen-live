# -*- coding: utf-8 -*-
from flask import Flask, render_template, request, jsonify, send_from_directory
import datetime
import os
import re
import json

app = Flask(__name__, static_folder='..', static_url_path='')

@app.after_request
def add_header(response):
    if request.path.startswith('/api/'):
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
    return response

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POSTS_DIR = os.path.join(BASE_DIR, 'blog', 'posts')
NOVELS_DIR = os.path.join(BASE_DIR, 'folios')

# Ensure directories exist
os.makedirs(POSTS_DIR, exist_ok=True)
os.makedirs(NOVELS_DIR, exist_ok=True)

# --------------------------------------------------------------------------
# Helper Functions for Flat-File Markdown parsing
# --------------------------------------------------------------------------
def parse_markdown_file(filepath):
    if not os.path.exists(filepath):
        return {}, ""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return {}, ""
        
    metadata = {}
    body = content
    
    if content.startswith('---'):
        parts = content.split('---', 2)
        if len(parts) >= 3:
            frontmatter = parts[1]
            body = parts[2].strip()
            
            for line in frontmatter.split('\n'):
                line = line.strip()
                if not line or ':' not in line:
                    continue
                key, val = line.split(':', 1)
                metadata[key.strip()] = val.strip()
    return metadata, body

def write_markdown_file(filepath, metadata, body):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    lines = ['---']
    for k, v in metadata.items():
        lines.append(f"{k}: {v}")
    lines.append('---')
    lines.append(body)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

def slugify(text):
    """Convert a title to a safe filesystem slug."""
    import unicodedata
    # Normalize unicode (e.g. full-width chars)
    text = unicodedata.normalize('NFKC', text)
    # Lowercase and replace spaces/underscores with hyphens
    text = text.lower().strip()
    text = re.sub(r'[\s_]+', '-', text)
    # Keep only ASCII letters, digits, CJK characters, and hyphens
    text = re.sub(r'[^\w\u4e00-\u9fff-]', '', text)
    text = re.sub(r'-+', '-', text).strip('-')
    return text or 'untitled'

def unique_slug(base_slug, exists_fn):
    """Return base_slug, or base_slug-2, base_slug-3 ... if already exists."""
    slug = base_slug
    counter = 2
    while exists_fn(slug):
        slug = f"{base_slug}-{counter}"
        counter += 1
    return slug



# --------------------------------------------------------------------------
# Serve Frontend
# --------------------------------------------------------------------------
@app.route('/')
def index():
    return send_from_directory('..', 'index.html')

@app.route('/folios/<path:filename>')
def serve_folios(filename):
    return send_from_directory(NOVELS_DIR, filename)

@app.route('/assets/<path:filename>')
def serve_assets(filename):
    assets_dir = os.path.join(BASE_DIR, 'assets')
    return send_from_directory(assets_dir, filename)

@app.route('/api/auth', methods=['POST'])
def verify_auth():
    data = request.json or {}
    password = data.get('password', '')
    if password == 'rakuen':
        return jsonify({"success": True})
    return jsonify({"error": "口令错误"}), 403


# --------------------------------------------------------------------------
# BLOG POSTS API ENDPOINTS
# --------------------------------------------------------------------------
@app.route('/api/posts', methods=['GET'])
def get_posts():
    posts = []
    if os.path.exists(POSTS_DIR):
        for file in os.listdir(POSTS_DIR):
            if file.endswith('.md'):
                filepath = os.path.join(POSTS_DIR, file)
                meta, body = parse_markdown_file(filepath)
                if meta:
                    tags_str = meta.get('tags', '')
                    tags = [t.strip() for t in tags_str.split(',')] if tags_str else []
                    posts.append({
                        'id': meta.get('slug'),  # set id to slug for frontend compatibility
                        'slug': meta.get('slug'),
                        'title': meta.get('title'),
                        'summary': meta.get('summary', ''),
                        'tags': tags,
                        'date': meta.get('date', '')
                    })
    posts.sort(key=lambda x: (x.get('date', ''), x['slug']), reverse=True)
    return jsonify(posts)

@app.route('/api/posts/<slug>', methods=['GET'])
def get_post_detail(slug):
    filepath = os.path.join(POSTS_DIR, f"{slug}.md")
    if not os.path.exists(filepath):
        return jsonify({"error": "Post not found"}), 404
        
    meta, body = parse_markdown_file(filepath)
    tags_str = meta.get('tags', '')
    tags = [t.strip() for t in tags_str.split(',')] if tags_str else []
    return jsonify({
        'id': meta.get('slug'),
        'slug': meta.get('slug'),
        'title': meta.get('title'),
        'summary': meta.get('summary', ''),
        'content': body,
        'tags': tags,
        'date': meta.get('date', '')
    })

@app.route('/api/posts', methods=['POST'])
def create_post():
    data = request.json
    password = data.get('password')
    if password != 'rakuen':
        return jsonify({"error": "口令错误"}), 403
        
    title = data.get('title')
    summary = data.get('summary', '').replace('\r\n', ' ').replace('\n', ' ').strip()
    content = data.get('content')
    tags = data.get('tags', '')
    
    if not title or not content:
        return jsonify({"error": "标题和内容不能为空"}), 400
    
    base_slug = slugify(title)
    slug = unique_slug(base_slug, lambda s: os.path.exists(os.path.join(POSTS_DIR, f"{s}.md")))
        
    filepath = os.path.join(POSTS_DIR, f"{slug}.md")
    date_str = datetime.date.today().strftime('%Y-%m-%d')
    meta = {
        'title': title,
        'slug': slug,
        'summary': summary,
        'tags': tags,
        'date': date_str
    }
    write_markdown_file(filepath, meta, content)
    return jsonify({"success": True})

@app.route('/api/posts/<post_slug>', methods=['PUT'])
def update_post(post_slug):
    data = request.json
    password = data.get('password')
    if password != 'rakuen':
        return jsonify({"error": "口令错误"}), 403
        
    title = data.get('title')
    content = data.get('content')
    summary = data.get('summary', '').replace('\r\n', ' ').replace('\n', ' ').strip()
    tags = data.get('tags', '')
    
    if not title or not content:
        return jsonify({"error": "标题和内容不能为空"}), 400
    
    slug = post_slug
    old_filepath = os.path.join(POSTS_DIR, f"{post_slug}.md")
    new_filepath = old_filepath
    
    if not os.path.exists(old_filepath):
        return jsonify({"error": "文章不存在"}), 404
        
    # Read old date
    old_meta, _ = parse_markdown_file(old_filepath)
    date_str = old_meta.get('date', datetime.date.today().strftime('%Y-%m-%d'))
    meta = {
        'title': title,
        'slug': slug,
        'summary': summary,
        'tags': tags,
        'date': date_str
    }
    
    write_markdown_file(new_filepath, meta, content)
    return jsonify({"success": True})

@app.route('/api/posts/<post_slug>', methods=['DELETE'])
def delete_post(post_slug):
    data = request.json or {}
    password = data.get('password')
    if password != 'rakuen':
        return jsonify({"error": "口令错误"}), 403
        
    filepath = os.path.join(POSTS_DIR, f"{post_slug}.md")
    if os.path.exists(filepath):
        os.remove(filepath)
        return jsonify({"success": True})
    return jsonify({"error": "文章不存在"}), 404

# --------------------------------------------------------------------------
# NOVELS API ENDPOINTS
# --------------------------------------------------------------------------
@app.route('/api/novels', methods=['GET'])
def get_novels():
    novels = []
    if os.path.exists(NOVELS_DIR):
        for folder in os.listdir(NOVELS_DIR):
            novel_path = os.path.join(NOVELS_DIR, folder)
            if not os.path.isdir(novel_path):
                continue
            index_path = os.path.join(novel_path, 'index.md')
            if os.path.exists(index_path):
                meta, _ = parse_markdown_file(index_path)
                is_reversible = meta.get('type') == 'reversible'
                slug = folder
                
                if is_reversible:
                    front_slug = meta.get('front_slug', 'front')
                    front_path = os.path.join(novel_path, front_slug)
                    front_ch_count = 0
                    front_word_count = 0
                    if os.path.exists(front_path) and os.path.isdir(front_path):
                        for file in os.listdir(front_path):
                            if file.startswith('chapter-') and file.endswith('.md'):
                                front_ch_count += 1
                                _, body = parse_markdown_file(os.path.join(front_path, file))
                                front_word_count += len(body)
                                
                    back_slug = meta.get('back_slug', 'back')
                    back_path = os.path.join(novel_path, back_slug)
                    back_ch_count = 0
                    back_word_count = 0
                    if os.path.exists(back_path) and os.path.isdir(back_path):
                        for file in os.listdir(back_path):
                            if file.startswith('chapter-') and file.endswith('.md'):
                                back_ch_count += 1
                                _, body = parse_markdown_file(os.path.join(back_path, file))
                                back_word_count += len(body)
                                
                    novels.append({
                        'id': slug,
                        'slug': slug,
                        'type': 'reversible',
                        'title': meta.get('title'),
                        'classification': meta.get('classification', '短篇集'),
                        'front_title': meta.get('front_title'),
                        'front_slug': front_slug,
                        'front_cover': meta.get('front_cover'),
                        'front_status': meta.get('front_status', '连载中'),
                        'front_summary': meta.get('front_summary', ''),
                        'front_chapter_count': front_ch_count,
                        'front_word_count': front_word_count,
                        'back_title': meta.get('back_title'),
                        'back_slug': back_slug,
                        'back_cover': meta.get('back_cover'),
                        'back_status': meta.get('back_status', '已完结'),
                        'back_summary': meta.get('back_summary', ''),
                        'back_chapter_count': back_ch_count,
                        'back_word_count': back_word_count,
                        'cover_image': meta.get('front_cover'),
                        'status': meta.get('front_status', '连载中'),
                        'summary': meta.get('front_summary', ''),
                        'chapter_count': front_ch_count + back_ch_count,
                        'total_word_count': front_word_count + back_word_count,
                        'year': meta.get('year', '')
                    })
                else:
                    chapter_count = 0
                    total_word_count = 0
                    for file in os.listdir(novel_path):
                        if file.startswith('chapter-') and file.endswith('.md'):
                            chapter_count += 1
                            _, ch_body = parse_markdown_file(os.path.join(novel_path, file))
                            total_word_count += len(ch_body)
                            
                    novels.append({
                        'id': slug,
                        'slug': slug,
                        'title': meta.get('title'),
                        'summary': meta.get('summary', ''),
                        'cover_image': meta.get('cover_image', '/assets/ruined_library.png'),
                        'status': meta.get('status', '连载中'),
                        'classification': meta.get('classification', '短篇'),
                        'chapter_count': chapter_count,
                        'total_word_count': total_word_count,
                        'year': meta.get('year', '')
                    })
    novels.sort(key=lambda x: (x.get('year') or '', x['slug']), reverse=True)
    return jsonify(novels)

def parse_chapter_num_key(ch):
    val = ch.get('chapter_num') if isinstance(ch, dict) else ch
    val_str = str(val if val is not None else 1).strip()
    parts = re.findall(r'\d+', val_str)
    if parts:
        return tuple(int(p) for p in parts)
    return (999999,)

@app.route('/api/novels/<slug>', methods=['GET'])
def get_novel_detail(slug):
    novel_path = os.path.join(NOVELS_DIR, slug)
    index_path = os.path.join(novel_path, 'index.md')
    if not os.path.exists(index_path):
        return jsonify({"error": "Novel not found"}), 404
        
    meta, _ = parse_markdown_file(index_path)
    is_reversible = meta.get('type') == 'reversible'
    side = request.args.get('side', '')

    if is_reversible:
        front_slug = meta.get('front_slug', 'front')
        back_slug = meta.get('back_slug', 'back')
        if side not in [front_slug, back_slug]:
            side = front_slug

        def load_side_chapters(side_key):
            side_path = os.path.join(novel_path, side_key)
            chs = []
            if os.path.exists(side_path) and os.path.isdir(side_path):
                for file in os.listdir(side_path):
                    if file.startswith('chapter-') and file.endswith('.md'):
                        ch_path = os.path.join(side_path, file)
                        ch_meta, ch_body = parse_markdown_file(ch_path)
                        raw_num = ch_meta.get('chapter_num')
                        ch_num = str(raw_num).strip() if raw_num is not None else file.replace('chapter-', '').replace('.md', '')
                        chs.append({
                            'id': ch_meta.get('slug') or f"chapter-{ch_num}",
                            'slug': ch_meta.get('slug') or f"chapter-{ch_num}",
                            'title': ch_meta.get('title'),
                            'chapter_num': ch_num,
                            'word_count': len(ch_body),
                            'side': side_key,
                            'history': ch_meta.get('history', '')
                        })
            chs.sort(key=parse_chapter_num_key)
            return chs

        front_chapters = load_side_chapters(front_slug)
        back_chapters = load_side_chapters(back_slug)

        is_front = (side == front_slug)
        prefix = 'front' if is_front else 'back'

        return jsonify({
            'id': slug,
            'slug': slug,
            'type': 'reversible',
            'side': side,
            'front_slug': front_slug,
            'back_slug': back_slug,
            'front_title': meta.get('front_title'),
            'back_title': meta.get('back_title'),
            'title': f"{meta.get('title')}：{meta.get(prefix + '_title')}",
            'novel_title': meta.get('title'),
            'side_title': meta.get(prefix + '_title'),
            'summary': meta.get(prefix + '_summary', ''),
            'cover_image': meta.get(prefix + '_cover'),
            'status': meta.get(prefix + '_status', '连载中'),
            'classification': meta.get('classification', '短篇集'),
            'front_chapters': front_chapters,
            'back_chapters': back_chapters,
            'chapters': front_chapters + back_chapters,
            'year': meta.get('year', '')
        })
    else:
        chapters = []
        for file in os.listdir(novel_path):
            if file.startswith('chapter-') and file.endswith('.md'):
                ch_path = os.path.join(novel_path, file)
                ch_meta, ch_body = parse_markdown_file(ch_path)
                raw_num = ch_meta.get('chapter_num')
                ch_num = str(raw_num).strip() if raw_num is not None else file.replace('chapter-', '').replace('.md', '')
                chapters.append({
                    'id': ch_meta.get('slug') or f"chapter-{ch_num}",
                    'slug': ch_meta.get('slug') or f"chapter-{ch_num}",
                    'title': ch_meta.get('title'),
                    'chapter_num': ch_num,
                    'word_count': len(ch_body),
                    'history': ch_meta.get('history', '')
                })
        chapters.sort(key=parse_chapter_num_key)
        
        return jsonify({
            'id': slug,
            'slug': slug,
            'title': meta.get('title'),
            'summary': meta.get('summary', ''),
            'cover_image': meta.get('cover_image', '/assets/ruined_library.png'),
            'status': meta.get('status', '连载中'),
            'classification': meta.get('classification', '短篇'),
            'chapters': chapters,
            'year': meta.get('year', '')
        })

@app.route('/api/novels', methods=['POST'])
def create_novel():
    data = request.json
    password = data.get('password')
    if password != 'rakuen':
        return jsonify({"error": "口令错误"}), 403
        
    title = data.get('title')
    
    if not title:
        return jsonify({"error": "书名不能为空"}), 400
    
    base_slug = slugify(title)
    slug = unique_slug(base_slug, lambda s: os.path.exists(os.path.join(NOVELS_DIR, s)))
    novel_path = os.path.join(NOVELS_DIR, slug)
    os.makedirs(novel_path, exist_ok=True)
    index_path = os.path.join(novel_path, 'index.md')
    
    novel_type = data.get('type')
    
    if novel_type == 'reversible':
        front_title = data.get('front_title', '')
        back_title = data.get('back_title', '')
        front_slug = slugify(front_title) if front_title else 'front'
        back_slug = slugify(back_title) if back_title else 'back'
        if front_slug == back_slug:
            back_slug = back_slug + '-2'
        
        meta = {
            'title': title,
            'type': 'reversible',
            'classification': data.get('classification', '短篇集'),
            'front_title': front_title,
            'front_slug': front_slug,
            'front_cover': data.get('front_cover', '/assets/ruined_library.png'),
            'front_status': data.get('front_status', '连载中'),
            'front_summary': data.get('front_summary', '').replace('\r\n', ' ').replace('\n', ' ').strip(),
            'back_title': back_title,
            'back_slug': back_slug,
            'back_cover': data.get('back_cover', '/assets/ruined_library.png'),
            'back_status': data.get('back_status', '已完结'),
            'back_summary': data.get('back_summary', '').replace('\r\n', ' ').replace('\n', ' ').strip(),
            'year': data.get('year', '')
        }
        os.makedirs(os.path.join(novel_path, front_slug), exist_ok=True)
        os.makedirs(os.path.join(novel_path, back_slug), exist_ok=True)
        summary = f"正面：《{meta['front_title']}》\n反面：《{meta['back_title']}》"
    else:
        summary = data.get('summary', '').replace('\r\n', ' ').replace('\n', ' ').strip()
        cover_image = data.get('cover_image', '/assets/ruined_library.png')
        status = data.get('status', '连载中')
        if not summary:
            return jsonify({"error": "作品简介不能为空"}), 400
        meta = {
            'title': title,
            'summary': summary,
            'cover_image': cover_image,
            'status': status,
            'classification': data.get('classification', '短篇'),
            'year': data.get('year', '')
        }
        
    write_markdown_file(index_path, meta, f"# {title}\n\n{summary}")
    return jsonify({"success": True, "slug": slug})

@app.route('/api/novels/<novel_slug>', methods=['PUT'])
def update_novel(novel_slug):
    data = request.json
    password = data.get('password')
    if password != 'rakuen':
        return jsonify({"error": "口令错误"}), 403
        
    title = data.get('title')
    
    if not title:
        return jsonify({"error": "书名不能为空"}), 400
    
    # Keep slug unchanged on edit
    slug = novel_slug
    old_path = os.path.join(NOVELS_DIR, novel_slug)
    new_path = old_path
    
    if not os.path.exists(old_path):
        return jsonify({"error": "作品不存在"}), 404
        
    # Read old year/metadata
    old_meta, _ = parse_markdown_file(os.path.join(old_path, 'index.md'))
        
    index_path = os.path.join(new_path, 'index.md')
    novel_type = data.get('type')
    
    if novel_type == 'reversible':
        # Keep existing front/back slugs; only update metadata
        front_slug = old_meta.get('front_slug', 'front')
        back_slug = old_meta.get('back_slug', 'back')
        
        meta = {
            'title': title,
            'type': 'reversible',
            'classification': data.get('classification', '短篇集'),
            'front_title': data.get('front_title'),
            'front_slug': front_slug,
            'front_cover': data.get('front_cover', '/assets/ruined_library.png'),
            'front_status': data.get('front_status', '连载中'),
            'front_summary': data.get('front_summary', '').replace('\r\n', ' ').replace('\n', ' ').strip(),
            'back_title': data.get('back_title'),
            'back_slug': back_slug,
            'back_cover': data.get('back_cover', '/assets/ruined_library.png'),
            'back_status': data.get('back_status', '已完结'),
            'back_summary': data.get('back_summary', '').replace('\r\n', ' ').replace('\n', ' ').strip(),
            'year': data.get('year', '')
        }
        os.makedirs(os.path.join(new_path, front_slug), exist_ok=True)
        os.makedirs(os.path.join(new_path, back_slug), exist_ok=True)
        summary = f"正面：《{meta['front_title']}》\n反面：《{meta['back_title']}》"
    else:
        summary = data.get('summary', '').replace('\r\n', ' ').replace('\n', ' ').strip()
        cover_image = data.get('cover_image', '/assets/ruined_library.png')
        status = data.get('status', '连载中')
        if not summary:
            return jsonify({"error": "作品简介不能为空"}), 400
        meta = {
            'title': title,
            'summary': summary,
            'cover_image': cover_image,
            'status': status,
            'classification': data.get('classification', '短篇'),
            'year': data.get('year', '')
        }
        
    write_markdown_file(index_path, meta, f"# {title}\n\n{summary}")
    return jsonify({"success": True})

@app.route('/api/novels/<novel_slug>', methods=['DELETE'])
def delete_novel(novel_slug):
    data = request.json or {}
    password = data.get('password')
    if password != 'rakuen':
        return jsonify({"error": "口令错误"}), 403
        
    novel_path = os.path.join(NOVELS_DIR, novel_slug)
    if os.path.exists(novel_path):
        import shutil
        shutil.rmtree(novel_path)
        return jsonify({"success": True})
    return jsonify({"error": "作品不存在"}), 404

# --------------------------------------------------------------------------
# CHAPTERS API ENDPOINTS
# --------------------------------------------------------------------------
@app.route('/api/novels/<novel_slug>/chapters/<chapter_num>', methods=['GET'])
def get_chapter_detail(novel_slug, chapter_num):
    novel_path = os.path.join(NOVELS_DIR, novel_slug)
    index_path = os.path.join(novel_path, 'index.md')
    if not os.path.exists(index_path):
        return jsonify({"error": "Novel not found"}), 404
        
    novel_meta, _ = parse_markdown_file(index_path)
    is_reversible = novel_meta.get('type') == 'reversible'
    side = request.args.get('side', '')
    
    if is_reversible:
        if side not in [novel_meta.get('front_slug'), novel_meta.get('back_slug')]:
            side = novel_meta.get('front_slug', 'front')
        target_dir = os.path.join(novel_path, side)
    else:
        target_dir = novel_path

    chs = []
    if os.path.exists(target_dir) and os.path.isdir(target_dir):
        for file in os.listdir(target_dir):
            if file.startswith('chapter-') and file.endswith('.md'):
                cp = os.path.join(target_dir, file)
                c_meta, c_body = parse_markdown_file(cp)
                c_raw = c_meta.get('chapter_num')
                c_num = str(c_raw).strip() if c_raw is not None else file.replace('chapter-', '').replace('.md', '')
                chs.append({
                    'file': file,
                    'path': cp,
                    'meta': c_meta,
                    'body': c_body,
                    'chapter_num': c_num
                })
    chs.sort(key=parse_chapter_num_key)

    current_ch = None
    current_idx = -1
    target_str = str(chapter_num).strip()

    for idx, c in enumerate(chs):
        if c['chapter_num'] == target_str or c['file'] == f"chapter-{target_str}.md":
            current_ch = c
            current_idx = idx
            break

    if not current_ch and chs:
        try:
            idx_int = int(target_str) - 1
            if 0 <= idx_int < len(chs):
                current_ch = chs[idx_int]
                current_idx = idx_int
        except ValueError:
            pass

    if not current_ch:
        return jsonify({"error": "Chapter not found"}), 404

    has_prev = current_idx > 0
    has_next = current_idx < len(chs) - 1
    prev_num = chs[current_idx - 1]['chapter_num'] if has_prev else None
    next_num = chs[current_idx + 1]['chapter_num'] if has_next else None

    side_prefix = 'front' if side == novel_meta.get('front_slug') else 'back'
    novel_title = f"{novel_meta.get('title')}：{novel_meta.get(side_prefix + '_title')}" if is_reversible else novel_meta.get('title')

    return jsonify({
        'id': current_ch['meta'].get('slug'),
        'slug': current_ch['meta'].get('slug'),
        'title': current_ch['meta'].get('title'),
        'content': current_ch['body'],
        'chapter_num': current_ch['chapter_num'],
        'word_count': len(current_ch['body']),
        'has_next': has_next,
        'has_prev': has_prev,
        'prev_chapter_num': prev_num,
        'next_chapter_num': next_num,
        'novel_title': novel_title,
        'side': side if is_reversible else None,
        'history': current_ch['meta'].get('history', '')
    })

@app.route('/api/novels/<novel_slug>/chapters', methods=['POST'])
def create_chapter(novel_slug):
    data = request.json
    password = data.get('password')
    if password != 'rakuen':
        return jsonify({"error": "口令错误"}), 403
        
    title = data.get('title')
    content = data.get('content')
    slug = data.get('slug', '').strip()
    side = data.get('side', '')
    
    if not title or not content:
        return jsonify({"error": "章节标题 and 正文内容不能为空"}), 400
        
    novel_path = os.path.join(NOVELS_DIR, novel_slug)
    if not os.path.exists(novel_path):
        return jsonify({"error": "对应作品不存在"}), 404
        
    novel_meta, _ = parse_markdown_file(os.path.join(novel_path, 'index.md'))
    is_reversible = novel_meta.get('type') == 'reversible'
    
    if is_reversible:
        if side not in [novel_meta.get('front_slug'), novel_meta.get('back_slug')]:
            return jsonify({"error": "未指定合法的子集 (side)"}), 400
        side_path = os.path.join(novel_path, side)
        os.makedirs(side_path, exist_ok=True)
        max_num = 0
        for file in os.listdir(side_path):
            if file.startswith('chapter-') and file.endswith('.md'):
                try:
                    num = int(file.split('-')[1].split('.')[0])
                    if num > max_num:
                        max_num = num
                except ValueError:
                    pass
        chapter_num = max_num + 1
        ch_path = os.path.join(side_path, f"chapter-{chapter_num}.md")
    else:
        max_num = 0
        for file in os.listdir(novel_path):
            if file.startswith('chapter-') and file.endswith('.md'):
                try:
                    num = int(file.split('-')[1].split('.')[0])
                    if num > max_num:
                        max_num = num
                except ValueError:
                    pass
        chapter_num = max_num + 1
        ch_path = os.path.join(novel_path, f"chapter-{chapter_num}.md")
        
    if not slug:
        import time
        slug = f"chapter-{chapter_num}-{int(time.time())}"
        
    history = data.get('history', '').strip()
    meta = {
        'title': title,
        'slug': slug,
        'chapter_num': chapter_num,
        'history': history
    }
    write_markdown_file(ch_path, meta, content)
    return jsonify({"success": True, "chapter_num": chapter_num})

# Chapter edit/delete now addressed by novel_slug + side + chapter_num
@app.route('/api/novels/<novel_slug>/chapters/<int:chapter_num>', methods=['PUT'])
def update_chapter(novel_slug, chapter_num):
    data = request.json
    password = data.get('password')
    if password != 'rakuen':
        return jsonify({"error": "口令错误"}), 403
        
    title = data.get('title')
    content = data.get('content')
    new_chapter_num = data.get('chapter_num')
    side = data.get('side', '')
    
    if not title or not content:
        return jsonify({"error": "章节标题和正文内容不能为空"}), 400
        
    novel_path = os.path.join(NOVELS_DIR, novel_slug)
    if not os.path.exists(novel_path):
        return jsonify({"error": "作品不存在"}), 404

    novel_meta, _ = parse_markdown_file(os.path.join(novel_path, 'index.md'))
    is_reversible = novel_meta.get('type') == 'reversible'
    
    if is_reversible:
        valid_sides = [novel_meta.get('front_slug'), novel_meta.get('back_slug')]
        if side not in valid_sides:
            return jsonify({"error": "未指定合法的子集 (side)"}), 400
        ch_dir = os.path.join(novel_path, side)
    else:
        ch_dir = novel_path
    
    ch_path = os.path.join(ch_dir, f"chapter-{chapter_num}.md")
    if not os.path.exists(ch_path):
        return jsonify({"error": "章节不存在"}), 404
        
    old_meta, _ = parse_markdown_file(ch_path)
    target_num = int(new_chapter_num) if new_chapter_num is not None else chapter_num
    new_ch_path = os.path.join(ch_dir, f"chapter-{target_num}.md")
        
    if new_ch_path != ch_path:
        if os.path.exists(new_ch_path):
            return jsonify({"error": f"章节序号 {target_num} 已存在"}), 400
        os.remove(ch_path)
        
    history = data.get('history', '').strip()
    meta = {
        'title': title,
        'chapter_num': target_num,
        'history': history
    }
    write_markdown_file(new_ch_path, meta, content)
    return jsonify({"success": True})

@app.route('/api/novels/<novel_slug>/chapters/<int:chapter_num>', methods=['DELETE'])
def delete_chapter(novel_slug, chapter_num):
    data = request.json or {}
    password = data.get('password')
    if password != 'rakuen':
        return jsonify({"error": "口令错误"}), 403
    
    side = data.get('side', '')
    novel_path = os.path.join(NOVELS_DIR, novel_slug)
    if not os.path.exists(novel_path):
        return jsonify({"error": "作品不存在"}), 404
    
    novel_meta, _ = parse_markdown_file(os.path.join(novel_path, 'index.md'))
    is_reversible = novel_meta.get('type') == 'reversible'
    
    if is_reversible:
        valid_sides = [novel_meta.get('front_slug'), novel_meta.get('back_slug')]
        if side not in valid_sides:
            return jsonify({"error": "未指定合法的子集 (side)"}), 400
        ch_dir = os.path.join(novel_path, side)
    else:
        ch_dir = novel_path
    
    ch_path = os.path.join(ch_dir, f"chapter-{chapter_num}.md")
    if not os.path.exists(ch_path):
        return jsonify({"error": "章节不存在"}), 404
        
    os.remove(ch_path)
    
    chapters = []
    for file in os.listdir(ch_dir):
        if file.startswith('chapter-') and file.endswith('.md'):
            ch_filepath = os.path.join(ch_dir, file)
            meta, body = parse_markdown_file(ch_filepath)
            chapters.append((int(meta.get('chapter_num', 1)), ch_filepath, meta, body))
            
    chapters.sort(key=lambda x: x[0])
    for idx, (old_n, path, meta, body) in enumerate(chapters):
        new_n = idx + 1
        new_path = os.path.join(ch_dir, f"chapter-{new_n}.md")
        if path != new_path:
            os.rename(path, new_path)
        meta['chapter_num'] = new_n
        write_markdown_file(new_path, meta, body)
        
    return jsonify({"success": True})

if __name__ == '__main__':
    print("Starting rakuen.live flat-file backend server on http://127.0.0.1:8001...")
    app.run(debug=True, port=8001)
