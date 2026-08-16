#!/usr/bin/env bash
# Deploy only when the tracked branch has moved. Driven by the systemd timer in
# deploy/systemd/ — see the autodeploy section in README.md.
#
# A thin wrapper on purpose: everything that matters (backup, pull, build,
# health check) already lives in deploy.sh, and duplicating it here would give
# the manual and automatic paths room to drift apart.
set -Eeuo pipefail

cd "$(dirname "$(readlink -f "$0")")"

# Read the branch rather than hardcoding it, so checking out a different one
# doesn't quietly keep deploying the old branch.
branch="$(git rev-parse --abbrev-ref HEAD)"

git fetch --quiet origin "$branch"

local_rev="$(git rev-parse HEAD)"
remote_rev="$(git rev-parse "origin/$branch")"

if [[ "$local_rev" == "$remote_rev" ]]; then
  echo "Up to date on $branch (${local_rev:0:8})"
  exit 0
fi

echo "New commits on $branch: ${local_rev:0:8} -> ${remote_rev:0:8}, deploying"
exec ./deploy.sh
