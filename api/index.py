# -*- coding: utf-8 -*-
"""Entry point for both `vercel dev`/production and `python api/index.py`.

Vercel imports this file directly rather than as a package member, so the
package directory is put on the path before importing anything from it.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from _lib.app import create_app  # noqa: E402

app = create_app()

if __name__ == '__main__':
    print('rakuen.live content API on http://127.0.0.1:8001')
    app.run(debug=True, port=8001)
