# Shariah Algo Trader

An algorithmic trading bot that operates exclusively within a Shariah-compliant equity universe, taking long-only spot positions with no leverage, margin, derivatives, or options.

The Portfolio holds the top-20 stocks by Factor Score (equal-weighted Momentum Factor + Quality Factor z-scores) drawn from the Eligible Universe — the current holdings of a designated Shariah-compliant ETF such as SPUS.

## Setup

**Prerequisites:** Python 3.11+, [uv](https://github.com/astral-sh/uv)

```bash
# 1. Clone and enter the repo
git clone <repo-url>
cd shariah-algo-trader

# 2. Copy the example env file and fill in your credentials
cp .env.example .env
# Edit .env with your Alpaca and FMP API keys

# 3. Install dependencies (creates .venv automatically)
uv sync --extra dev
```

## Environment variables

All runtime configuration is read from environment variables. Copy `.env.example` to `.env` and set each value:

| Variable | Description |
|---|---|
| `ALPACA_API_KEY` | Alpaca API key |
| `ALPACA_API_SECRET` | Alpaca API secret |
| `ALPACA_BASE_URL` | `https://paper-api.alpaca.markets` (paper) or `https://api.alpaca.markets` (live) |
| `FMP_API_KEY` | Financial Modeling Prep API key |
| `ETF_SYMBOL` | ETF whose holdings define the Eligible Universe (e.g. `SPUS`) |
| `TOP_N` | Number of top-ranked stocks to hold in the Portfolio (default `20`) |

## Running tests

```bash
uv run pytest
```

## Project layout

```
shariah_algo_trader/
    config.py       — env-var config loading
    data/           — Holdings Snapshot fetching, price history (FMP)
    factors/        — Momentum Factor and Quality Factor computation
    jobs/           — Compliance Check and Rebalance jobs
    execution/      — Alpaca order submission
    scheduling/     — Scheduler (cron trigger)
```
