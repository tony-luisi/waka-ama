#!/usr/bin/env bash
# Superset run: start the local API server and Vite on this workspace's ports.
set -euo pipefail

cd "${SUPERSET_WORKSPACE_PATH:-$(dirname "$0")/..}"
source .superset/ports.sh

[[ -f "$PORTS_FILE" ]] || allocate_ports
source "$PORTS_FILE"
if ! port_free "$WEB_PORT" || ! port_free "$API_PORT"; then
  echo "Port $WEB_PORT or $API_PORT is busy; picking a new slot"
  rm -f "$PORTS_FILE"
  allocate_ports
  source "$PORTS_FILE"
fi
export WEB_PORT API_PORT

# The API functions read keys from process.env; dev-api-server.js doesn't load .env itself.
set -a
for f in .env .env.local; do [[ -f "$f" ]] && source "$f"; done
set +a

PIDS_FILE=".superset/.run.pids"
cleanup() {
  trap - EXIT INT TERM
  kill "${API_PID:-}" "${WEB_PID:-}" 2>/dev/null || true
  rm -f "$PIDS_FILE"
}
trap cleanup EXIT INT TERM

node scripts/dev-api-server.js &
API_PID=$!
node_modules/.bin/vite --port "$WEB_PORT" --strictPort &
WEB_PID=$!
printf '%s\n%s\n' "$API_PID" "$WEB_PID" > "$PIDS_FILE"

echo "Web: http://localhost:$WEB_PORT  (API proxied to :$API_PORT)"
wait "$WEB_PID"
