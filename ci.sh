#!/usr/bin/env bash
# Runs the CI pipeline locally, in the same order as .github/workflows/ci.yml.
# Exit on first failure. Use it before pushing:
#
#   bash ci.sh
#
# Or wire it into a pre-push hook (see README.md).
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

fail() { echo "\n==> FAILED: $*" >&2; exit 1; }

run() {
  echo "\n==> $*"
  "$@" || fail "$*"
}

run pnpm install --frozen-lockfile
run pnpm typecheck
run pnpm build
run pnpm lint
run pnpm format:check
run pnpm test
run pnpm audit
run pnpm gen:api
run git diff --exit-code

echo "\n==> All CI checks passed locally."