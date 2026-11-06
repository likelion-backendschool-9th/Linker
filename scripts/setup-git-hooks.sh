#!/usr/bin/env bash
# Point this clone at the repo-managed hooks under .githooks/
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

git config core.hooksPath .githooks
chmod +x .githooks/commit-msg 2>/dev/null || true

echo "git hooksPath -> .githooks (commit-msg strips AI agent attribution lines)"
