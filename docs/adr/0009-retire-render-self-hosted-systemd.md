# ADR-0009: Retire Render, deploy on the self-hosted server via systemd

- **Status:** Accepted
- **Date:** 2026-08-20
- **Related:** Supersedes the Render-specific parts of ADR-0008

## Context

`render.yaml` had been sitting at the repo root describing three Render-hosted
services (`shariah-algo-trader-dashboard`, `shariah-algo-trader-bot`,
`day-trader-bot`), and ADR-0008 (written 2026-08-19) was drafted assuming
Render was still the live deployment target.

It isn't. The repo also contains five systemd unit files —
`shariah-trader-dashboard.service`, `shariah-trader.service`,
`day-trader.service`, `admin-app/shariah-admin-app.service`, and
`shariah-local-dashboard.service` — all running as user `ubuntu` from
`/home/ubuntu/shariah-algo-trader`. More conclusively, application code itself
hardcodes that path: `dashboard/api/routers/settings.py` has
`ENV_PATH = "/home/ubuntu/shariah-algo-trader/.env"`, which only makes sense
if the app runs on this specific self-hosted box — Render's containers don't
use `/home/ubuntu/...`. The production deployment moved to a self-hosted
Ubuntu server (host/provider unknown from the repo alone — confirm with
Aqil), with everything supervised by systemd.

## Decision

- Removed `render.yaml` from the repo — it no longer describes anything real
  and was actively misleading (as of this ADR, at least one prior session
  gave advice assuming Render auto-deploy was still in play).
- The five `.service` files at the repo root / `admin-app/` are now the
  authoritative deployment description. Deploying means: SSH to the host,
  `git pull`, rebuild (`uv sync`, `cd dashboard/web && npm run build`),
  restart the relevant `systemctl` unit(s).
- Updated `CONTEXT.md`'s Scheduler definition and the `_IS_PRODUCTION` comment
  in `dashboard/api/main.py` to stop asserting Render is current.

## Consequences

- **Positive:** one source of truth for "how does this actually run" instead
  of a stale config file competing with reality.
- **Open / needs confirmation from Aqil, not resolved by this ADR:**
  - Whether deployment onto that host is automated at all (the CI comment in
    `.github/workflows/tests.yml` references a `shariah-auto-deploy.sh`
    "deploy watcher" that isn't in this repo — presumably lives on the host)
    or is a manual `git pull` + restart.
  - ADR-0008's underlying problem — the frontend must be rebuilt at deploy
    time or `dashboard/api/static/` drifts from source — is still real and
    still applies here. Render's `buildCommand` used to guarantee that; on
    the self-hosted path, whatever runs the deploy needs to actually execute
    `npm run build` before restarting `shariah-trader-dashboard.service`, or
    the drift bug ADR-0008 fixed comes back. Not verified from the repo.
  - `dashboard/api/main.py`'s production-detection (`_IS_PRODUCTION`) checks
    `ENVIRONMENT=production` OR a `RENDER` env var. Render used to set the
    latter automatically; nothing on the new host does. If that server's
    `.env` doesn't explicitly set `ENVIRONMENT=production`, the app silently
    runs as if it isn't in production — skipping the HTTPS-redirect
    middleware and the startup auth-fail-fast check. Worth a direct check of
    that `.env` file.
