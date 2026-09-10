# ADR-0010: Point-in-time universe from N-PORT, and backtests that name a benchmark

- **Status:** Accepted
- **Date:** 2026-09-10
- **Related:** Supersedes `backtesting/edgar_parser.py` (removed)

## Context

The backtester could not answer the only question anyone actually asks of it —
does this strategy beat the market? Two independent defects made that so.

**1. There was no benchmark.** `backtesting/engine.py` computed CAGR,
annualised volatility, Sharpe and max drawdown for the strategy alone. The
words `benchmark`, `SPY` and `alpha` appeared nowhere in the module. Every
reported number said what the strategy returned, never what it returned
*relative to anything*. A 14% CAGR is excellent against a benchmark that did
8% and mediocre against one that did 16%, and the engine could not tell the
two apart.

**2. The universe was not point-in-time.** `edgar_parser.load_universe_history()`
parsed N-PORT XML files that had to be placed in `data/filings/` by hand — the
repo contained three, spanning 2024-08-31 to 2025-02-28, about six months. When
no filings were found it silently fell back to downloading the *current* SPUS
holdings CSV and applying that one list to every historical date. Two biases
followed:

- **Survivorship bias.** Every company dropped from SPUS for breaching the
  Shariah Screen — typically by levering up, often while falling — vanished
  from the test entirely, as though it had never been eligible.
- **Look-ahead bias.** `_get_active_universe()` fell back to the *earliest*
  available snapshot for any date preceding it, importing future membership
  into the past.

Two further data traps surfaced while reading real filings:

- `invCountry` is the issuer's country of domicile, not its listing venue.
  Using it as a US-listed filter would silently drop ACN, MDT, GRMN, NXPI, TT,
  LULU, ALLE, APTV, PNR and TEL — all NYSE/NASDAQ-listed.
- Each SPUS filing carries a stale untickered `ABIOMED INC` row with a `pctVal`
  of `-20` (the company was acquired in 2022). Summing `pctVal` naively makes a
  healthy filing report ~80% instead of ~100% and look truncated.

Separately, Sharpe was computed as `cagr / vol` against an implicit 0%
risk-free rate, which flatters every strategy and flatters volatile ones most.

## Decision

- **New `backtesting/nport.py`** replaces `edgar_parser.py`. It fetches N-PORT
  filing history directly from SEC EDGAR (rate-limited, contact-identified via
  `SEC_USER_AGENT`), parses filings into dated holdings snapshots, and assembles
  a true point-in-time universe. Amendments supersede originals for the same
  report date. Filings are dated by `repPdDate`; a filing without one is
  rejected rather than mis-dated by `repPdEnd`, which is constant across a
  fund's filings.
- **No fallback to current holdings, ever.** A missing history is reported as
  missing. `engine.run()` refuses to start rather than substituting today's
  universe, and refuses a start date earlier than the first snapshot.
- **`_get_active_universe()` never borrows a future snapshot.** For a date with
  no prior snapshot the answer is an empty universe.
- **New `backtesting/benchmarks.py`** builds buy-and-hold benchmark curves and
  computes excess CAGR, CAPM alpha, beta, correlation, tracking error,
  information ratio and up/down capture. Default benchmarks are `SPY` and
  `SPUS`.
- **`SPUS` is the benchmark that matters.** Beating SPY while holding a
  Shariah-screened subset largely measures the Shariah Screen — which excludes
  financials and levered firms, a large active bet in itself. Beating SPUS
  isolates what the factor scoring contributes on top of the universe it picks
  from.
- **Sharpe and alpha take a risk-free rate**, via `--risk-free-rate`. It
  defaults to `0.0` so previously reported figures remain comparable.
- **New `backtesting/sync_universe.py`** downloads filings and reports coverage,
  warning explicitly when under three years of history is available.

## Consequences

- **Positive:** the backtester can now answer the question it exists to answer,
  and cannot quietly answer it with biased data. The two biases are covered by
  named regression tests.
- **Positive:** the universe history is built from public-domain SEC filings,
  which are redistributable — unlike the `sp-funds.com` and Google Sheets CSVs
  the live bot reads, which are another party's screening output.
- **Negative:** backtests now *refuse to run* until filings are synced. This is
  deliberate. The previous behaviour was to run anyway and return a number that
  looked authoritative and was not.
- **Negative:** roughly six months of committed history is far too short to
  judge a factor strategy. Factor premia go negative for a decade at a time.
  `sync_universe` must be run against EDGAR before any result is meaningful,
  and the tooling says so rather than letting a short window pass unremarked.
- **Running it:** `.github/workflows/backtest.yml` runs the whole thing on a
  GitHub runner (`workflow_dispatch`), because SEC EDGAR and the price provider
  are unreachable from some development environments — restricted agent
  sandboxes and corporate proxies included. It needs a `SEC_USER_AGENT`
  repository *variable*; `FMP_API_KEY` is an optional secret, and without it
  Quality and Value score flat, reducing the run to momentum + low-volatility.
  The job summary says so rather than presenting it as a 4-factor result.
- **Price-side survivorship:** a point-in-time universe fixes the universe, not
  the price feed. Providers often have no history for delisted or acquired
  tickers — precisely the names that left the ETF badly — and dropping them
  silently would re-flatter results. `run()` now reports `price_coverage` and
  the CLI prints how many names were excluded and why.
- **Open:** only SPUS is in `FUND_REGISTRY`, because only its CIK (1742912) and
  series ID (S000067283) were verified against filings in this repo. Other funds
  need their identifiers confirmed on EDGAR, or passed via `--cik`/`--series`.
