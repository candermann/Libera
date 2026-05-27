#!/usr/bin/env sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT"

python3 -m py_compile scripts/backup_db.py scripts/restore_db.py

if grep -R "https://unpkg.com\\|fonts.googleapis.com\\|fonts.gstatic.com\\|react.development\\|react-dom.development" frontend/index.html frontend/*.jsx frontend/*.js >/dev/null; then
  echo "External frontend CDN reference found." >&2
  exit 1
fi

missing_tools=0

if ! command -v uv >/dev/null 2>&1; then
  echo "uv not found. Install uv to run backend checks." >&2
  missing_tools=1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found. Install Node.js/npm to run frontend checks." >&2
  missing_tools=1
fi

if [ "$missing_tools" -ne 0 ]; then
  exit 1
fi

(cd backend && uv run pytest)
npm run typecheck
npm run build:frontend
