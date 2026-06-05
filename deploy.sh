#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$repo_dir"

docker compose config
docker compose pull || true
docker compose down
docker compose up -d --build
ready=0
for _ in {1..30}; do
  if curl -fsS http://127.0.0.1/api/health >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done
if [[ "$ready" -ne 1 ]]; then
  echo "Healthcheck nicht rechtzeitig erreichbar." >&2
  docker compose ps
  exit 1
fi
docker compose ps
curl -fsS http://127.0.0.1/api/health

echo "Deploy fertig."
