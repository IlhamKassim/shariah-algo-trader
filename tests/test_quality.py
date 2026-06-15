import logging
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

from shariah_algo_trader.factors.quality import compute_quality_factor

DEBT_THRESHOLD = 0.33


def make_ticker_mock(
    net_income: float | None,
    revenue: float | None,
    total_assets: float | None,
    total_debt: float | None,
    equity: float | None,
) -> MagicMock:
    """Build a mock yf.Ticker with financial statement DataFrames."""
    dates = pd.Index(["2024-12-31"])

    income_df = pd.DataFrame(
        {"Net Income": [net_income], "Total Revenue": [revenue]},
        index=dates,
    ).T

    balance_df = pd.DataFrame(
        {
            "Total Assets": [total_assets],
            "Total Debt": [total_debt],
            "Stockholders Equity": [equity],
        },
        index=dates,
    ).T

    mock = MagicMock()
    mock.income_stmt = income_df
    mock.balance_sheet = balance_df
    return mock


def make_ticker_factory(responses: dict[str, MagicMock]):
    return lambda ticker: responses[ticker]


# Fixture financials — values chosen so derived ratios match the domain expectations:
# ROE = net_income / equity, margin = net_income / revenue, d/a = total_debt / total_assets

# AAPL: ROE=0.30, margin=0.25, d/a=0.20 — healthy, high quality
AAPL = dict(net_income=30.0, revenue=120.0, total_assets=1000.0, total_debt=200.0, equity=100.0)

# MSFT: ROE=0.20, margin=0.15, d/a=0.25 — healthy, moderate quality
MSFT = dict(net_income=15.0, revenue=100.0, total_assets=800.0, total_debt=200.0, equity=75.0)

# OVER: d/a=0.34 — over leverage limit, must be excluded
OVER = dict(net_income=50.0, revenue=125.0, total_assets=1000.0, total_debt=340.0, equity=100.0)

# EDGE cases
EDGE_PASS = dict(net_income=10.0, revenue=100.0, total_assets=1000.0, total_debt=330.0, equity=100.0)
EDGE_FAIL = dict(net_income=10.0, revenue=100.0, total_assets=1000.0, total_debt=330.1, equity=100.0)


class TestHardFilter:
    def test_excludes_ticker_exceeding_debt_threshold_with_warning(self, caplog):
        with patch("shariah_algo_trader.factors.quality.yf.Ticker") as mock_cls:
            mock_cls.side_effect = make_ticker_factory({
                "AAPL": make_ticker_mock(**AAPL),
                "OVER": make_ticker_mock(**OVER),
            })

            with caplog.at_level(logging.WARNING):
                result = compute_quality_factor({"AAPL", "OVER"})

        assert "OVER" not in result
        assert "OVER" in caplog.text

    def test_ticker_at_exactly_threshold_survives(self):
        with patch("shariah_algo_trader.factors.quality.yf.Ticker") as mock_cls:
            mock_cls.side_effect = make_ticker_factory({
                "AAPL": make_ticker_mock(**AAPL),
                "EDGE": make_ticker_mock(**EDGE_PASS),
            })

            result = compute_quality_factor({"AAPL", "EDGE"})

        assert "EDGE" in result

    def test_ticker_just_above_threshold_is_excluded(self):
        with patch("shariah_algo_trader.factors.quality.yf.Ticker") as mock_cls:
            mock_cls.side_effect = make_ticker_factory({
                "AAPL": make_ticker_mock(**AAPL),
                "EDGE": make_ticker_mock(**EDGE_FAIL),
            })

            result = compute_quality_factor({"AAPL", "EDGE"})

        assert "EDGE" not in result


class TestQualityScoreComputation:
    def test_zscores_have_mean_zero_std_one(self):
        with patch("shariah_algo_trader.factors.quality.yf.Ticker") as mock_cls:
            mock_cls.side_effect = make_ticker_factory({
                "AAPL": make_ticker_mock(**AAPL),
                "MSFT": make_ticker_mock(**MSFT),
            })

            result = compute_quality_factor({"AAPL", "MSFT"})

        scores = list(result.values())
        mean = sum(scores) / len(scores)
        std = (sum((s - mean) ** 2 for s in scores) / len(scores)) ** 0.5
        assert mean == pytest.approx(0.0, abs=1e-9)
        assert std == pytest.approx(1.0, abs=1e-9)

    def test_higher_quality_fundamentals_yield_higher_z_score(self):
        with patch("shariah_algo_trader.factors.quality.yf.Ticker") as mock_cls:
            mock_cls.side_effect = make_ticker_factory({
                "AAPL": make_ticker_mock(**AAPL),
                "MSFT": make_ticker_mock(**MSFT),
            })

            result = compute_quality_factor({"AAPL", "MSFT"})

        assert result["AAPL"] > result["MSFT"]

    def test_composite_score_formula_is_correct(self):
        high = dict(net_income=40.0, revenue=100.0, total_assets=1000.0, total_debt=100.0, equity=100.0)
        low = dict(net_income=5.0, revenue=100.0, total_assets=1000.0, total_debt=300.0, equity=100.0)

        with patch("shariah_algo_trader.factors.quality.yf.Ticker") as mock_cls:
            mock_cls.side_effect = make_ticker_factory({
                "HIGH": make_ticker_mock(**high),
                "LOW": make_ticker_mock(**low),
            })

            result = compute_quality_factor({"HIGH", "LOW"})

        assert result["HIGH"] > result["LOW"]
        assert result["HIGH"] == pytest.approx(-result["LOW"])


class TestMissingData:
    def test_ticker_missing_fundamentals_is_excluded_with_warning(self, caplog):
        empty_mock = MagicMock()
        empty_mock.income_stmt = pd.DataFrame()
        empty_mock.balance_sheet = pd.DataFrame()

        with patch("shariah_algo_trader.factors.quality.yf.Ticker") as mock_cls:
            mock_cls.side_effect = make_ticker_factory({
                "AAPL": make_ticker_mock(**AAPL),
                "MISS": empty_mock,
            })

            with caplog.at_level(logging.WARNING):
                result = compute_quality_factor({"AAPL", "MISS"})

        assert "MISS" not in result
        assert "MISS" in caplog.text
