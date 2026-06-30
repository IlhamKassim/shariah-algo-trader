# Shariah Algo Trader

An algorithmic trading bot that operates exclusively within a Shariah-compliant equity universe, taking long-only spot positions with no leverage, margin, derivatives, or options.

## Language

### Strategy

**Factor Score**:
The composite rank assigned to each stock in the Eligible Universe, computed as the equal-weighted combination of four factor z-scores: Momentum, Quality, Low Volatility, and Value (25% each). Portfolio inclusion is determined by Factor Score rank — only the top-N scoring stocks are held at any time.
_Avoid_: composite score, ranking, signal

**Momentum Factor**:
A stock's recent price performance relative to its peers in the Eligible Universe, measured over a trailing window (conventionally 12-month return minus the most recent 1-month to exclude short-term reversal). Pure price data — no fundamental inputs.
_Avoid_: price momentum, return signal, trend score

**Quality Factor**:
A measure of a stock's financial health, derived from profitability and earnings consistency metrics (e.g., return on equity, profit margins, earnings stability). Higher Quality Factor scores favour companies with durable earnings — which correlates naturally with Shariah compliance, as highly leveraged firms score poorly.
_Avoid_: fundamentals score, financial quality, balance sheet score

**Portfolio**:
The set of exactly 20 stocks currently held by the bot — always a subset of the Eligible Universe, selected by top-N Factor Score rank. Positions are sized using inverse-volatility weighting (lower-volatility stocks receive larger allocations), capped at 2× equal weight to prevent extreme concentration. The Portfolio is long-only, unleveraged, and fully invested in spot equities.
_Avoid_: holdings, positions, basket

### Compliance Events

**Compliance Check**:
A daily process that fetches the latest Holdings Snapshot and compares it against every stock currently in the Portfolio. If any held stock is absent from the snapshot, a Compliance Exit is triggered immediately.
_Avoid_: universe check, screening run, daily scan

**Compliance Exit**:
A forced, immediate sale of a Portfolio stock that has left the Eligible Universe, triggered by the Compliance Check. Distinct from a Rebalance — it can occur on any trading day and is not driven by Factor Scores. The vacated slot remains empty until the next scheduled Rebalance.
_Avoid_: forced sell, compliance sell, emergency exit, eviction

### Rebalancing

**Rebalance**:
The monthly event where Factor Scores are recomputed for every stock in the Eligible Universe, a new top-N ranking is produced, and the Portfolio is updated to match — buying stocks that entered the top-N and selling those that fell out or left the Eligible Universe. Triggered on the first trading day of each calendar month.
_Avoid_: refresh, update, reconcile, sync

### Scheduling

**Scheduler**:
An APScheduler BlockingScheduler deployed as a Render background worker. Triggers two recurring jobs: the daily Compliance Check (every NYSE trading day at market open) and the monthly Rebalance (first NYSE trading day of each calendar month). Both jobs are stateless — they read current positions from Alpaca and current universe from ETF holdings at runtime.
_Avoid_: runner, task queue, job runner, daemon

### State

**Portfolio State**:
Alpaca's `/positions` endpoint is the canonical source of truth for what the Portfolio currently holds. The bot reads live position data from Alpaca at the start of every Rebalance and Compliance Check — no local database is maintained for this purpose.
_Avoid_: local state, position cache, holdings database

### Execution

**Broker**:
Alpaca. All buy and sell orders are submitted through the Alpaca REST API. Paper trading (Alpaca's simulated environment) is used for testing; live trading uses the same API surface with live credentials.
_Avoid_: exchange, trading platform, order router

### Data

**Market Data Provider**:
yfinance (Yahoo Finance). Used to fetch daily price history and fundamental snapshots (return on equity, profit margins, earnings stability) for all factor calculations. Alpaca's data API is used for intraday volume data.
_Avoid_: data source, data feed, price API

### Universe & Compliance

**Eligible Universe**:
The set of individual equity instruments currently eligible for trading. Membership is determined solely by presence in the latest Holdings Snapshot of one or more designated Shariah-compliant ETFs (e.g., SPUS). A stock not in the Eligible Universe must never be traded, regardless of signal strength.
_Avoid_: whitelist, stock list, universe, approved list

**Holdings Snapshot**:
A point-in-time record of an ETF's constituent stocks and their weights, fetched from a data provider API on a recurring schedule. The bot's Eligible Universe is derived from the most recent Holdings Snapshot. When a stock drops out of a new snapshot, it exits the Eligible Universe.
_Avoid_: holdings list, ETF data, universe refresh, constituent list

## Example Dialogue

> **Dev**: The Rebalance ran this morning and AAPL ranked 21st — just outside the top 20. But it's still in the Eligible Universe. Do we sell it?
>
> **Domain expert**: Yes. It fell out of the top-20 Factor Score ranking, so it exits the Portfolio in this Rebalance. That's a normal Rebalance exit, not a Compliance Exit — the reason is signal, not compliance.
>
> **Dev**: What if a stock leaves the Holdings Snapshot mid-month, then re-enters before the next Rebalance?
>
> **Domain expert**: When it left the snapshot, the Compliance Check triggered an immediate Compliance Exit. The vacated slot stays empty. When the next Rebalance runs, the stock will be scored and ranked like any other Eligible Universe member — if it's in the top 20, it gets bought back. There's no automatic re-entry between Rebalances.
>
> **Dev**: Could a stock ever be in the Portfolio but not in the Eligible Universe?
>
> **Domain expert**: Only in the window between a Holdings Snapshot changing and the next Compliance Check running — at most one trading day. That's the whole reason we check daily rather than monthly.
