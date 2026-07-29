# Performance Alpha — How It's Calculated & What It Means

*Last updated: 2026-07-29*

---

## What Is "Alpha vs SPUS"?

The **Alpha vs SPUS** figure shown on the Overview chart is the raw **excess return** of the Shariah Algo Trader strategy over the SPUS (SP Funds S&P 500 Shariah ETF) benchmark over the selected time window (default: 1 month).

```
Alpha (pts) = Strategy cumulative return %  −  SPUS cumulative return %
```

It is expressed in **percentage points (pts)**, not a ratio.

---

## How the Number Is Computed

The calculation is fully real — no demo data is used when a user is authenticated with live or paper Alpaca credentials.

### Step 1 — Fetch real portfolio equity history
[`dashboard/api/routers/performance.py`](../dashboard/api/routers/performance.py)

```
GET /v2/account/portfolio/history?period=1M&timeframe=1D  →  Alpaca API
```

This returns actual daily equity values for the connected Alpaca paper or live account.

### Step 2 — Compute strategy cumulative return

```python
port_returns    = equity_series.pct_change().fillna(0)
port_cumulative = (1 + port_returns).cumprod() - 1
```

This is a standard **time-weighted compounded return** — the same methodology used by professional fund performance reports.

### Step 3 — Fetch SPUS & S&P 500 benchmarks

```python
yf.download("SPUS", start=start_date, end=end_date, auto_adjust=True)
yf.download("SPY",  start=start_date, end=end_date, auto_adjust=True)
```

Both benchmarks use the same date range as the portfolio history, and are forward-filled to cover non-trading days.

### Step 4 — Display in the chart

```typescript
// PerformanceChart.tsx
const alphaVal = stratVal - spusVal;  // final data point difference
```

---

## Example: July 2026 Paper Account Result

| Metric | Value |
|---|---|
| Strategy cumulative (30 days) | **+3.86%** |
| SPUS cumulative (30 days) | **−4.15%** |
| S&P 500 cumulative (30 days) | **−2.71%** |
| **Alpha vs SPUS** | **+7.99 pts** |

**Why it happened:** July 2026 was a rough month for broad equity markets. The SPUS ETF and the S&P 500 both fell while the factor-based Shariah strategy held up, resulting in a large spread. The arithmetic: `3.86 − (−4.15) = +7.99 pts`.

---

## Is a High Alpha Real or Fabricated?

The numbers are **mathematically genuine** — they reflect actual Alpaca equity values compared to actual market benchmark prices.

However, there are important caveats:

### ✅ What it means
- The portfolio genuinely outperformed SPUS over this specific window.
- The factor selection (quality, value, momentum) shielded the portfolio from some of the market drawdown.

### ⚠️ What it does NOT mean
- **30 days is too short** to draw statistically significant conclusions. A reliable alpha signal requires at minimum 12–36 months of data.
- **Paper account ≠ live account.** Paper trading has no slippage, no partial fills, no liquidity constraints. Real-world execution will narrow the alpha.
- **Regime dependency.** A strategy can generate high alpha in a down market simply by holding cash or being underweight falling sectors — this is not sustainable alpha.

---

## Sanity Check System

The platform includes an automated sanity checker ([`dashboard/api/sanity_check.py`](../dashboard/api/sanity_check.py)) that flags unrealistic performance:

| Threshold | Description |
|---|---|
| **±3.0% single-day alpha drift** | Triggers an `ANOMALOUS` alert if the portfolio diverges from SPUS by more than 3% in a single day |
| **±50% cumulative return** | Flags extreme overall returns as likely data anomalies |

Users can trigger this manually via the **"Run Sanity Check"** button on the Overview chart.

---

## Benchmark Choice: SPUS vs S&P 500

| Benchmark | Ticker | Why Used |
|---|---|---|
| **Primary** | `SPUS` | SP Funds S&P 500 Shariah ETF — the natural apples-to-apples comparison for a Shariah factor strategy |
| **Secondary** | `SPY` | Broad S&P 500 — context for overall market conditions |

Alpha is always reported relative to **SPUS**, not SPY, since SPY includes non-compliant sectors (financials, weapons, etc.) that the strategy explicitly avoids.

---

## Conclusion

> An alpha of ~8 pts over one month is **plausible and mathematically correct** given the market conditions in July 2026, but it is **not statistically conclusive** at this point in the strategy's life. Monitor the cumulative alpha over 12+ months before drawing conclusions about the strategy's genuine edge.
