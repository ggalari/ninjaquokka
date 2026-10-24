#!/usr/bin/env bash
# Scaffolds a pnpm + Turborepo monorepo from templates in .devcontainer/templates:
#   apps/api            Fastify REST API (Zod schemas -> OpenAPI, Prisma + Postgres)
#   apps/web            React + Vite + Tailwind + TanStack Query
#   packages/api-client Typed client generated from the API's OpenAPI spec
#
# File contents live in .devcontainer/templates (rendered by scaffold.mjs), and
# project-level settings live in .devcontainer/project.json. This script only
# orchestrates: edit template files or project.json, not this script.
#
# Safe to re-run: existing files are never overwritten, and dependencies are
# only added for packages this script creates. Once it finishes successfully it
# writes .devcontainer/.scaffolded, after which reruns only restore dependencies.
# If a first run fails midway there is no marker, so rerunning resumes safely.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

PNPM_VERSION="$(node -p "require('./.devcontainer/project.json').pnpmVersion ?? '12.11.2'")"
NPM_SCOPE="$(node -p "const p = require('./.devcontainer/project.json'); p.npmScope ?? '@' + p.name")"

# Choose a Corepack shim directory. Inside a container, prefer the writable
# global Node/npm bin: pnpm strips ~/.local/bin from the PATH it gives to
# scripts, and Turbo invokes `pnpm` again, so a home-only shim can lose to the
# image's older pnpm and fail the packageManager check. On a host, keep the
# shims user-local to avoid touching the system installation.
find_corepack_bin() {
  local dir
  if [ -f /.dockerenv ] || [ -n "${REMOTE_CONTAINERS:-}" ] || [ -n "${CODESPACES:-}" ]; then
    for dir in \
      "$(dirname "$(command -v pnpm 2> /dev/null || true)" 2> /dev/null)" \
      "$(dirname "$(command -v node 2> /dev/null || true)" 2> /dev/null)" \
      "$(dirname "$(command -v npm 2> /dev/null || true)" 2> /dev/null)" \
      "/usr/local/share/npm-global/bin"; do
      [ -n "$dir" ] && [ "$dir" != "." ] && [ "$dir" != "$HOME/.local/bin" ] || continue
      case ":$PATH:" in *":$dir:"*) ;; *) continue ;; esac
      mkdir -p "$dir" 2> /dev/null || continue
      if [ -w "$dir" ]; then
        printf '%s\n' "$dir"
        return 0
      fi
    done
  fi
  mkdir -p "$HOME/.local/bin"
  printf '%s\n' "$HOME/.local/bin"
}

# Install the pinned pnpm through Corepack. This avoids sudo (unavailable in
# many remote workspaces) and makes the activated version predictable. Fail
# loudly instead of silently using another pnpm.
if ! command -v corepack > /dev/null 2>&1; then
  echo "corepack is required to activate pnpm ${PNPM_VERSION}." >&2
  echo "Enable Corepack (Node 24 ships with it) or install pnpm@${PNPM_VERSION} manually." >&2
  exit 1
fi

COREPACK_BIN="$(find_corepack_bin)"
corepack enable --install-directory "$COREPACK_BIN"
export PATH="$COREPACK_BIN:$PATH"
hash -r 2> /dev/null || true

# ---------------------------------------------------------------------------
log "1/5 Enabling pnpm ${PNPM_VERSION} (Corepack shims in ${COREPACK_BIN})"
corepack prepare "pnpm@${PNPM_VERSION}" --activate
if [ "$(pnpm --version)" != "$PNPM_VERSION" ]; then
  echo "Expected pnpm ${PNPM_VERSION}, got $(pnpm --version)." >&2
  echo "Check the pnpmVersion field in .devcontainer/project.json." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# After the first successful run a marker file exists (commit it to git). Later
# container rebuilds only restore dependencies; nothing is scaffolded again, so
# files you deleted or rewrote are never recreated or touched.
MARKER=".devcontainer/.scaffolded"
if [ -f "$MARKER" ]; then
  log "Already scaffolded ($MARKER). Restoring dependencies only"
  if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; else pnpm install; fi
  pnpm --filter api db:generate
  exit 0
fi

fresh_root=false; [ -f package.json ] || fresh_root=true
fresh_api=false;  [ -f apps/api/package.json ] || fresh_api=true
fresh_web=false;  [ -f apps/web/package.json ] || fresh_web=true
fresh_cli=false;  [ -f packages/api-client/package.json ] || fresh_cli=true

# ---------------------------------------------------------------------------
log "2/5 Writing workspace files from templates"
node .devcontainer/scaffold.mjs
mkdir -p .history

# ---------------------------------------------------------------------------
log "3/5 Installing dependencies (latest versions, pinned afterwards by pnpm-lock.yaml)"

if $fresh_root; then
  pnpm add -Dw turbo prettier eslint @eslint/js typescript-eslint globals eslint-plugin-react-hooks eslint-plugin-react-refresh
fi

if $fresh_api; then
  pnpm --filter api add fastify @fastify/swagger @fastify/swagger-ui fastify-type-provider-zod zod "@prisma/client@^7" "@prisma/adapter-pg@^7"
  pnpm --filter api add "better-auth@^1" "@better-auth/prisma-adapter@^1"
  pnpm --filter api add -D typescript tsx "@types/node@^24" "prisma@^7" vitest
fi

if $fresh_cli; then
  pnpm --filter "$NPM_SCOPE/api-client" add openapi-fetch
  # openapi-typescript needs the TypeScript compiler API, which TypeScript 7 removed
  # (it returns in 7.1), so this one package stays on TypeScript 6.
  pnpm --filter "$NPM_SCOPE/api-client" add -D openapi-typescript "typescript@^6"
fi

if $fresh_web; then
  pnpm --filter web add react react-dom @tanstack/react-query "$NPM_SCOPE/api-client@workspace:*" "better-auth@^1"
  pnpm --filter web add -D vite @vitejs/plugin-react "typescript@^7" @types/react @types/react-dom tailwindcss @tailwindcss/vite
fi

pnpm install

# ---------------------------------------------------------------------------
log "4/6 Generating the typed API client from the OpenAPI spec"
pnpm gen:api

# ---------------------------------------------------------------------------
log "5/6 Formatting the rendered workspace (Prettier)"
pnpm format

# ---------------------------------------------------------------------------
log "6/6 Finishing up"
if [ ! -d .git ] && ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  git init -q
fi

date -u +"scaffolded %Y-%m-%dT%H:%M:%SZ" > "$MARKER"

cat <<'EOF'

Setup complete.

  pnpm dev           run API (http://localhost:3000) and web (http://localhost:5173)
  pnpm gen:api       regenerate the typed client after changing API endpoints
  pnpm typecheck     typecheck everything (catches API/UI contract breaks)

  API docs:          http://localhost:3000/docs
  First migration:   pnpm --filter api db:migrate --name init
  Browse your data:  pnpm --filter api db:studio

EOF
