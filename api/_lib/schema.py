# -*- coding: utf-8 -*-
"""Declarative mapping between frontmatter strings and JSON values.

Declaring a content type's fields once means the list endpoint and the detail
endpoint cannot drift apart, and it gives `npm run check` something to validate
files against instead of failures showing up as a blank cover months later.
"""

from . import md


class Field(object):
    """One frontmatter key.

    `default`   value used when the key is absent or empty.
    `source`    frontmatter key, when it differs from the JSON name.
    `required`  the checker complains when it is missing.
    `asset`     names a file inside the bundle; the checker verifies it exists.
    `stored`    False for computed fields that must never be written back.
    """

    def __init__(self, default='', source=None, required=False, asset=False, stored=True):
        self.default = default
        self.source = source
        self.required = required
        self.asset = asset
        self.stored = stored

    def load(self, raw):
        return raw

    def save(self, value):
        return md.oneline(value)


class Text(Field):
    """A plain string."""


class Line(Text):
    """A string forced onto one line — summaries, quotes, titles."""

    def load(self, raw):
        return md.oneline(raw)


class Asset(Line):
    """A filename inside the bundle, or an absolute path/URL."""

    def __init__(self, **kwargs):
        kwargs.setdefault('asset', True)
        super(Asset, self).__init__(**kwargs)


class Tags(Field):
    """A comma-separated list."""

    def __init__(self, **kwargs):
        kwargs.setdefault('default', ())
        super(Tags, self).__init__(**kwargs)

    def load(self, raw):
        return [t.strip() for t in raw.split(',') if t.strip()]

    def save(self, value):
        if isinstance(value, (list, tuple)):
            return ', '.join(md.oneline(v) for v in value if md.oneline(v))
        return md.oneline(value)


class Num(Field):
    """An integer, tolerant of junk."""

    def __init__(self, default=0, **kwargs):
        super(Num, self).__init__(default=default, **kwargs)

    def load(self, raw):
        try:
            return int(float(raw))
        except (TypeError, ValueError):
            return self.default


class Schema(object):
    """The fields describing one kind of document."""

    def __init__(self, **fields):
        self.fields = fields

    def key(self, name):
        return self.fields[name].source or name

    def merged(self, other):
        """A schema accepting both field sets.

        A single-volume book has no volume sub-directory, so its one index.md
        legitimately carries the book's fields and the volume's together.
        """
        combined = dict(other.fields)
        combined.update(self.fields)
        return Schema(**combined)

    def load(self, meta, **computed):
        """Frontmatter dict -> JSON dict."""
        out = {}
        for name, field in self.fields.items():
            raw = meta.get(self.key(name), '')
            value = field.load(raw) if str(raw).strip() != '' else field.default
            out[name] = list(value) if isinstance(value, tuple) else value
        out.update(computed)
        return out

    def save(self, data, base=None):
        """JSON dict -> frontmatter dict, preserving unknown existing keys.

        `base` is the document's current frontmatter; keys the schema does not
        know about are carried through so hand-added notes survive an edit.
        """
        meta = dict(base or {})
        for name, field in self.fields.items():
            if not field.stored or name not in data:
                continue
            meta[self.key(name)] = field.save(data[name])
        return meta

    # -- validation --------------------------------------------------------
    def known_keys(self):
        return {self.key(name) for name in self.fields}

    def problems(self, meta, exists=None):
        """Report anything wrong with a file's frontmatter.

        Each item is (severity, kind, detail). A misspelled or missing field is
        an `error` — always a mistake. A file that is not there yet is a `warn`,
        because work in progress should not fail a build.

        `exists(filename) -> bool` verifies asset fields; pass None to skip.
        """
        found = []
        known = self.known_keys()

        for key in meta:
            if key not in known:
                found.append(('error', 'unknown field', key))

        for name, field in self.fields.items():
            raw = md.oneline(meta.get(self.key(name), ''))
            if field.required and not raw:
                found.append(('error', 'missing required field', self.key(name)))
            if field.asset and raw and exists and not raw.startswith(('http://', 'https://', '/')):
                if not exists(raw):
                    found.append(('warn', 'file not found', '%s: %s' % (self.key(name), raw)))
        return found
