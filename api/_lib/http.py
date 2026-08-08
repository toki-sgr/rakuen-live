# -*- coding: utf-8 -*-
"""Request plumbing: authentication, payloads, error translation."""

import functools
import hmac

from flask import jsonify, request

from .config import EDIT_PASSWORD, READONLY
from .errors import ContentError, Denied, ReadOnly

TOKEN_HEADER = 'X-Edit-Password'


def check_password(password):
    return hmac.compare_digest(str(password or ''), EDIT_PASSWORD)


def editing(view):
    """Guard a route that writes to disk.

    The token travels in a header rather than the JSON body so it can never be
    mistaken for content and end up written into a file.
    """

    @functools.wraps(view)
    def wrapper(*args, **kwargs):
        if not check_password(request.headers.get(TOKEN_HEADER)):
            raise Denied('口令错误')
        if READONLY:
            raise ReadOnly('当前部署为只读，编辑请在本地进行')
        return view(*args, **kwargs)

    return wrapper


def payload():
    """The request body as a dict, never None."""
    return request.get_json(silent=True) or {}


def install_error_handling(app):
    @app.errorhandler(ContentError)
    def _content_error(err):
        return jsonify({'error': str(err)}), err.status

    @app.errorhandler(404)
    def _not_found(_err):
        return jsonify({'error': '资源不存在'}), 404

    @app.errorhandler(OSError)
    def _os_error(err):
        # Serverless filesystems are read-only; say so instead of leaking errno.
        if getattr(err, 'errno', None) in (30, 13):
            return jsonify({'error': '当前部署为只读，编辑请在本地进行'}), 503
        return jsonify({'error': '文件读写失败'}), 500

    @app.after_request
    def _no_store(response):
        if request.path.startswith('/api/'):
            response.headers['Cache-Control'] = 'no-store'
        return response
