# -*- coding: utf-8 -*-
"""Reading and writing content bundles.

A bundle is a directory holding one `index.md` and whatever files belong to it.
Ordered documents inside a bundle are named `<prefix>-<title>.md`, where the
prefix both sorts them and supplies their default number.
"""

import os
import re
import shutil

from . import md
from .config import PRIVATE_PREFIX

# `03.1-妙境 1.md` -> ('03.1', '妙境 1')
NUMBERED = re.compile(r'^(\d+(?:\.\d+)*)-(.+)$')


def is_private(name):
    """Working files are invisible to the site."""
    return name.startswith(PRIVATE_PREFIX) or name.startswith('.')


def is_private_path(relative_path):
    return any(is_private(part) for part in relative_path.replace('\\', '/').split('/') if part)


class Doc(object):
    """One markdown file on disk."""

    __slots__ = ('path', 'name', 'meta', 'body')

    def __init__(self, path, name, meta, body):
        self.path = path
        self.name = name
        self.meta = meta
        self.body = body

    @property
    def words(self):
        return md.count_words(self.body)

    @property
    def prefix(self):
        """The numeric filename prefix, or '' for an unnumbered document."""
        match = NUMBERED.match(self.name)
        return match.group(1) if match else ''

    @property
    def number(self):
        """Displayed number: the frontmatter wins, else the filename prefix."""
        declared = md.oneline(self.meta.get('number'))
        if declared:
            return declared
        prefix = self.prefix
        if not prefix:
            return ''
        whole, _, frac = prefix.partition('.')
        return whole.lstrip('0') or '0' if not frac else '%s.%s' % (whole.lstrip('0') or '0', frac)


def read(path):
    """Load a document, or None if it is missing or unreadable."""
    if not os.path.isfile(path):
        return None
    try:
        with open(path, 'r', encoding='utf-8') as handle:
            text = handle.read()
    except OSError:
        return None
    meta, body = md.parse(text)
    return Doc(path, os.path.splitext(os.path.basename(path))[0], meta, body)


def write(path, meta, body):
    """Write a document, creating parent directories as needed."""
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(path, 'w', encoding='utf-8') as handle:
        handle.write(md.dump(meta, body))


def remove(path):
    if os.path.isfile(path):
        os.remove(path)


def remove_tree(path):
    if os.path.isdir(path):
        shutil.rmtree(path)


def entries(directory):
    """Sub-directories that are bundles, plus any single-file entries.

    Returns the directory/file names, so callers can turn them into slugs.
    """
    if not os.path.isdir(directory):
        return []
    names = []
    for name in sorted(os.listdir(directory)):
        if is_private(name):
            continue
        path = os.path.join(directory, name)
        if os.path.isdir(path) or name.endswith('.md'):
            names.append(name)
    return names


def bundle_dirs(directory):
    """Sub-bundles of a bundle — a book's volumes."""
    if not os.path.isdir(directory):
        return []
    return [name for name in sorted(os.listdir(directory))
            if not is_private(name) and os.path.isdir(os.path.join(directory, name))]


def index_of(directory):
    """The `index.md` describing a bundle, or None."""
    return read(os.path.join(directory, 'index.md'))


def documents(directory):
    """Every ordered document in a bundle, sorted by filename prefix.

    `index.md` is the bundle itself, not one of its documents, so it is skipped.
    """
    if not os.path.isdir(directory):
        return []
    docs = []
    for name in sorted(os.listdir(directory)):
        if is_private(name) or not name.endswith('.md') or name == 'index.md':
            continue
        doc = read(os.path.join(directory, name))
        if doc is not None:
            docs.append(doc)
    docs.sort(key=lambda d: md.numeric_key(d.prefix or d.name))
    return docs


def find_media(directory, extensions):
    """First file in a bundle with one of the given extensions."""
    if not os.path.isdir(directory):
        return ''
    for name in sorted(os.listdir(directory)):
        if not is_private(name) and name.lower().endswith(extensions):
            return name
    return ''


def next_prefix(docs):
    """Filename prefix one past the highest whole number in use."""
    highest = 0
    for doc in docs:
        parts = md.numeric_key(doc.prefix)
        if parts and parts[0] != float('inf'):
            highest = max(highest, parts[0])
    return '%02d' % (highest + 1)


def document_filename(prefix, title):
    """`03.1` + `妙境 1` -> `03.1-妙境 1.md`."""
    safe = re.sub(r'[\\/:*?"<>|]', '', md.oneline(title)) or 'untitled'
    return '%s-%s.md' % (prefix, safe)


def prefix_for_number(number, fallback):
    """Turn a displayed number like `3.1` into the filename prefix `03.1`."""
    number = md.oneline(number)
    match = re.match(r'^(\d+)(\.\d+)?$', number)
    if not match:
        return fallback
    return '%02d%s' % (int(match.group(1)), match.group(2) or '')
