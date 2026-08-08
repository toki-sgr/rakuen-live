# -*- coding: utf-8 -*-
"""Validate every content file against its schema.

A mistyped field used to show up months later as a blank cover. This turns it
into a line of output:

    npm run check
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'api'))

from _lib import models, store  # noqa: E402
from _lib.config import BASE_DIR  # noqa: E402

problems = []
checked = 0


def rel(path):
    return os.path.relpath(path, BASE_DIR)


def check(path, schema, directory):
    """Report schema problems for one markdown file."""
    global checked
    doc = store.read(path)
    if doc is None:
        problems.append((rel(path), [('error', 'unreadable', '')]))
        return
    checked += 1

    exists = lambda name: os.path.isfile(os.path.join(directory, name))
    found = schema.problems(doc.meta, exists=exists)
    if found:
        problems.append((rel(path), found))


def check_bundle(directory, index_schema, doc_schema):
    index = os.path.join(directory, 'index.md')
    if os.path.isfile(index):
        check(index, index_schema, directory)
    for doc in store.documents(directory):
        check(doc.path, doc_schema, directory)


# -- posts -------------------------------------------------------------------
for name in models.posts.names():
    path = os.path.join(models.posts.root, name)
    if os.path.isdir(path):
        check(os.path.join(path, 'index.md'), models.posts.schema, path)
    else:
        check(path, models.posts.schema, models.posts.root)

# -- books -------------------------------------------------------------------
for name in models.books.names():
    book_dir = os.path.join(models.books.root, name)
    if not os.path.isdir(book_dir):
        continue
    volumes = models.books.volume_names(name)

    # With one implicit volume there is no volume index.md, so the book's own
    # index carries the volume fields as well.
    book_schema = (models.books.schema.merged(models.books.volume_schema)
                   if volumes == [''] else models.books.schema)
    check(os.path.join(book_dir, 'index.md'), book_schema, book_dir)

    for volume in volumes:
        vdir = models.books.volume_dir(name, volume)
        if volume:
            check(os.path.join(vdir, 'index.md'), models.books.volume_schema, vdir)
        for doc in store.documents(vdir):
            check(doc.path, models.books.chapter_schema, vdir)

# -- albums ------------------------------------------------------------------
for name in models.albums.names():
    album_dir = os.path.join(models.albums.root, name)
    if os.path.isdir(album_dir):
        check_bundle(album_dir, models.albums.schema, models.albums.track_schema)


# -- duplicate slugs ---------------------------------------------------------
for label, collection in (('随笔', models.posts), ('作品', models.books), ('专辑', models.albums)):
    seen = {}
    for name in collection.names():
        slug = collection._slug_of(name)
        if slug in seen:
            problems.append(('%s/%s' % (collection.section, name),
                             [('error', 'duplicate slug', '%s (also %s)' % (slug, seen[slug]))]))
        seen[slug] = name


# -- report ------------------------------------------------------------------
LABEL = {'error': '错误', 'warn': '待办'}

errors = sum(1 for _, found in problems for severity, _, _ in found if severity == 'error')
warnings = sum(1 for _, found in problems for severity, _, _ in found if severity == 'warn')

if problems:
    for path, found in problems:
        print('  %s' % path)
        for severity, kind, detail in found:
            print('      %-4s %-24s %s' % (LABEL[severity], kind, detail))
    print()

print('检查了 %d 个内容文件：%d 个错误，%d 个待办。' % (checked, errors, warnings))
if errors:
    print('字段表见 README.md。')
    sys.exit(1)
