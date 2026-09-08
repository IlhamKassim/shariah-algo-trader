# ADR-0010: Persist daily equity (NAV) snapshots in SQLite, move to Supabase when multi-server

- **Status:** Proposed
- **Date:** 2026-09-07
- **Related:** #17 (implementation), #14 (multi-tenant transition); refines ADR-0002

## Context

The dashboard's "since inception" performance graph derives its history solely
from Alpaca's `/v2/account/portfolio/history` endpoint. That is a single point
of failure: if Alpaca truncates, resets, or changes that history (or the paper
account is reset), the curve's anchor jumps and the historical graph cannot be
reproduced or audited locally.

ADR-0002 states that Alpaca is the canonical source of *current* Portfolio state
and that the bot keeps no local database for it. This ADR does not change that:
current positions and orders still come from Alpaca at runtime. It only adds a
local, **append-only** record of daily end-of-day equity for reporting and
auditing — read-only, and never read by trading logic.

## Decision

1. Persist one end-of-day equity (NAV) row per account per NYSE trading day.
2. Store it in **SQLite** (`data/portfolio.db`, already reserved) while the
   writer (Scheduler) and reader (dashboard API) share a single self-hosted
   server — the current deployment (ADR-0009).
3. Hide storage behind a small seam (e.g. `record_nav()` / `load_nav()`) so the
   backend can be swapped later without touching call sites.
4. When the platform moves to the multi-tenant, multi-server architecture
   (ADR-0006 / #14), migrate this table into **Supabase Postgres** — the store
   of record that migration already adopts. Until then, Supabase is unnecessary
   overhead for a single-writer, append-only dataset.

## Consequences

- **Positive:** the historical performance curve becomes self-owned and
  reproducible; Alpaca history becomes a backfill source, not the authority.
- **Positive:** SQLite adds no new service, no network hop, and negligible
  storage (one small row per account per trading day, even at ~10k users).
- **Trade-off:** a local DB is a second copy of equity data, which ADR-0002
  deliberately avoided for *positions*. The distinction is kept narrow: the
  snapshot is append-only and never read by trading logic, so no
  synchronisation failure can affect order decisions.
- **Open:** the exact writer trigger (existing Scheduler vs a new daily job)
  and the account-id keying scheme are left to the #17 implementation.
