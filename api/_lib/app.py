# -*- coding: utf-8 -*-
"""Flask wiring.

Routes are registered from the models rather than hand-written per content
type, so a new collection costs one `crud()` call.
"""

from flask import Blueprint, Flask, abort, jsonify, request, send_from_directory

from . import models, store
from .config import ASSETS_DIR, BASE_DIR, CONTENT_DIR
from .http import check_password, editing, install_error_handling, payload

api = Blueprint('api', __name__, url_prefix='/api')


def crud(base, model, writable=True):
    """Register list/detail (and optionally create/update/delete) for a model."""
    name = base.strip('/')

    def index():
        return jsonify(model.list())

    def detail(slug):
        return jsonify(model.get(slug))

    api.add_url_rule('/%s' % base, '%s_index' % name, index, methods=['GET'])
    api.add_url_rule('/%s/<slug>' % base, '%s_detail' % name, detail, methods=['GET'])

    if not writable:
        return

    @editing
    def create():
        return jsonify(model.create(payload())), 201

    @editing
    def update(slug):
        return jsonify(model.update(slug, payload()))

    @editing
    def destroy(slug):
        model.delete(slug)
        return jsonify({'ok': True})

    api.add_url_rule('/%s' % base, '%s_create' % name, create, methods=['POST'])
    api.add_url_rule('/%s/<slug>' % base, '%s_update' % name, update, methods=['PUT'])
    api.add_url_rule('/%s/<slug>' % base, '%s_delete' % name, destroy, methods=['DELETE'])


crud('posts', models.posts)
crud('books', models.books)
crud('albums', models.albums, writable=False)


# -- chapters live inside a book, so they get their own nested routes --------
@api.route('/books/<slug>/chapters/<number>', methods=['GET'])
def chapter_detail(slug, number):
    return jsonify(models.books.chapter(slug, number, request.args.get('volume')))


@api.route('/books/<slug>/chapters', methods=['POST'])
@editing
def chapter_create(slug):
    return jsonify(models.books.create_chapter(slug, payload())), 201


@api.route('/books/<slug>/chapters/<number>', methods=['PUT'])
@editing
def chapter_update(slug, number):
    return jsonify(models.books.update_chapter(slug, number, payload()))


@api.route('/books/<slug>/chapters/<number>', methods=['DELETE'])
@editing
def chapter_delete(slug, number):
    models.books.delete_chapter(slug, number, payload().get('volume'))
    return jsonify({'ok': True})


@api.route('/auth', methods=['POST'])
def auth():
    if not check_password(payload().get('password')):
        return jsonify({'error': '口令错误'}), 403
    return jsonify({'ok': True})


def create_app():
    app = Flask(__name__)
    app.register_blueprint(api)
    install_error_handling(app)

    @app.route('/')
    def index():
        return send_from_directory(BASE_DIR, 'index.html')

    @app.route('/content/<path:filename>')
    def serve_content(filename):
        # Working files live beside published ones; they must never be served.
        if store.is_private_path(filename):
            abort(404)
        return send_from_directory(CONTENT_DIR, filename)

    @app.route('/assets/<path:filename>')
    def serve_assets(filename):
        if store.is_private_path(filename):
            abort(404)
        return send_from_directory(ASSETS_DIR, filename)

    return app
