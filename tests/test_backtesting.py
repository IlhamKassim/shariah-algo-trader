"""Engine-level backtest tests.

N-PORT parsing is covered in test_nport.py; benchmark maths in test_benchmarks.py.
"""

import pytest
import pandas as pd
import numpy as np
from shariah_algo_trader.backtesting.engine import z_scores, BacktestEngine, DEFAULT_BENCHMARKS


UNIVERSE_HISTORY = {
    "2024-08-31": ["AAPL", "MSFT"],
    "2024-11-30": ["AAPL", "NVDA"],
    "2025-02-28": ["NVDA", "AVGO"],
}


def _engine(**kwargs) -> BacktestEngine:
    return BacktestEngine(data_provider=None, **kwargs)


# ---------------------------------------------------------------------------
# Point-in-time universe selection
# ---------------------------------------------------------------------------


def test_uses_most_recent_snapshot_on_or_before_the_date():
    engine = _engine()
    assert engine._get_active_universe("2024-12-15", UNIVERSE_HISTORY) == ["AAPL", "NVDA"]


def test_uses_a_snapshot_dated_exactly_today():
    engine = _engine()
    assert engine._get_active_universe("2024-11-30", UNIVERSE_HISTORY) == ["AAPL", "NVDA"]


def test_never_borrows_a_future_snapshot():
    """Regression guard against look-ahead bias.

    An earlier version fell back to the *earliest* snapshot when no snapshot
    preceded the date, which leaks future universe membership into the past —
    the exact bias the N-PORT history exists to remove. The honest answer for a
    date before any snapshot is an empty universe.
    """
    engine = _engine()
    assert engine._get_active_universe("2024-01-01", UNIVERSE_HISTORY) == []


def test_empty_history_yields_empty_universe():
    engine = _engine()
    assert engine._get_active_universe("2025-01-01", {}) == []


def test_does_not_carry_forward_across_the_latest_snapshot_incorrectly():
    engine = _engine()
    assert engine._get_active_universe("2026-01-01", UNIVERSE_HISTORY) == ["NVDA", "AVGO"]


# ---------------------------------------------------------------------------
# Benchmarks
# ---------------------------------------------------------------------------


def test_default_benchmarks_include_the_screened_universe():
    """SPY alone measures the Shariah Screen as much as the factor engine."""
    assert "SPUS" in DEFAULT_BENCHMARKS
    assert "SPY" in DEFAULT_BENCHMARKS


def test_run_benchmarks_skips_tickers_with_no_price_data():
    engine = _engine()
    dates = pd.date_range("2024-01-01", periods=30, freq="B")
    equity = pd.Series([100.0 * (1.001 ** i) for i in range(30)], index=dates)
    prices = pd.DataFrame({"SPY": [50.0 * (1.0005 ** i) for i in range(30)]}, index=dates)

    results = engine._run_benchmarks(["SPY", "MISSING"], prices, equity, {})
    assert set(results) == {"SPY"}
    assert results["SPY"]["relative"]["overlap_days"] == 30


def test_run_benchmarks_reports_beating_the_benchmark():
    engine = _engine(initial_capital=1000.0)
    dates = pd.date_range("2024-01-01", periods=250, freq="B")
    equity = pd.Series([1000.0 * (1.0008 ** i) for i in range(250)], index=dates)
    prices = pd.DataFrame({"SPY": [400.0 * (1.0002 ** i) for i in range(250)]}, index=dates)

    results = engine._run_benchmarks(["SPY"], prices, equity, {})
    assert results["SPY"]["relative"]["beat_benchmark"] is True
    assert results["SPY"]["metrics"]["cagr_pct"] > 0


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------


def test_z_scores():
    raw = {"A": 1.0, "B": 2.0, "C": 3.0}
    res = z_scores(raw)
    assert len(res) == 3
    # Check mean is approx 0
    vals = list(res.values())
    assert np.mean(vals) == pytest.approx(0.0, abs=1e-9)
    # Check standard deviation is 1
    assert np.std(vals) == pytest.approx(1.0)

def test_z_scores_constant():
    raw = {"A": 5.0, "B": 5.0}
    res = z_scores(raw)
    assert res == {"A": 0.0, "B": 0.0}

def test_calculate_metrics():
    # Simple upward trending series
    dates = pd.date_range("2024-01-01", periods=10, freq="D")
    equity = pd.Series([100.0 + i for i in range(10)], index=dates)
    
    engine = BacktestEngine(data_provider=None)
    metrics = engine._calculate_metrics(equity)
    
    assert metrics["total_return_pct"] == pytest.approx(9.0)
    assert metrics["win_rate_pct"] == 100.0  # Daily increase every day
    assert metrics["max_drawdown_pct"] == 0.0  # No drawdowns


def test_sharpe_defaults_to_zero_risk_free_rate():
    dates = pd.date_range("2024-01-01", periods=260, freq="B")
    equity = pd.Series([100.0 * (1.0005 ** i) for i in range(260)], index=dates)

    engine = _engine()
    assert engine.risk_free_rate == 0.0
    metrics = engine._calculate_metrics(equity)
    assert metrics["sharpe_ratio"] == pytest.approx(
        metrics["cagr_pct"] / 100.0 / (metrics["annualised_vol_pct"] / 100.0)
    )


def test_risk_free_rate_lowers_sharpe():
    """A Sharpe measured against 0% flatters every strategy while cash yields more."""
    dates = pd.date_range("2024-01-01", periods=260, freq="B")
    returns = np.random.default_rng(5).normal(0.0006, 0.008, 260)
    equity = pd.Series(100.0 * np.cumprod(1 + returns), index=dates)

    sharpe_zero = _engine()._calculate_metrics(equity)["sharpe_ratio"]
    sharpe_real = _engine(risk_free_rate=0.04)._calculate_metrics(equity)["sharpe_ratio"]
    assert sharpe_real < sharpe_zero


def test_calculate_metrics_accepts_an_explicit_override():
    dates = pd.date_range("2024-01-01", periods=260, freq="B")
    equity = pd.Series([100.0 * (1.0005 ** i) for i in range(260)], index=dates)

    engine = _engine(risk_free_rate=0.04)
    assert (
        engine._calculate_metrics(equity, risk_free_rate=0.0)["sharpe_ratio"]
        > engine._calculate_metrics(equity)["sharpe_ratio"]
    )


# ---------------------------------------------------------------------------
# End-to-end run(), with stubbed data
# ---------------------------------------------------------------------------


class _StubProvider:
    """Serves a fixed price frame, standing in for yfinance/FMP."""

    def __init__(self, prices: pd.DataFrame):
        self.fmp_api_key = ""
        self._prices = prices

    def get_historical_prices(self, tickers, start_date, end_date):
        available = [t for t in tickers if t in self._prices.columns]
        return self._prices[available]

    def get_fundamentals(self, ticker):
        # No fundamentals: Quality and Value fall back to flat scores, exactly
        # as they do in a real run without an FMP key.
        return [], []


def _price_frame(days: int = 500) -> pd.DataFrame:
    """Trending series long enough to satisfy the 200-day factor lookback."""
    dates = pd.date_range("2023-01-02", periods=days, freq="B")
    rng = np.random.default_rng(42)
    frame = {}
    for i, ticker in enumerate(["AAA", "BBB", "SPY"]):
        drift = 0.0004 + i * 0.0001
        returns = rng.normal(drift, 0.009, days)
        frame[ticker] = 100.0 * np.cumprod(1 + returns)
    return pd.DataFrame(frame, index=dates)


def _run_with(monkeypatch, universe, prices, **kwargs):
    from shariah_algo_trader.backtesting import nport

    monkeypatch.setattr(nport, "load_universe_history", lambda *a, **k: universe)
    monkeypatch.setattr(nport, "coverage", lambda *a, **k: {"snapshots": len(universe)})
    engine = BacktestEngine(data_provider=_StubProvider(prices), initial_capital=100_000.0)
    return engine.run(start_date="2024-01-02", end_date="2024-06-28", **kwargs)


def test_run_produces_an_equity_curve_and_benchmark_comparison(monkeypatch):
    result = _run_with(
        monkeypatch,
        {"2023-12-01": ["AAA", "BBB"]},
        _price_frame(),
        top_n=2,
        benchmarks=["SPY"],
    )
    assert result["daily_equity"]
    assert result["rebalance_log"]
    assert "SPY" in result["benchmarks"]
    assert result["benchmarks"]["SPY"]["relative"]["overlap_days"] > 100


def test_run_accounts_for_universe_tickers_with_no_price_history(monkeypatch):
    """Delisted names absent from the price feed must be counted, not dropped."""
    result = _run_with(
        monkeypatch,
        {"2023-12-01": ["AAA", "BBB", "DELISTED"]},
        _price_frame(),
        top_n=2,
        benchmarks=["SPY"],
    )
    coverage = result["price_coverage"]
    assert coverage["universe_tickers"] == 3
    assert coverage["priced_tickers"] == 2
    assert coverage["missing_tickers"] == ["DELISTED"]


def test_run_keeps_benchmarks_out_of_the_investable_universe(monkeypatch):
    """SPY is a measuring stick; it must never be bought as a holding."""
    result = _run_with(
        monkeypatch,
        {"2023-12-01": ["AAA", "BBB", "SPY"]},
        _price_frame(),
        top_n=3,
        benchmarks=["SPY"],
    )
    held = {t for entry in result["rebalance_log"] for t in entry["holdings"]}
    assert "SPY" not in held
    assert result["price_coverage"]["priced_tickers"] == 2


def test_run_refuses_without_a_universe_history(monkeypatch):
    assert _run_with(monkeypatch, {}, _price_frame(), top_n=2, benchmarks=[]) == {}


def test_run_refuses_to_start_before_the_first_snapshot(monkeypatch):
    """Guards against silently backtesting dates with no knowable universe."""
    assert _run_with(
        monkeypatch, {"2025-01-01": ["AAA", "BBB"]}, _price_frame(), top_n=2, benchmarks=[]
    ) == {}
