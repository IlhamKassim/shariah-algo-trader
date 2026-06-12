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

Two optional variables control the Scheduler's firing time:

| Variable | Default | Description |
|---|---|---|
| `JOB_TIME` | `09:30` | Time to fire jobs each trading day (HH:MM, 24-hour) |
| `JOB_TIMEZONE` | `America/New_York` | Timezone for `JOB_TIME` |

## Running tests

```bash
uv run pytest
```

## Running the bot

```bash
# After installing with uv sync:
uv run shariah-trader

# Or directly:
uv run python main.py
```

The bot blocks and fires every NYSE trading day at 09:30 ET — Compliance Check daily, Rebalance on the first trading day of each calendar month.

## Running in production (long-term)

The scheduler is a long-running blocking process. To keep it alive across reboots:

**macOS (launchd)**

Create `~/Library/LaunchAgents/com.shariah-trader.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>com.shariah-trader</string>
    <key>ProgramArguments</key>
    <array>
        <string>/path/to/.venv/bin/shariah-trader</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>ALPACA_API_KEY</key><string>your_key</string>
        <!-- add remaining env vars -->
    </dict>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>StandardOutPath</key><string>/tmp/shariah-trader.log</string>
    <key>StandardErrorPath</key><string>/tmp/shariah-trader.err</string>
</dict>
</plist>
```
Then: `launchctl load ~/Library/LaunchAgents/com.shariah-trader.plist`

**Linux (systemd)**

Create `/etc/systemd/system/shariah-trader.service`:
```ini
[Unit]
Description=Shariah Algo Trader

[Service]
ExecStart=/path/to/.venv/bin/shariah-trader
EnvironmentFile=/path/to/.env
Restart=always

[Install]
WantedBy=multi-user.target
```
Then: `sudo systemctl enable --now shariah-trader`

**Quick background run (development)**
```bash
nohup uv run shariah-trader > shariah-trader.log 2>&1 &
```

## Project layout

```
shariah_algo_trader/
    config.py       — env-var config loading
    main.py         — wiring entrypoint (constructs clients, starts Scheduler)
    data/           — Holdings Snapshot fetching, price history (FMP)
    factors/        — Momentum Factor, Quality Factor, and Factor Scorer
    jobs/           — Compliance Check and Rebalance jobs
    execution/      — Alpaca order submission
    scheduling/     — Scheduler and NYSE trading-day calendar
```
