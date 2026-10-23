#!/usr/bin/env bash
# Runs once when Superset creates a workspace.
set -euo pipefail

npm ci

# API keys live in one .env.local in the main checkout; symlink so rotations
# reach every workspace. Optional: the app runs on fallback data without keys.
root_env="${SUPERSET_ROOT_PATH:-}/.env.local"
if [ -n "${SUPERSET_ROOT_PATH:-}" ] && [ -f "$root_env" ]; then
  ln -sf "$root_env" .env.local
  # Vite's envDir is src/ (root: 'src' in vite.config.ts)
  ln -sf ../.env.local src/.env.local
else
  echo "No .env.local in main checkout; running with fallback data and no AI synthesis."
fi
