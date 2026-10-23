# Per-workspace dev port allocation, sourced by setup.sh and run.sh.
#
# Each workspace gets a slot n (1..99): WEB_PORT=5173+10n, API_PORT=3001+10n.
# Slot 0 (5173/3001, the repo defaults) is left for the main checkout.
# Allocations live in <worktree>/.superset/.ports.env (gitignored), so other
# worktrees' claims are found via `git worktree list` and disappear with them.

PORTS_FILE=".superset/.ports.env"

port_free() {
  node -e '
    const s = require("net").createServer();
    s.once("error", () => process.exit(1));
    s.listen(+process.argv[1], () => s.close(() => process.exit(0)));
  ' "$1"
}

claimed_ports() {
  echo 5173
  echo 3001
  local here wt
  here="$(pwd -P)"
  git worktree list --porcelain | sed -n 's/^worktree //p' | while read -r wt; do
    [[ "$(cd "$wt" 2>/dev/null && pwd -P)" == "$here" ]] && continue
    [[ -f "$wt/$PORTS_FILE" ]] && sed -n 's/^[A-Z_]*PORT=//p' "$wt/$PORTS_FILE"
  done
}

allocate_ports() {
  local claimed n web api
  claimed=" $(claimed_ports | tr '\n' ' ') "
  for n in $(seq 1 99); do
    web=$((5173 + n * 10))
    api=$((3001 + n * 10))
    [[ "$claimed" == *" $web "* || "$claimed" == *" $api "* ]] && continue
    port_free "$web" && port_free "$api" || continue
    printf 'WEB_PORT=%s\nAPI_PORT=%s\n' "$web" "$api" > "$PORTS_FILE"
    echo "Reserved ports: web=$web api=$api"
    return 0
  done
  echo "No free port slot found" >&2
  return 1
}
