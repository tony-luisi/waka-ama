# Waka Ama Conditions

Vite + TypeScript static site with Vercel serverless functions in `api/`. See README.md for features and scoring.

## Verify changes

There are no tests or linter. Before calling work done:

```bash
npm run typecheck && npm run build
```

## Dev setup

- Vite `root` is `src/`, so Vite reads env files from `src/` (setup symlinks `src/.env.local`).
- In dev, tides and weather are fetched directly from the providers; only `/api/forecast-synthesis` goes through the dev API server (`scripts/dev-api-server.js`), which Vite proxies to `localhost:$API_PORT`.
- Keep dev URLs relative (`/api/...`). Never hardcode `localhost` ports: several Superset workspaces run in parallel, each on its own ports (`.superset/run.sh`).
- The app must keep working with no API keys (fallback data, AI card hidden).

## Domain constraints

- Recommendations are limited to the 9am–9pm paddling window.
- Changes to scoring (`src/difficulty.ts`, `src/api/chop-service.ts`, net-assistance logic) can be wrong while still typechecking; reason through a concrete example before and after.

## Don't

- Push to `main`: it auto-deploys to production on Vercel. Work on a branch and open a PR.
- Run `vercel --prod`, `vercel promote`, or `vercel env` commands.
