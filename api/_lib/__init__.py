# rakuen.live flat-file content backend.
#
# Layering, innermost first:
#   config   — where things live on disk
#   md       — a markdown file with a frontmatter header
#   schema   — declarative frontmatter <-> JSON field mapping
#   store    — reading/writing directories of markdown documents
#   models   — the actual content types (posts, novels, albums)
#   http     — auth + error translation
#   app      — Flask wiring
#
# To add a content type, only `models` and `app` need to change.
