# -*- coding: utf-8 -*-
"""The content types this site publishes.

This is the file to edit when adding a new kind of content. Each model declares
a schema and a directory; parsing, ordering, numbering and writing all come
from the layers underneath.

On-disk layout — one entry, one directory:

    content/posts/<entry>.md              a post with no files of its own
    content/posts/<entry>/index.md        a post that has files beside it

    content/books/<entry>/index.md        the book
    content/books/<entry>/NN-<title>.md   its chapters, when it has one volume
    content/books/<entry>/<volume>/       otherwise one sub-bundle per volume

    content/albums/<entry>/index.md       the album
    content/albums/<entry>/NN-<title>.md  its tracks

The filename prefix orders a document and supplies its default number; a
`number:` field overrides only what is displayed. Anything starting with `_`
is a working file and is never read, served or deployed.
"""

import datetime
import os

from . import md, store
from .config import (
    ALBUMS_DIR, AUDIO_EXTENSIONS, BOOKS_DIR, CONTENT_URL, PLACEHOLDER_COVER,
    POSTS_DIR,
)
from .errors import Invalid, NotFound
from .schema import Asset, Line, Schema, Tags, Text


def _today():
    return datetime.date.today().strftime('%Y-%m-%d')


def _require(data, *names):
    """Return the named fields, rejecting blanks."""
    values = []
    for name in names:
        value = (data.get(name) or '').strip()
        if not value:
            raise Invalid('缺少必填字段：%s' % name)
        values.append(value)
    return values


class Collection(object):
    """A directory of entries, each addressed by a slug.

    The slug is declared in frontmatter or derived from the directory name, so
    a directory can be renamed — or written in Chinese — without breaking any
    URL that has already been shared.
    """

    root = None
    section = ''      # url segment under /content
    schema = None
    missing = '内容不存在'

    # -- entries and slugs -------------------------------------------------
    def _index_path(self, name):
        path = os.path.join(self.root, name)
        return os.path.join(path, 'index.md') if os.path.isdir(path) else path

    def _bundle_dir(self, name):
        path = os.path.join(self.root, name)
        return path if os.path.isdir(path) else self.root

    def _slug_of(self, name):
        doc = store.read(self._index_path(name))
        declared = md.oneline(doc.meta.get('slug')) if doc else ''
        return declared or md.slugify(os.path.splitext(name)[0])

    def names(self):
        return store.entries(self.root)

    # Resolving a slug means reading every entry's index.md. That is once per
    # request per collection, so the result is memoised against the directory's
    # modification time: edits invalidate it, reads never pay for it twice.
    _slug_cache = None

    def _slug_map(self):
        try:
            stamp = os.stat(self.root).st_mtime_ns
        except OSError:
            return {}

        cached = self._slug_cache
        if cached and cached[0] == stamp:
            return cached[1]

        mapping = {self._slug_of(name): name for name in self.names()}
        type(self)._slug_cache = (stamp, mapping)
        return mapping

    def locate(self, slug):
        """Directory (or file) name backing a slug."""
        name = self._slug_map().get(slug)
        if name is None:
            # A new entry inside an existing directory does not change the
            # root's mtime, so confirm a miss against the filesystem.
            for candidate in self.names():
                if self._slug_of(candidate) == slug:
                    return candidate
            raise NotFound(self.missing)
        return name

    def exists(self, slug):
        try:
            self.locate(slug)
            return True
        except NotFound:
            return False

    def url_for(self, name, *parts):
        """Public URL of the bundle holding an entry's files."""
        return '/'.join([CONTENT_URL, self.section, name] + list(parts))

    def cover_url(self, raw, name, *parts):
        return md.resolve_url(raw, self.url_for(name, *parts), PLACEHOLDER_COVER)


# ==========================================================================
# Posts — 楽園随笔
# ==========================================================================
class Posts(Collection):
    root = POSTS_DIR
    section = 'posts'
    missing = '随笔不存在'

    schema = Schema(
        title=Line(required=True),
        slug=Text(),
        summary=Line(),
        tags=Tags(),
        date=Text(),
    )

    def _shape(self, name, with_body=False):
        doc = store.read(self._index_path(name))
        if doc is None:
            raise NotFound(self.missing)
        data = self.schema.load(doc.meta, word_count=doc.words)
        data['slug'] = data['slug'] or md.slugify(os.path.splitext(name)[0])
        if with_body:
            data['content'] = doc.body
            data['assets'] = self.url_for(name) if os.path.isdir(
                os.path.join(self.root, name)) else ''
        return data

    def list(self):
        items = [self._shape(name) for name in self.names()]
        items.sort(key=lambda p: (p['date'], p['slug']), reverse=True)
        return items

    def get(self, slug):
        return self._shape(self.locate(slug), with_body=True)

    def create(self, data):
        title, content = _require(data, 'title', 'content')
        slug = md.unique_slug(md.slugify(title), self.exists)
        payload = dict(data, title=title, slug=slug, date=data.get('date') or _today())
        store.write(os.path.join(self.root, '%s.md' % slug), self.schema.save(payload), content)
        return self.get(slug)

    def update(self, slug, data):
        name = self.locate(slug)
        doc = store.read(self._index_path(name))
        title, content = _require(data, 'title', 'content')
        payload = dict(data, title=title, slug=slug,
                       date=data.get('date') or doc.meta.get('date') or _today())
        store.write(self._index_path(name), self.schema.save(payload, base=doc.meta), content)
        return self.get(slug)

    def delete(self, slug):
        name = self.locate(slug)
        path = os.path.join(self.root, name)
        store.remove_tree(path) if os.path.isdir(path) else store.remove(path)


# ==========================================================================
# Books — 朝花夕拾
#
# A book is a bundle of chapters. When it holds more than one volume, each
# volume is a sub-bundle with its own index.md. A single-volume book keeps its
# chapters at the top level and has one implicit volume, so every reader below
# takes exactly one code path.
# ==========================================================================
class Books(Collection):
    root = BOOKS_DIR
    section = 'books'
    missing = '作品不存在'

    schema = Schema(
        title=Line(required=True),
        slug=Text(),
        kind=Line(default='短篇'),
        year=Line(),
    )
    volume_schema = Schema(
        title=Line(),
        slug=Text(),
        cover=Asset(),
        status=Line(default='连载中'),
        summary=Line(),
    )
    chapter_schema = Schema(
        title=Line(required=True),
        number=Text(),
        note=Line(),
    )

    # -- structure ---------------------------------------------------------
    def volume_names(self, name):
        """Sub-bundles of a book; [''] when the chapters sit at the top level."""
        base = os.path.join(self.root, name)
        found = [v for v in store.bundle_dirs(base)
                 if store.index_of(os.path.join(base, v)) or store.documents(os.path.join(base, v))]
        return found or ['']

    def volume_dir(self, name, volume_name):
        base = os.path.join(self.root, name)
        return os.path.join(base, volume_name) if volume_name else base

    def _volume_slug_of(self, name, volume_name):
        if not volume_name:
            return ''
        doc = store.index_of(self.volume_dir(name, volume_name))
        declared = md.oneline(doc.meta.get('slug')) if doc else ''
        return declared or md.slugify(volume_name)

    def _locate_volume(self, name, volume_slug):
        """Directory name of the requested volume, defaulting to the first."""
        available = self.volume_names(name)
        if volume_slug:
            for volume_name in available:
                if self._volume_slug_of(name, volume_name) == volume_slug:
                    return volume_name
            raise NotFound('分卷不存在：%s' % volume_slug)
        return available[0]

    # -- reading -----------------------------------------------------------
    def _chapters(self, name, volume_name):
        vdir = self.volume_dir(name, volume_name)
        volume_slug = self._volume_slug_of(name, volume_name)
        chapters = []
        for doc in store.documents(vdir):
            data = self.chapter_schema.load(
                doc.meta, word_count=doc.words, volume=volume_slug)
            data['number'] = data['number'] or doc.number
            chapters.append(data)
        return chapters

    def _volume(self, name, volume_name, book_meta, with_chapters):
        vdir = self.volume_dir(name, volume_name)
        index = store.index_of(vdir) if volume_name else store.index_of(
            os.path.join(self.root, name))
        meta = index.meta if index else {}

        data = self.volume_schema.load(meta)
        data['slug'] = self._volume_slug_of(name, volume_name)
        # The directory backing this volume, so an edit can target it without
        # guessing a name from the title.
        data['dir'] = volume_name
        data['title'] = data['title'] or md.oneline(book_meta.get('title', ''))
        data['cover'] = self.cover_url(
            data['cover'], name, *( [volume_name] if volume_name else [] ))
        data['assets'] = self.url_for(name, *([volume_name] if volume_name else []))

        chapters = self._chapters(name, volume_name)
        data['chapter_count'] = len(chapters)
        data['word_count'] = sum(c['word_count'] for c in chapters)
        if with_chapters:
            data['chapters'] = chapters
        return data

    def _shape(self, name, with_chapters):
        index = store.index_of(os.path.join(self.root, name))
        if index is None:
            raise NotFound(self.missing)

        volumes = [self._volume(name, volume_name, index.meta, with_chapters)
                   for volume_name in self.volume_names(name)]

        data = self.schema.load(index.meta)
        data['slug'] = data['slug'] or md.slugify(name)
        data['volumes'] = volumes
        data['chapter_count'] = sum(v['chapter_count'] for v in volumes)
        data['word_count'] = sum(v['word_count'] for v in volumes)
        return data

    def list(self):
        items = []
        for name in self.names():
            if store.index_of(os.path.join(self.root, name)):
                items.append(self._shape(name, with_chapters=False))
        items.sort(key=lambda b: (b['year'], b['slug']), reverse=True)
        return items

    def get(self, slug):
        return self._shape(self.locate(slug), with_chapters=True)

    # -- chapters ----------------------------------------------------------
    def _find_chapter(self, docs, number):
        wanted = md.oneline(number)
        return next((d for d in docs
                     if (md.oneline(d.meta.get('number')) or d.number) == wanted), None)

    def chapter(self, slug, number, volume_slug=None):
        name = self.locate(slug)
        volume_name = self._locate_volume(name, volume_slug)
        vdir = self.volume_dir(name, volume_name)
        docs = store.documents(vdir)

        doc = self._find_chapter(docs, number)
        if doc is None:
            raise NotFound('章节不存在')
        position = docs.index(doc)

        book = self._shape(name, with_chapters=False)
        volume = next(v for v in book['volumes']
                      if v['slug'] == self._volume_slug_of(name, volume_name))

        displayed = (lambda d: md.oneline(d.meta.get('number')) or d.number)
        data = self.chapter_schema.load(
            doc.meta, content=doc.body, word_count=doc.words, volume=volume['slug'])
        data['number'] = displayed(doc)
        data['book_slug'] = book['slug']
        data['book_title'] = book['title']
        data['volume_title'] = volume['title']
        data['assets'] = volume['assets']
        data['prev'] = displayed(docs[position - 1]) if position > 0 else None
        data['next'] = displayed(docs[position + 1]) if position < len(docs) - 1 else None
        return data

    def _write_chapter(self, vdir, prefix, title, number, data, base=None, replacing=None):
        """Write a chapter, letting the filename carry the number when it can."""
        implied = store.Doc(vdir, '%s-x' % prefix, {}, '').number
        payload = dict(data, title=title, number='' if number == implied else number)
        path = os.path.join(vdir, store.document_filename(prefix, title))
        if replacing and os.path.normpath(replacing) != os.path.normpath(path):
            store.remove(replacing)
        store.write(path, self.chapter_schema.save(payload, base=base), data['content'])
        return path

    def create_chapter(self, slug, data):
        name = self.locate(slug)
        volume_name = self._locate_volume(name, data.get('volume'))
        vdir = self.volume_dir(name, volume_name)
        title, content = _require(data, 'title', 'content')

        docs = store.documents(vdir)
        prefix = store.prefix_for_number(data.get('number'), store.next_prefix(docs))
        number = md.oneline(data.get('number')) or store.Doc(vdir, '%s-x' % prefix, {}, '').number
        if self._find_chapter(docs, number):
            raise Invalid('章节序号 %s 已存在' % number)

        self._write_chapter(vdir, prefix, title, number, dict(data, content=content))
        return self.chapter(slug, number, self._volume_slug_of(name, volume_name))

    def update_chapter(self, slug, number, data):
        name = self.locate(slug)
        volume_name = self._locate_volume(name, data.get('volume'))
        vdir = self.volume_dir(name, volume_name)
        title, content = _require(data, 'title', 'content')

        docs = store.documents(vdir)
        doc = self._find_chapter(docs, number)
        if doc is None:
            raise NotFound('章节不存在')

        new_number = md.oneline(data.get('number')) or md.oneline(number)
        if new_number != md.oneline(number) and self._find_chapter(docs, new_number):
            raise Invalid('章节序号 %s 已存在' % new_number)

        prefix = store.prefix_for_number(new_number, doc.prefix or store.next_prefix(docs))
        self._write_chapter(vdir, prefix, title, new_number, dict(data, content=content),
                            base=doc.meta, replacing=doc.path)
        return self.chapter(slug, new_number, self._volume_slug_of(name, volume_name))

    def delete_chapter(self, slug, number, volume_slug=None):
        name = self.locate(slug)
        volume_name = self._locate_volume(name, volume_slug)
        doc = self._find_chapter(store.documents(self.volume_dir(name, volume_name)), number)
        if doc is None:
            raise NotFound('章节不存在')
        store.remove(doc.path)

    # -- writing books -----------------------------------------------------
    def _volumes_payload(self, data):
        volumes = data.get('volumes') or []
        if not isinstance(volumes, list) or not volumes:
            raise Invalid('作品至少需要一个分卷')
        out = []
        for raw in volumes:
            title = md.oneline(raw.get('title'))
            summary = md.oneline(raw.get('summary'))
            if len(volumes) > 1 and not title:
                raise Invalid('每个分卷都需要名称')
            if not summary:
                raise Invalid('请填写作品简介')
            out.append({
                'dir': md.oneline(raw.get('dir')) or (title if len(volumes) > 1 else ''),
                'title': title,
                'cover': md.oneline(raw.get('cover')),
                'status': md.oneline(raw.get('status')) or '连载中',
                'summary': summary,
            })
        dirs = [v['dir'] for v in out]
        if len(set(dirs)) != len(dirs):
            raise Invalid('分卷名称不能重复')
        return out

    def _write_volumes(self, name, volumes):
        base = os.path.join(self.root, name)
        current = self.volume_names(name)
        target = [v['dir'] for v in volumes]

        if current == [''] and target != ['']:
            self._move_chapters(base, os.path.join(base, target[0]))
        elif current != [''] and target == ['']:
            for volume_name in current:
                self._move_chapters(os.path.join(base, volume_name), base)
                store.remove(os.path.join(base, volume_name, 'index.md'))

        for volume in volumes:
            if not volume['dir']:
                continue
            vdir = os.path.join(base, volume['dir'])
            existing = store.index_of(vdir)
            store.write(os.path.join(vdir, 'index.md'),
                        self.volume_schema.save(volume, base=existing.meta if existing else None),
                        existing.body if existing else '')

    def _move_chapters(self, src, dst):
        """Relocate chapter files, renumbering to dodge collisions."""
        docs = store.documents(src)
        if not docs:
            return
        os.makedirs(dst, exist_ok=True)
        for doc in docs:
            prefix = doc.prefix or store.next_prefix(store.documents(dst))
            if any(d.prefix == prefix for d in store.documents(dst)):
                prefix = store.next_prefix(store.documents(dst))
            title = md.oneline(doc.meta.get('title')) or doc.name
            store.write(os.path.join(dst, store.document_filename(prefix, title)),
                        doc.meta, doc.body)
            store.remove(doc.path)

    def create(self, data):
        (title,) = _require(data, 'title')
        volumes = self._volumes_payload(data)
        slug = md.unique_slug(md.slugify(title), self.exists)
        name = slug
        payload = dict(data, title=title, slug=slug)
        store.write(os.path.join(self.root, name, 'index.md'),
                    self.schema.save(payload), '')
        self._write_volumes(name, volumes)
        return self.get(slug)

    def update(self, slug, data):
        name = self.locate(slug)
        index = store.index_of(os.path.join(self.root, name))
        (title,) = _require(data, 'title')
        volumes = self._volumes_payload(data)
        payload = dict(data, title=title, slug=slug)
        store.write(os.path.join(self.root, name, 'index.md'),
                    self.schema.save(payload, base=index.meta), index.body)
        self._write_volumes(name, volumes)
        return self.get(slug)

    def delete(self, slug):
        store.remove_tree(os.path.join(self.root, self.locate(slug)))


# ==========================================================================
# Albums — 星火倾斜
# ==========================================================================
class Albums(Collection):
    root = ALBUMS_DIR
    section = 'albums'
    missing = '专辑不存在'

    schema = Schema(
        title=Line(required=True),
        slug=Text(),
        summary=Line(),
        cover=Asset(),
        year=Line(),
    )
    track_schema = Schema(
        title=Line(required=True),
        artist=Line(default='toki'),
        number=Text(),
        audio=Asset(),
        cover=Asset(),
        duration=Text(),
        quote=Line(),
        note=Line(),
    )

    def _tracks(self, name, album_meta):
        adir = os.path.join(self.root, name)
        fallback_audio = store.find_media(adir, AUDIO_EXTENSIONS)
        tracks = []
        for doc in store.documents(adir):
            data = self.track_schema.load(doc.meta, notes=doc.body)
            data['number'] = data['number'] or doc.number
            data['audio'] = md.resolve_url(
                data['audio'] or fallback_audio, self.url_for(name))
            data['cover'] = self.cover_url(
                data['cover'] or md.oneline(album_meta.get('cover', '')), name)
            tracks.append(data)
        return tracks

    def _shape(self, name):
        index = store.index_of(os.path.join(self.root, name))
        meta = index.meta if index else {}
        data = self.schema.load(meta)
        data['slug'] = data['slug'] or md.slugify(name)
        data['title'] = data['title'] or name
        data['cover'] = self.cover_url(data['cover'], name)
        data['assets'] = self.url_for(name)
        data['tracks'] = self._tracks(name, meta)
        return data

    def list(self):
        albums = [self._shape(name) for name in self.names()]
        albums.sort(key=lambda a: (a['year'], a['slug']))
        return albums

    def get(self, slug):
        return self._shape(self.locate(slug))


posts = Posts()
books = Books()
albums = Albums()

# `novels` was the old name for this collection.
novels = books
