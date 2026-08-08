# -*- coding: utf-8 -*-
"""Filesystem layout and runtime settings."""

import os

# api/_lib/config.py -> api/_lib -> api -> repo root
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# All writing lives under one root, one directory per entry.
CONTENT_DIR = os.path.join(BASE_DIR, 'content')
POSTS_DIR = os.path.join(CONTENT_DIR, 'posts')
BOOKS_DIR = os.path.join(CONTENT_DIR, 'books')
NOVELS_DIR = BOOKS_DIR
ALBUMS_DIR = os.path.join(CONTENT_DIR, 'albums')
MUSIC_DIR = ALBUMS_DIR

ASSETS_DIR = os.path.join(BASE_DIR, 'assets')

# Public URL prefix for files that sit inside a content bundle.
CONTENT_URL = '/content'
NOVELS_URL = '/content/books'
ALBUMS_URL = '/content/albums'
POSTS_URL = '/content/posts'

PLACEHOLDER_COVER = '/assets/ruined_library.png'

AUDIO_EXTENSIONS = ('.mp3', '.wav', '.m4a', '.flac', '.ogg', '.opus', '.aac')

# Anything whose name starts with this is invisible to the site: working files,
# original exports, drafts. It is never listed, served, or deployed.
PRIVATE_PREFIX = '_'

# The edit-mode password. Set RAKUEN_EDIT_PASSWORD in the environment; the
# fallback only exists so a fresh clone runs without configuration.
EDIT_PASSWORD = os.environ.get('RAKUEN_EDIT_PASSWORD', 'rakuen')

# Serverless filesystems are read-only, so the editing endpoints cannot work
# there. Set RAKUEN_READONLY=1 to have them fail fast with a clear message.
READONLY = os.environ.get('RAKUEN_READONLY', '').lower() in ('1', 'true', 'yes')
