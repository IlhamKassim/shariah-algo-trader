# Shariah Admin — web frontend

Standalone admin app for the beta tester pilot (SPEC-BETA-PILOT.md §5).
Clean-SaaS UI: light theme default + dark toggle, top nav only, white cards
with slate-200 borders, single indigo-600 accent, state badges
(green=active, amber=pending, red=revoked, slate=no keys).

## Stack

Vite + React 19 + TypeScript + Tailwind. No shadcn (deliberately, so the look
cannot drift into the existing dashboard's component style). `@supabase/supabase-js`
provides the session whose access token the backend accepts as a bearer JWT.

## Build-time env vars

Copy `.env.example` to `.env` (or export in the shell):

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon key (public by design)

## Commands

```sh
npm install
npm run dev      # vite dev server, proxies /api -> http://localhost:8002
npm run test     # vitest run (API client + formatters)
npm run build    # tsc -b && vite build -> dist/ (served by admin_app.api.main)
```

## API

The FastAPI backend (admin-app/admin_app) serves the built SPA from `dist/`
and exposes `/api/admin/*` (A1–A7). Every call carries the Supabase access
token as `Authorization: Bearer <token>`; the backend enforces `verify_auth`
(401) + `is_admin` (403) on every route.
