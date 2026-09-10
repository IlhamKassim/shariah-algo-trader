"""Tests for benchmark construction and relative performance metrics."""

import numpy as np
import pandas as pd
import pytest

from shariah_algo_trader.backtesting import benchmarks


def _dates(n: int) -> pd.DatetimeIndex:
    return pd.bdate_range("2024-01-01", periods=n)


def _prices(**series) -> pd.DataFrame:
    length = len(next(iter(series.values())))
    return pd.DataFrame(series, index=_dates(length))


# ---------------------------------------------------------------------------
# Buy and hold
# ---------------------------------------------------------------------------


def test_buy_and_hold_scales_to_initial_capital():
    prices = _prices(SPY=[100.0, 110.0, 121.0])
    curve = benchmarks.buy_and_hold_curve(prices, "SPY", _dates(3), 10_000.0)
    assert curve.iloc[0] == pytest.approx(10_000.0)
    assert curve.iloc[1] == pytest.approx(11_000.0)
    assert curve.iloc[2] == pytest.approx(12_100.0)


def test_buy_and_hold_forward_fills_missing_days():
    prices = _prices(SPY=[100.0, np.nan, 120.0])
    curve = benchmarks.buy_and_hold_curve(prices, "SPY", _dates(3), 1_000.0)
    assert curve.iloc[1] == pytest.approx(1_000.0)
    assert curve.iloc[2] == pytest.approx(1_200.0)


def test_unknown_benchmark_returns_empty_not_zeros():
    """A missing benchmark must be reportable as absent, never as a 0% return."""
    prices = _prices(SPY=[100.0, 110.0])
    assert benchmarks.buy_and_hold_curve(prices, "NOPE", _dates(2), 1_000.0).empty


def test_benchmark_with_no_price_on_start_date_is_skipped():
    prices = _prices(SPY=[np.nan, np.nan])
    assert benchmarks.buy_and_hold_curve(prices, "SPY", _dates(2), 1_000.0).empty


# ---------------------------------------------------------------------------
# Relative metrics
# ---------------------------------------------------------------------------


def _curve(values) -> pd.Series:
    return pd.Series(values, index=_dates(len(values)), dtype=float)


def test_identical_curves_have_beta_one_and_no_excess():
    curve = _curve([100.0 * (1.01 ** i) for i in range(120)])
    result = benchmarks.relative_metrics(curve, curve.copy())
    assert result["beta"] == pytest.approx(1.0)
    assert result["correlation"] == pytest.approx(1.0)
    assert result["excess_cagr_pct"] == pytest.approx(0.0, abs=1e-6)
    assert result["alpha_pct"] == pytest.approx(0.0, abs=1e-6)
    assert result["tracking_error_pct"] == pytest.approx(0.0, abs=1e-9)
    assert result["beat_benchmark"] is False


def test_double_leverage_gives_beta_two():
    benchmark_returns = np.random.default_rng(7).normal(0.0005, 0.01, 250)
    benchmark = _curve(100.0 * np.cumprod(1 + benchmark_returns))
    strategy = _curve(100.0 * np.cumprod(1 + 2 * benchmark_returns))
    result = benchmarks.relative_metrics(strategy, benchmark)
    assert result["beta"] == pytest.approx(2.0, rel=0.05)
    assert result["correlation"] == pytest.approx(1.0, abs=0.01)


def test_strategy_beating_benchmark_is_reported_as_such():
    benchmark = _curve([100.0 * (1.0002 ** i) for i in range(250)])
    strategy = _curve([100.0 * (1.0006 ** i) for i in range(250)])
    result = benchmarks.relative_metrics(strategy, benchmark)
    assert result["beat_benchmark"] is True
    assert result["excess_cagr_pct"] > 0
    assert result["information_ratio"] > 0


def test_strategy_losing_to_benchmark_is_reported_as_such():
    benchmark = _curve([100.0 * (1.0006 ** i) for i in range(250)])
    strategy = _curve([100.0 * (1.0002 ** i) for i in range(250)])
    result = benchmarks.relative_metrics(strategy, benchmark)
    assert result["beat_benchmark"] is False
    assert result["excess_cagr_pct"] < 0


@pytest.mark.parametrize("leverage,expect_higher_alpha_with_rf", [(1.5, True), (0.5, False)])
def test_risk_free_rate_shifts_alpha_by_beta(leverage, expect_higher_alpha_with_rf):
    """CAPM alpha is (Rs - rf) - beta * (Rb - rf), i.e. it carries rf * (beta - 1).

    So raising the risk-free rate lifts alpha for a high-beta strategy and cuts
    it for a low-beta one. Leaving rf at 0 hides that adjustment entirely.
    """
    benchmark_returns = np.random.default_rng(11).normal(0.0006, 0.01, 250)
    benchmark = _curve(100.0 * np.cumprod(1 + benchmark_returns))
    strategy = _curve(100.0 * np.cumprod(1 + leverage * benchmark_returns))

    result_zero = benchmarks.relative_metrics(strategy, benchmark, risk_free_rate=0.0)
    result_real = benchmarks.relative_metrics(strategy, benchmark, risk_free_rate=0.04)

    assert result_zero["beta"] == pytest.approx(leverage, rel=0.05)
    if expect_higher_alpha_with_rf:
        assert result_real["alpha_pct"] > result_zero["alpha_pct"]
    else:
        assert result_real["alpha_pct"] < result_zero["alpha_pct"]

    # The shift is exactly rf * (beta - 1), in percentage points.
    expected_shift = 0.04 * (result_zero["beta"] - 1.0) * 100.0
    assert result_real["alpha_pct"] - result_zero["alpha_pct"] == pytest.approx(expected_shift, rel=1e-6)


def test_sharpe_style_zero_rf_is_the_default():
    """Default behaviour is unchanged: rf defaults to 0."""
    benchmark = _curve([100.0 * (1.0004 ** i) for i in range(120)])
    strategy = _curve([100.0 * (1.0007 ** i) for i in range(120)])
    assert (
        benchmarks.relative_metrics(strategy, benchmark)["alpha_pct"]
        == benchmarks.relative_metrics(strategy, benchmark, risk_free_rate=0.0)["alpha_pct"]
    )


def test_metrics_align_on_overlapping_dates_only():
    strategy = pd.Series([100.0, 101.0, 102.0, 103.0], index=_dates(4))
    benchmark = pd.Series([100.0, 101.0, 102.0], index=_dates(3))
    result = benchmarks.relative_metrics(strategy, benchmark)
    assert result["overlap_days"] == 3


def test_insufficient_overlap_returns_empty():
    strategy = pd.Series([100.0, 101.0], index=_dates(2))
    benchmark = pd.Series([100.0], index=_dates(1))
    assert benchmarks.relative_metrics(strategy, benchmark) == {}


def test_empty_inputs_return_empty():
    assert benchmarks.relative_metrics(pd.Series(dtype=float), _curve([1.0, 2.0])) == {}
    assert benchmarks.relative_metrics(_curve([1.0, 2.0]), pd.Series(dtype=float)) == {}


def test_flat_benchmark_yields_nan_beta_not_a_crash():
    benchmark = _curve([100.0] * 50)
    strategy = _curve([100.0 * (1.001 ** i) for i in range(50)])
    result = benchmarks.relative_metrics(strategy, benchmark)
    assert np.isnan(result["beta"])
    assert np.isnan(result["alpha_pct"])
    assert result["excess_cagr_pct"] > 0


def test_capture_ratios_reported():
    benchmark_returns = np.random.default_rng(3).normal(0.0, 0.01, 300)
    benchmark = _curve(100.0 * np.cumprod(1 + benchmark_returns))
    strategy = _curve(100.0 * np.cumprod(1 + 0.5 * benchmark_returns))
    result = benchmarks.relative_metrics(strategy, benchmark)
    assert result["up_capture"] == pytest.approx(0.5, rel=0.1)
    assert result["down_capture"] == pytest.approx(0.5, rel=0.1)
