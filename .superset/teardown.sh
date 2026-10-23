#!/usr/bin/env bash
# Superset workspace teardown: stop dev servers started by run.sh, release ports.
set -uo pipefail

cd "${SUPERSET_WORKSPACE_PATH:-$(dirname "$0")/..}"

if [[ -f .superset/.run.pids ]]; then
  while read -r pid; do
    [[ -n "$pid" ]] && kill "$pid" 2>/dev/null && echo "Stopped process $pid"
  done < .superset/.run.pids
fi
rm -f .superset/.run.pids .superset/.ports.env
exit 0
