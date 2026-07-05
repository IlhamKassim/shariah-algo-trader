---
name: run-dashboard
description: Launch and drive the Shariah Algo Trader dashboard (FastAPI backend + Vite/React frontend) in a real browser to verify it renders and works. Use when asked to run, start, or screenshot the dashboard, or to confirm a frontend change works for real.
---

# Run the dashboard

Two processes, plus a browser to drive the frontend. Check for
already-running instances before starting new ones — this repo's dev
servers are often left running across sessions.

## 1. Check what's already running

```bash
lsof -nP -iTCP:8000 -sTCP:LISTEN   # backend (uvicorn)
lsof -nP -iTCP:5173 -sTCP:LISTEN   # frontend (vite) — vite auto-increments to 5174, 5175... if taken
```

If both are already listening, skip straight to step 3 and use those
ports. Don't start duplicates — multiple uvicorn processes can end up
bound to the same port on macOS and it gets confusing fast.

## 2. Start what's missing

Backend (FastAPI, serves `/api/*`):

```bash
uv run uvicorn dashboard.api.main:app --host 0.0.0.0 --port 8000 &
timeout 30 bash -c 'until curl -sf http://localhost:8000/api/status >/dev/null; do sleep 1; done'
```

Frontend (Vite dev server, proxies `/api` to `:8000` per
`dashboard/web/vite.config.ts`):

```bash
cd dashboard/web && npm run dev &
```

Read the actual port from its stdout (`➜  Local: http://localhost:XXXX/`)
— it isn't always 5173.

Note: factor scores compute on backend startup and can take 2–4 minutes
on a cold start (per README). The Overview/Universe pages will look
sparse until that finishes — not a bug, just wait.

## 3. Drive it with the browser

`chromium-cli` is not installed in this environment. Use the
`claude-in-chrome` MCP tools instead: `tabs_context_mcp` (once, to get a
tab), then `browser_batch` with `navigate` + `computer` (`wait`,
`screenshot`) steps batched together.

Pages to hit, one screenshot each is enough to confirm a page is alive:

| Path | What to look for |
|---|---|
| `/` (Overview) | Portfolio value, P&L, compliance badge, performance chart |
| `/portfolio` | Holdings table with weights/P&L |
| `/universe` | 136-stock factor score ranking table |
| `/activity` | Trade activity log |
| `/compare` | Two equity-curve lines (Shariah vs Day Trader) + side-by-side metrics |
| `/day-trader` | Equity/positions/scanner config cards |

Check `read_console_messages` (pattern `"error"`, `onlyErrors: true`) on
at least one page load — a page can render its shell while a data fetch
fails silently.

### Gotcha: Compare page chart looks empty

The equity curves on `/compare` sit close together near the top of a
`$0–120k` y-axis (both strategies start at $100k paper equity and drift
a few percent). At normal screenshot resolution the lines can look
invisible. Before concluding the chart is broken, zoom into the plot
area (e.g. `computer` action `zoom` on the chart's bounding box) — the
lines are almost always there, just thin and high on the axis.

## 4. Clean up

Only kill processes you started this session. If you found servers
already running in step 1, leave them running — they may be a
persistent dev session the user relies on.
