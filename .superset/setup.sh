#!/usr/bin/env bash
# Superset workspace setup: copy untracked local files, install deps, reserve dev ports.
set -euo pipefail

cd "${SUPERSET_WORKSPACE_PATH:-$(dirname "$0")/..}"
ROOT="${SUPERSET_ROOT_PATH:-}"

# Untracked files (secrets, Vercel link) from the main checkout. Never overwrite.
if [[ -n "$ROOT" && "$(cd "$ROOT" && pwd -P)" != "$(pwd -P)" ]]; then
  for f in .env .env.local .env.development .env.development.local .vercel; do
    if [[ -e "$ROOT/$f" && ! -e "$f" ]]; then
      cp -R "$ROOT/$f" "$f"
      echo "Copied $f from $ROOT"
    fi
  done
fi
if [[ ! -e .env && ! -e .env.local ]]; then
  echo "Warning: no .env or .env.local found; API routes need keys (see .env.example)" >&2
fi

npm ci --no-audit --no-fund

source .superset/ports.sh
if [[ -f "$PORTS_FILE" ]]; then
  echo "Using existing ports: $(tr '\n' ' ' < "$PORTS_FILE")"
else
  allocate_ports
fi
