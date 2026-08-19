# ADR-0008: Automate the frontend build on every deploy

- **Status:** Accepted
- **Date:** 2026-08-19
- **Related:** ADR-0002, ADR-0007

## Context

The backend (FastAPI, `dashboard/api/`) serves the React/Vite frontend as static
files from `dashboard/api/static/` via `SPAStaticFiles` (see `dashboard/api/main.py`).

`render.yaml`'s web `buildCommand` was `pip install uv && uv sync --no-dev` — it never
built the frontend. Whatever `dashboard/api/static/` happened to hold in the deployed
git commit was exactly what got served. The frontend was built locally by a human and
its output manually committed, which caused a drift incident: the live site was serving
asset hashes (`index-CPJn4sqC.js` / `index-CLR0xEYe.css`) that matched no commit in git
history, so a `git reset`/`clean` on the Render host (or a redeploy from a commit
without those exact files) would have broken the live site.

## Decision

Make the frontend build part of every Render web deploy:

- `render.yaml` web `buildCommand` now runs
  `npm ci && npm run build` (in `dashboard/web/`) after the Python sync.
- `dashboard/web/vite.config.ts` already sets `build.outDir` to `dashboard/api/static`
  with `emptyOutDir: true`, and Vite copies `web/public/*` (favicon, icons, robots.txt,
  sitemap.xml) into the output — so the static dir is regenerated from source on every
  deploy and can no longer drift from the committed build.
- The build outputs (`dashboard/api/static/assets/` and `dashboard/api/static/index.html`)
  are added to `.gitignore` so hand-built artifacts are no longer accidentally committed.
  The files currently in git are **kept** until the next deploy, so the repo stays
  deployable without a Node install; after the next successful deploy they are stale and
  safely ignored.

## Consequences

- **Positive:** a redeploy from any commit that builds produces a fresh, internally
  consistent `dashboard/api/static/`; no more "asset hashes that exist in no commit".
- **Positive:** the frontend and backend no longer drift when the UI changes.
- **Negative / tradeoff:** adds Node/npm as a build-time dependency on Render's Python
  runtime (Render's python image ships Node) and increases build time/cost. This is
  acceptable because the frontend only changes on deploy, not on every request.
- **Negative:** a fresh clone without a Node build has no static frontend. The backend
  already tolerates a missing `static/` dir (`if _STATIC.exists()` in `main.py`), so the
  API still runs; the SPA just won't be served until a build runs.

## Alternatives considered

- *Manual copy step in the build command* (`rm -rf dashboard/api/static/assets && cp -r
  dashboard/web/dist/* dashboard/api/static/`): rejected as redundant — Vite already
  outputs straight into `dashboard/api/static/`.
- *Keep manual commit workflow AND automated build:* rejected — that coexistence is what
  caused the drift.