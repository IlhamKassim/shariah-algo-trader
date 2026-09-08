import datetime
import logging
import os
import time

import pandas as pd
import yfinance as yf
from fastapi import APIRouter, Depends, Request

from dashboard.api.deps import get_alpaca, get_config
from dashboard.api.live_equity import live_account, patch_today, ts_to_date
from dashboard.api.models import PerformanceResponse
from dashboard.api.nav_store import load_nav, record_nav_many
from shariah_algo_trader.config import Config
from shariah_algo_trader.execution.alpaca_client import AlpacaClient, AlpacaError

router = APIRouter()
logger = logging.getLogger(__name__)

_BENCH_TICKER = os.environ.get("BENCHMARK_TICKER", "SPUS")
_SP500_TICKER = os.environ.get("SP500_TICKER", "SPY")
_BENCH_CACHE_TTL = 3600   # 1 hour — benchmark data is daily

# Cache: (ticker, start_date_iso, end_date_iso) → (monotonic_time_fetched, pd.Series)
_bench_cache: dict[tuple[str, str, str], tuple[float, pd.Series]] = {}


def _fetch_benchmark(ticker: str, start_date: datetime.date, end_date: datetime.date) -> pd.Series:
    key = (ticker, start_date.isoformat(), end_date.isoformat())
    cached = _bench_cache.get(key)
    if cached is not None:
        fetched_at, series = cached
        if time.monotonic() - fetched_at < _BENCH_CACHE_TTL:
            return series

    logger.info("Fetching %s benchmark %s → %s", ticker, start_date, end_date)
    bench_raw = yf.download(
        ticker,
        start=str(start_date),
        end=str(end_date + datetime.timedelta(days=1)),
        auto_adjust=True,
        progress=False,
    )
    if bench_raw.empty:
        # Fallback to any previously cached series for this ticker if available
        for (t, _, _), (_, cached_series) in _bench_cache.items():
            if t == ticker and not cached_series.empty:
                logger.warning("Empty response fetching %s, using fallback cached benchmark series", ticker)
                return cached_series
        return pd.Series(dtype=float)

    bench_close = bench_raw["Close"]
    if isinstance(bench_close, pd.DataFrame):
        bench_close = bench_close.iloc[:, 0]
    series = bench_close

    _bench_cache[key] = (time.monotonic(), series)
    return series


def _anchor_cumulative(series: pd.Series) -> list[float]:
    """Cumulative return anchored to the series' *first* point (inception).

    Point 0 is 0.0 and every later point is ``series[i] / series[0] - 1``.
    Anchoring to the true first point — not to a rolling window's first bar —
    is what keeps the dashboard curve stable from one day to the next.
    """
    if series.empty:
        return []
    base = float(series.iloc[0])
    if base == 0:
        return [0.0] * len(series)
    return ((series / base) - 1).round(6).tolist()


def _to_cumulative(raw: pd.Series, equity_index: pd.DatetimeIndex) -> list[float]:
    if raw.empty:
        return [0.0] * len(equity_index)
    # Normalize both to date-only (no timezone/time component) for alignment
    raw_daily = raw.copy()
    raw_daily.index = pd.to_datetime(raw_daily.index).normalize()
    equity_dates = equity_index.normalize()
    # Forward-fill across the full calendar range to cover non-trading days
    full_range = pd.date_range(raw_daily.index.min(), equity_dates.max(), freq="D")
    raw_daily = raw_daily.reindex(full_range).ffill()
    # Now align to the equity index dates
    aligned = raw_daily.reindex(equity_dates).ffill().dropna()
    if aligned.empty:
        return [0.0] * len(equity_index)
    # Anchor to the first aligned date (the account's inception), so the
    # benchmark curve starts at 0% at inception rather than drifting daily.
    base = float(aligned.iloc[0])
    if base == 0:
        return [0.0] * len(equity_index)
    return ((aligned / base) - 1).round(6).tolist()


def _apply_nav_history(
    account_id: str, broker_account_id: str, equity_series: pd.Series
) -> pd.Series:
    """Overlay the persisted NAV store onto Alpaca's equity history (ADR-0010).

    Completed days already recorded in the store are frozen — their persisted
    value wins over whatever Alpaca currently returns, so a later Alpaca
    history reset cannot rewrite the past. Days not yet recorded are backfilled
    into the store. Today's bar is always left as the live value (it is still
    moving intraday and must never be frozen).

    Returns a Series covering the union of persisted and Alpaca dates, sorted
    oldest → newest, with the same DatetimeIndex shape the rest of this module
    expects.
    """
    # Without a broker account id the rows cannot be attributed, and merging
    # them would risk splicing two accounts' equity — fall back to Alpaca's own
    # history rather than persisting anything.
    if equity_series.empty or not account_id or not broker_account_id:
        return equity_series

    persisted = load_nav(account_id, broker_account_id)  # {date_iso: frozen_equity}
    today = equity_series.index[-1].date().isoformat()

    # Build a merged {date_iso: equity} map: persisted wins, Alpaca backfills.
    merged: dict[str, float] = dict(persisted)
    missing: list[tuple[str, float]] = []
    for ts in equity_series.index:
        date_iso = ts.date().isoformat()
        eq = float(equity_series.loc[ts])
        if date_iso == today:
            merged[date_iso] = eq  # live value for today
        elif date_iso not in merged:
            merged[date_iso] = eq
            missing.append((date_iso, eq))

    if missing:
        record_nav_many(account_id, broker_account_id, missing)

    sorted_dates = sorted(merged.keys())
    return pd.Series([merged[d] for d in sorted_dates], index=pd.to_datetime(sorted_dates))


@router.get("/api/performance", response_model=PerformanceResponse)
def get_performance(request: Request, cfg: Config = Depends(get_config)) -> PerformanceResponse:
    client = get_alpaca(request, cfg)
    if not client:
        return PerformanceResponse(dates=[], portfolio_cumulative=[], benchmark_cumulative=[], sp500_cumulative=[])
    try:
        # Fetch the FULL account history (not a rolling 1M window). A rolling
        # window re-anchors the cumulative curve to "30 days ago" each day,
        # which makes the graph shift every day. `period=all` keeps the anchor
        # pinned to the account's inception so the curve is stable over time.
        history = client.get("/v2/account/portfolio/history?period=all&timeframe=1D")
        timestamps, equities = history.get("timestamp", []), history.get("equity", [])
    except AlpacaError as exc:
        logger.warning("Performance history fetch failed: %s", exc)
        return PerformanceResponse(dates=[], portfolio_cumulative=[], benchmark_cumulative=[], sp500_cumulative=[])

    if not timestamps or not equities:
        return PerformanceResponse(dates=[], portfolio_cumulative=[], benchmark_cumulative=[], sp500_cumulative=[])

    broker_account_id, equity_now = live_account(client)
    dates = [ts_to_date(ts) for ts in timestamps]
    equities_f = [float(e) if e is not None else float("nan") for e in equities]
    dates, equities_f = patch_today(dates, equities_f, equity_now)
    equity_series = pd.Series(equities_f, index=pd.to_datetime(dates)).dropna()
    equity_series = equity_series[equity_series > 0]

    if len(equity_series) < 2:
        return PerformanceResponse(dates=[], portfolio_cumulative=[], benchmark_cumulative=[], sp500_cumulative=[])

    # Persist / overlay the self-owned NAV history so the curve survives an
    # Alpaca history reset (ADR-0010). Keyed per authenticated user *and* per
    # broker account — one user may point at several Alpaca accounts over time,
    # and their equity must never be spliced into a single curve.
    account_id = getattr(request.state, "user_id", None) or "default"
    equity_series = _apply_nav_history(account_id, broker_account_id or "", equity_series)

    port_cumulative = _anchor_cumulative(equity_series)

    start_date = equity_series.index[0].date()
    end_date = equity_series.index[-1].date()

    bench_close = _fetch_benchmark(_BENCH_TICKER, start_date, end_date)
    sp500_close = _fetch_benchmark(_SP500_TICKER, start_date, end_date)

    bench_cumulative = _to_cumulative(bench_close, equity_series.index)
    sp500_cumulative = _to_cumulative(sp500_close, equity_series.index)

    min_len = min(len(port_cumulative), len(bench_cumulative), len(sp500_cumulative))
    return PerformanceResponse(
        dates=[equity_series.index[i].date().isoformat() for i in range(min_len)],
        portfolio_cumulative=port_cumulative[:min_len],
        benchmark_cumulative=bench_cumulative[:min_len],
        sp500_cumulative=sp500_cumulative[:min_len],
    )
