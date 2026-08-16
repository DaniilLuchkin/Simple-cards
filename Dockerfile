# syntax=docker/dockerfile:1

# Multi-stage build for the Simple Cards monorepo. The runtime image keeps the
# repo layout (/app/server/dist next to /app/web/dist) because server/src/app.ts
# resolves the frontend as path.join(__dirname, "../../web/dist").
#
# Debian rather than Alpine on purpose: Prisma ships glibc/OpenSSL-3 query
# engines for both linux-x64 and linux-arm64, so this builds natively on the
# Ampere A1 instances Oracle gives away free and on x86 alike. Don't cross-build
# with --platform without adding binaryTargets to schema.prisma.

FROM node:22-bookworm-slim AS base
# openssl: Prisma probes the OpenSSL version to pick its engine binary.
# ca-certificates: outbound TLS to Telegram and OpenRouter.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# --------------------------------------------------------------------- build
FROM base AS build
# Manifests first: dependencies only reinstall when they actually change, not on
# every source edit.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json server/
COPY web/package.json web/
# The schema has to be in place before install: the server's postinstall hook is
# `prisma generate`, which fails outright without it. Scripts must stay enabled
# for the same reason (@prisma/engines downloads its binaries in a postinstall).
COPY server/prisma server/prisma
# --prod=false is belt and braces: the build needs devDependencies, and pnpm
# would drop them if NODE_ENV ever leaked in from the environment.
RUN pnpm install --frozen-lockfile --prod=false

COPY . .
# `web` is built before `server` so a failing frontend build fails the image
# rather than producing a server with no frontend to serve. The two `test -f`
# checks turn a silent regression (API up, Mini App blank) into a build failure:
# app.ts only checks for web/dist once, at import time.
RUN pnpm --filter @simple-cards/server run prisma:generate \
 && pnpm --filter @simple-cards/web build \
 && pnpm --filter @simple-cards/server build \
 && test -f web/dist/index.html \
 && test -f server/dist/index.js

# -------------------------------------------------------------- runtime-deps
# Only the server's dependency graph, so vite/react/tailwind stay out of the
# runtime image. devDependencies are kept deliberately: `prisma migrate deploy`
# runs on every boot and the Prisma CLI is a devDependency, so a --prod install
# here would produce an image that cannot migrate.
FROM base AS runtime-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json server/
COPY web/package.json web/
COPY server/prisma server/prisma
RUN pnpm install --frozen-lockfile --prod=false --filter @simple-cards/server

# ------------------------------------------------------------------- runtime
FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    UPLOADS_DIR=/data/uploads \
    CHECKPOINT_DISABLE=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=true

# pnpm's node_modules is a symlink farm pointing into /app/node_modules/.pnpm,
# so the tree has to land at exactly the paths it was created at.
COPY --from=runtime-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=runtime-deps --chown=node:node /app/server/node_modules ./server/node_modules
COPY --from=build --chown=node:node /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build --chown=node:node /app/server/package.json ./server/package.json
COPY --from=build --chown=node:node /app/server/prisma ./server/prisma
COPY --from=build --chown=node:node /app/server/dist ./server/dist
# Must stay a sibling of server/ - see the path note at the top of this file.
COPY --from=build --chown=node:node /app/web/dist ./web/dist
COPY --chown=node:node docker/entrypoint.sh ./docker/entrypoint.sh

# Fallback mount point; in production this is a bind mount from the host.
RUN chmod +x ./docker/entrypoint.sh && mkdir -p /data/uploads && chown -R node:node /data

USER node
WORKDIR /app/server
EXPOSE 3000

# Uses Node's global fetch, so the image needs no curl or wget.
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/app/docker/entrypoint.sh"]
