"""Benchmark construction and relative performance metrics.

The backtest engine historically reported CAGR, volatility, Sharpe and drawdown
for the strategy alone. Those numbers say what the strategy returned; they
cannot say whether it beat anything. A 14% CAGR is excellent against a
benchmark that returned 8% and unremarkable against one that returned 16%.

This module supplies the missing half: a buy-and-hold curve for a benchmark
ticker over the same dates, and the relative statistics that answer "did the
factor engine add anything the benchmark did not already give us for free?".

The benchmark that matters most here is SPUS itself. Beating SPY while holding
a Shariah-screened subset mostly measures the screen, not the factor engine —
the screen excludes financials and heavily-levered firms, which is a large
active bet on its own. Beating SPUS isolates what the factor scoring actually
contributes on top of the universe it selects from.
"""

from __future__ import annotations

import logging

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

TRADING_DAYS_PER_YEAR = 252


def buy_and_hold_curve(
    prices: pd.DataFrame,
    ticker: str,
    dates: pd.DatetimeIndex,
    initial_capital: float,
) -> pd.Series:
    """Equity curve for putting ``initial_capital`` into ``ticker`` on day one.

    Returns an empty Series when the ticker has no usable price history, so
    callers can report the benchmark as unavailable rather than silently
    comparing against zeros.
    """
    if ticker not in prices.columns:
        logger.warning("Benchmark %s is not in the price data; skipping it", ticker)
        return pd.Series(dtype=float)

    series = prices[ticker].reindex(dates).ffill()
    series = series.dropna()
    if series.empty or float(series.iloc[0]) <= 0:
        logger.warning("Benchmark %s has no usable price on the start date; skipping it", ticker)
        return pd.Series(dtype=float)

    shares = initial_capital / float(series.iloc[0])
    return series * shares


def _annualised_return(equity: pd.Series) -> float:
    days = (equity.index[-1] - equity.index[0]).days
    years = max(days / 365.25, 1e-9)
    growth = float(equity.iloc[-1]) / float(equity.iloc[0])
    if growth <= 0:
        return -1.0
    return growth ** (1.0 / years) - 1.0


def relative_metrics(
    strategy_equity: pd.Series,
    benchmark_equity: pd.Series,
    risk_free_rate: float = 0.0,
) -> dict:
    """Compare a strategy curve against a benchmark curve.

    ``risk_free_rate`` is an annualised decimal (0.04 for 4%). It matters:
    with cash yielding ~4%, a Sharpe computed against 0% flatters every
    strategy, and the flattery grows with volatility.
    """
    strategy = strategy_equity.dropna()
    benchmark = benchmark_equity.dropna()
    if strategy.empty or benchmark.empty:
        return {}

    # Compare only over dates both curves cover.
    common = strategy.index.intersection(benchmark.index)
    if len(common) < 3:
        logger.warning("Strategy and benchmark overlap on %d day(s); too few to compare", len(common))
        return {}

    strategy = strategy.loc[common]
    benchmark = benchmark.loc[common]

    strategy_returns = strategy.pct_change().dropna()
    benchmark_returns = benchmark.pct_change().dropna()
    aligned = pd.concat(
        [strategy_returns, benchmark_returns], axis=1, keys=["strategy", "benchmark"]
    ).dropna()
    if aligned.empty:
        return {}

    strategy_cagr = _annualised_return(strategy)
    benchmark_cagr = _annualised_return(benchmark)

    strategy_daily = aligned["strategy"]
    benchmark_daily = aligned["benchmark"]

    benchmark_variance = float(benchmark_daily.var())
    strategy_variance = float(strategy_daily.var())
    if benchmark_variance > 0:
        covariance = float(strategy_daily.cov(benchmark_daily))
        beta = covariance / benchmark_variance
    else:
        # A benchmark that never moves has no beta to measure against.
        beta = float("nan")

    # corr() divides by each series' standard deviation, so a flat series would
    # emit a divide-by-zero warning on its way to NaN. Say NaN directly instead.
    if benchmark_variance > 0 and strategy_variance > 0:
        correlation = float(strategy_daily.corr(benchmark_daily))
    else:
        correlation = float("nan")

    # CAPM alpha, annualised: the return left over once the benchmark exposure
    # implied by beta is paid for.
    if np.isnan(beta):
        alpha = float("nan")
    else:
        alpha = (strategy_cagr - risk_free_rate) - beta * (benchmark_cagr - risk_free_rate)

    active_daily = strategy_daily - benchmark_daily
    tracking_error = float(active_daily.std()) * np.sqrt(TRADING_DAYS_PER_YEAR)
    excess_cagr = strategy_cagr - benchmark_cagr
    information_ratio = excess_cagr / tracking_error if tracking_error > 0 else float("nan")

    up_days = benchmark_daily > 0
    down_days = benchmark_daily < 0
    up_capture = (
        float(strategy_daily[up_days].mean() / benchmark_daily[up_days].mean())
        if up_days.any() and float(benchmark_daily[up_days].mean()) != 0
        else float("nan")
    )
    down_capture = (
        float(strategy_daily[down_days].mean() / benchmark_daily[down_days].mean())
        if down_days.any() and float(benchmark_daily[down_days].mean()) != 0
        else float("nan")
    )

    return {
        "benchmark_total_return_pct": (float(benchmark.iloc[-1]) / float(benchmark.iloc[0]) - 1.0) * 100.0,
        "benchmark_cagr_pct": benchmark_cagr * 100.0,
        "excess_cagr_pct": excess_cagr * 100.0,
        "alpha_pct": alpha * 100.0,
        "beta": beta,
        "correlation": correlation,
        "tracking_error_pct": tracking_error * 100.0,
        "information_ratio": information_ratio,
        "up_capture": up_capture,
        "down_capture": down_capture,
        "beat_benchmark": bool(excess_cagr > 0),
        "overlap_days": int(len(common)),
    }
