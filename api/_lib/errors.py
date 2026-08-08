# -*- coding: utf-8 -*-
"""Errors the content layer raises, translated to HTTP status by `http`."""


class ContentError(Exception):
    status = 400


class Invalid(ContentError):
    """The request was understood but the data is unusable."""
    status = 400


class NotFound(ContentError):
    status = 404


class Denied(ContentError):
    status = 403


class ReadOnly(ContentError):
    """Editing attempted where the filesystem cannot be written."""
    status = 503
