# -*- coding: utf-8 -*-
"""A markdown file with a `---` delimited frontmatter header.

The format is deliberately not YAML: every value is a single-line string and
typing is the schema layer's job. That keeps the files hand-editable and the
parser free of dependencies.
"""

import re
import unicodedata

DELIM = '---'


def parse(text):
    """Split raw file text into (metadata dict, body string).

    Text without a well-formed header is returned as pure body, so a file that
    happens to start with a horizontal rule is never silently truncated.
    """
    lines = text.splitlines()
    if not lines or lines[0].strip() != DELIM:
        return {}, text.strip()

    meta = {}
    i = 1
    while i < len(lines) and lines[i].strip() != DELIM:
        line = lines[i].strip()
        i += 1
        if not line or line.startswith('#') or ':' not in line:
            continue
        key, value = line.split(':', 1)
        meta[key.strip()] = value.strip()

    if i >= len(lines):
        # No closing delimiter — treat the whole file as body.
        return {}, text.strip()

    return meta, '\n'.join(lines[i + 1:]).strip()


def dump(meta, body):
    """Render a metadata dict and body back into file text."""
    lines = [DELIM]
    for key, value in meta.items():
        lines.append('%s: %s' % (key, oneline(value)))
    lines.append(DELIM)
    lines.append('')
    lines.append(body.strip())
    lines.append('')
    return '\n'.join(lines)


def oneline(value):
    """Collapse a value into the single line a frontmatter entry must be."""
    if value is None:
        return ''
    return re.sub(r'\s+', ' ', str(value)).strip()


def slugify(text):
    """Turn a title into a filesystem- and URL-safe slug, keeping CJK intact."""
    text = unicodedata.normalize('NFKC', str(text or '')).lower().strip()
    text = re.sub(r'[\s_]+', '-', text)
    # \w is unicode-aware in Python 3, so CJK survives; punctuation does not.
    text = re.sub(r'[^\w-]', '', text)
    text = re.sub(r'-+', '-', text).strip('-')
    return text or 'untitled'


def unique_slug(base, taken):
    """`base`, or `base-2`, `base-3`... until `taken(slug)` is False."""
    slug = base
    counter = 2
    while taken(slug):
        slug = '%s-%d' % (base, counter)
        counter += 1
    return slug


def numeric_key(value):
    """Sort key for chapter/track numbers, so "2" < "10" and "1.5" sits between.

    Anything non-numeric sorts last rather than raising, so one malformed file
    cannot take down a whole listing.
    """
    digits = re.findall(r'\d+', str(value if value is not None else ''))
    if not digits:
        return (float('inf'),)
    return tuple(int(d) for d in digits)


def count_words(body):
    """Length of the prose, ignoring whitespace.

    Chinese text has no spaces, so a character count is the meaningful measure
    here; whitespace is dropped so indentation does not inflate the number.
    """
    return len(re.sub(r'\s+', '', body or ''))


def resolve_url(raw, base_url, fallback=''):
    """Turn a frontmatter path into a browser-requestable URL.

    Absolute URLs and root-relative paths pass through untouched; a bare
    filename is resolved against the content directory it was declared in.
    """
    raw = (raw or '').strip()
    if not raw:
        return fallback
    if raw.startswith(('http://', 'https://', '/', 'data:')):
        return raw
    return '%s/%s' % (base_url.rstrip('/'), raw.lstrip('./'))
