#!/bin/sh
# Migrate, then hand the container over to Node.
#
# `exec` is not optional: without it this shell stays PID 1, swallows SIGTERM,
# and every `docker compose down` / redeploy kills the bot mid-update instead of
# letting it shut down cleanly.
set -e

echo "Running database migrations…"
./node_modules/.bin/prisma migrate deploy

exec node dist/index.js
