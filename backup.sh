#!/usr/bin/env bash
# Timestamped database dump plus a tarball of the uploaded images, with
# retention. Run it from cron, e.g.:
#
#   0 3 * * * /opt/simple-cards/app/backup.sh >> /var/log/simple-cards-backup.log 2>&1
#
# Restore a dump with:
#   docker compose -f docker-compose.prod.yml cp <file>.pgc postgres:/tmp/r.pgc
#   docker compose -f docker-compose.prod.yml exec -T postgres \
#     pg_restore -U simplecards -d simplecards --clean --if-exists \
#                --no-owner --no-privileges /tmp/r.pgc
set -Eeuo pipefail

cd "$(dirname "$(readlink -f "$0")")"
# Assumes plain KEY=value lines, which is what .env.example produces.
set -a
# shellcheck disable=SC1091
. ./.env
set +a

COMPOSE=(docker compose -f docker-compose.prod.yml)
BACKUP_DIR="${BACKUP_DIR:-/opt/simple-cards/backups}"
UPLOADS_HOST_DIR="${UPLOADS_HOST_DIR:-./data/uploads}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
ts="$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "$BACKUP_DIR"

# pg_dump runs inside the container, so the client version always matches the
# server version. Custom format: compressed and restorable with pg_restore.
echo "==> Dumping the database to $BACKUP_DIR/db-$ts.pgc"
"${COMPOSE[@]}" exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-simplecards}" -d "${POSTGRES_DB:-simplecards}" \
  --format=custom --no-owner --no-privileges \
  >"$BACKUP_DIR/db-$ts.pgc.tmp"
# Written to .tmp and renamed so an interrupted run never leaves a file that
# looks like a usable backup.
mv "$BACKUP_DIR/db-$ts.pgc.tmp" "$BACKUP_DIR/db-$ts.pgc"

echo "==> Archiving uploads to $BACKUP_DIR/uploads-$ts.tar.gz"
tar -C "$(dirname "$UPLOADS_HOST_DIR")" \
  -czf "$BACKUP_DIR/uploads-$ts.tar.gz.tmp" "$(basename "$UPLOADS_HOST_DIR")"
mv "$BACKUP_DIR/uploads-$ts.tar.gz.tmp" "$BACKUP_DIR/uploads-$ts.tar.gz"

find "$BACKUP_DIR" -type f \( -name 'db-*.pgc' -o -name 'uploads-*.tar.gz' \) \
  -mtime +"$RETENTION_DAYS" -delete

echo "==> Done"
du -sh "$BACKUP_DIR"
