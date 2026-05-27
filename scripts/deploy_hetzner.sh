#!/usr/bin/env sh
set -eu

if [ "$#" -lt 2 ]; then
  echo "Usage: sh scripts/deploy_hetzner.sh user@server /remote/path/to/Bibliomat" >&2
  exit 1
fi

TARGET="$1"
REMOTE_DIR="$2"
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

cd "$ROOT"

echo "Uploading code to $TARGET:$REMOTE_DIR"
rsync -az --delete \
  --exclude ".git/" \
  --exclude ".env" \
  --exclude ".env.*" \
  --exclude "data/" \
  --exclude "backups/" \
  --exclude "node_modules/" \
  --exclude ".venv/" \
  --exclude "__pycache__/" \
  --exclude "*.pyc" \
  --exclude "Sonstiges/logs/" \
  --exclude "Sonstiges/backend-temp/" \
  --exclude "Sonstiges/frontend-temp/" \
  ./ "$TARGET:$REMOTE_DIR/"

echo "Creating server backup and restarting containers"
ssh "$TARGET" "
  set -eu
  cd '$REMOTE_DIR'
  test -f .env
  if [ -f data/schulbuch.db ]; then
    python3 scripts/backup_db.py --database data/schulbuch.db
  else
    echo 'No data/schulbuch.db found yet; skipping backup.'
  fi
  docker compose up -d --build
  docker compose ps
"

echo "Deploy finished. Data directory and .env were preserved."
