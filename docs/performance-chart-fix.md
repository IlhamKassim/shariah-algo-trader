# Fix: The dashboard performance graph now shows a true, stable return

**Date:** September 2026
**What was fixed:** The "Performance vs SPUS" graph on the dashboard.

---

## The problem (in plain words)

The graph was **changing shape every day**, even on days when nothing was bought
or sold. A date that showed **+2%** yesterday could show **-1%** today, without
any real change in the portfolio.

The headline number (the "Strategy" percentage) could even flip from negative to
positive overnight — again with no trades happening.

This made the graph look wrong and inconsistent, so it couldn't be trusted.

## Why it happened

The graph was being built from only the **last 30 days** of account history.
Every day, that 30-day window slid forward by one day (the oldest day dropped
off, and the newest day was added).

Then the graph was re-drawn so that **day 1 of that window always started at 0%**.

This is the problem: because "day 1" moved every day, the whole curve was
re-anchored to a different starting point each day. That's why a date you had
already seen kept showing a different number.

> **Simple analogy:** Imagine measuring your height, but every day you change
> where the "zero" mark on the ruler is. The numbers would change every day even
> though your height didn't. That's what the graph was doing.

## What we changed

1. **The graph now uses the full account history** (from the very first day the
   account was funded), not just the last 30 days.

2. **The return is now measured from a fixed starting point** — the account's
   inception (day one). The "zero" mark no longer moves.

3. The chart label was updated to say **"Since inception"** instead of
   "Last 30 days", so it's honest about what the line represents.

4. The built-in **"Run Sanity Check"** button was updated to use the same fixed
   starting point, so its numbers now match the graph.

## What this means now

- The graph is a **real cumulative return**: "how much has the account grown
  since it started", measured as a percentage.
- **Past dates no longer change.** Only the newest day is added each day.
- The **1W / 1M / 3M / 6M** buttons now actually work — before, "3M" and "6M"
  showed the exact same 30 days as "1M" because there was nothing more to show.
- The graph can now be trusted and shown to users.

## How to check

1. Open the dashboard and hard-refresh the page.
2. Confirm the graph now starts at **0%** at the account's first day (inception).
3. Check the same graph again tomorrow — the past part of the curve should be
   **identical**; only one new day is added at the end.

---

### (Technical note — for the engineering record)

- `dashboard/api/routers/performance.py` — changed Alpaca history from a rolling
  `period=1M` window to the full `period=all` history, and anchored cumulative
  returns to inception (`equity / equity[0] - 1`) via a new `_anchor_cumulative()`
  helper.
- `dashboard/api/sanity_check.py` — same `period=all` + inception anchoring.
- `dashboard/web/src/pages/Overview.tsx` — subtitle text update. (Overview was
  since deleted in the Console redesign; the "since inception" subtitle now
  lives in `dashboard/web/src/pages/Performance.tsx`.)
- `tests/test_performance.py` — added regression tests that lock in the behavior.
- Full test suite: **395 passed, 3 pre-existing unrelated failures** (auth /
  HTTPS-redirect tests, environment-sensitive).
