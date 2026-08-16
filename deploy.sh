#!/usr/bin/env bash
# Deploy on the VM: back up, pull, build, restart, verify, prune.
#
#   ./deploy.sh            normal deploy
#   ./deploy.sh --no-pull  rebuild from the current working tree
#
# Idempotent: running it twice in a row is a no-op beyond a rebuild.
set -Eeuo pipefail

cd "$(dirname "$(readlink -f "$0")")"
COMPOSE=(docker compose -f docker-compose.prod.yml)

[[ -f .env ]] || {
  echo "FATAL: .env is missing. Start with: cp .env.example .env && chmod 600 .env" >&2
  exit 1
}

if [[ "${1:-}" != "--no-pull" ]]; then
  # Back up before changing anything, but only once there is something to back
  # up - on the very first deploy the stack isn't running yet.
  if "${COMPOSE[@]}" ps --status running --services 2>/dev/null | grep -qx postgres; then
    echo "==> Backing up before deploy"
    ./backup.sh
  else
    echo "==> Stack not running yet, skipping pre-deploy backup"
  fi

  echo "==> git pull --ff-only"
  git pull --ff-only
fi

echo "==> Building app image"
"${COMPOSE[@]}" build app

echo "==> Starting stack"
# Recreating the app container sends the old one SIGTERM first, so bot.stop()
# releases the Telegram polling stream before the new one starts polling.
# Migrations run inside the container's entrypoint.
"${COMPOSE[@]}" up -d --remove-orphans

echo "==> Waiting for the app to become healthy"
cid="$("${COMPOSE[@]}" ps -q app)"
status=starting
for _ in $(seq 1 60); do
  if [[ "$(docker inspect -f '{{.State.Running}}' "$cid")" != "true" ]]; then
    echo "FATAL: the app container exited" >&2
    "${COMPOSE[@]}" logs --tail=120 app
    exit 1
  fi
  status="$(docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo starting)"
  [[ "$status" == healthy ]] && break
  sleep 5
done

if [[ "$status" != healthy ]]; then
  echo "FATAL: the app never became healthy (status: $status)" >&2
  "${COMPOSE[@]}" logs --tail=120 app
  exit 1
fi

echo "==> Pruning dangling images"
docker image prune -f >/dev/null

"${COMPOSE[@]}" ps
"${COMPOSE[@]}" logs --tail=30 app
echo "==> Deployed: https://$(grep -E '^APP_DOMAIN=' .env | cut -d= -f2-)"
