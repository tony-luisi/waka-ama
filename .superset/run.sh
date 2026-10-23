#!/usr/bin/env bash
# Superset Run button: dev API server + Vite on free ports, so parallel
# workspaces never share a backend.
set -euo pipefail

API_PORT=$(node -e "const s=require('net').createServer().listen(0,()=>{console.log(s.address().port);s.close()})")
export API_PORT

node --env-file-if-exists=.env.local scripts/dev-api-server.js &
api_pid=$!
trap 'kill "$api_pid" 2>/dev/null' EXIT

# Vite picks the first free port from 5173 and proxies /api to $API_PORT
npx vite
