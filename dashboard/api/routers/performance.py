import datetime
import logging
import os
import time

import pandas as pd
import yfinance as yf
from fastapi import APIRouter, Depends

from dashboard.api.deps import get_alpaca
from dashboard.api.live_equity import live_equity, patch_today
from dashboard.api.models import PerformanceResponse
from shariah_algo_trader.execution.alpaca_client import AlpacaClient, AlpacaError

router = APIRouter()
logger = logging.getLogger(__name__)

_BENCH_TICKER = os.environ.get("BENCHMARK_TICKER", "SPUS")
_SP500_TICKER = os.environ.get("SP500_TICKER", "SPY")
_BENCH_CACHE_TTL = 3600   # 1 hour — benchmark data is daily
_HISTORY_CACHE_TTL = 300  # 5 minutes — equity updates intraday

# Cache: (ticker, start_date_iso, end_date_iso) → (monotonic_time_fetched, pd.Series)
_bench_cache: dict[tuple[str, str, str], tuple[float, pd.Series]] = {}
# Cache: (monotonic_time_fetched, (timestamps, equities)) | None
_history_cache: tuple[float, tuple[list, list]] | None = None


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
    returns = aligned.pct_change().fillna(0)
    return ((1 + returns).cumprod() - 1).round(6).tolist()


def _fetch_history(client: AlpacaClient) -> tuple[list, list]:
    global _history_cache
    if _history_cache is not None:
        fetched_at, payload = _history_cache
        if time.monotonic() - fetched_at < _HISTORY_CACHE_TTL:
            return payload
    history = client.get("/v2/account/portfolio/history?period=1M&timeframe=1D")
    payload = (history.get("timestamp", []), history.get("equity", []))
    _history_cache = (time.monotonic(), payload)
    return payload


@router.get("/api/performance", response_model=PerformanceResponse)
def get_performance(client: AlpacaClient = Depends(get_alpaca)) -> PerformanceResponse:
    try:
        timestamps, equities = _fetch_history(client)
    except AlpacaError as exc:
        logger.warning("Performance history fetch failed: %s", exc)
        return PerformanceResponse(dates=[], portfolio_cumulative=[], benchmark_cumulative=[], sp500_cumulative=[])

    if not timestamps or not equities:
        return PerformanceResponse(dates=[], portfolio_cumulative=[], benchmark_cumulative=[], sp500_cumulative=[])

    dates = [datetime.date.fromtimestamp(ts).isoformat() for ts in timestamps]
    equities_f = [float(e) if e is not None else float("nan") for e in equities]
    dates, equities_f = patch_today(dates, equities_f, live_equity(client))
    equity_series = pd.Series(equities_f, index=pd.to_datetime(dates)).dropna()
    equity_series = equity_series[equity_series > 0]

    if len(equity_series) < 2:
        return PerformanceResponse(dates=[], portfolio_cumulative=[], benchmark_cumulative=[], sp500_cumulative=[])

    port_returns = equity_series.pct_change().fillna(0)
    port_cumulative = ((1 + port_returns).cumprod() - 1).round(6).tolist()

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
