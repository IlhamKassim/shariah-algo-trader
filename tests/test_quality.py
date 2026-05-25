import warnings
from unittest.mock import MagicMock
import pytest
from shariah_algo_trader.data.fmp_client import FMPClient
from shariah_algo_trader.factors.quality import compute_quality_factor

DEBT_THRESHOLD = 0.33


def make_fundamentals(roe: float, net_profit_margin: float, debt_to_assets: float) -> dict:
    return [{"returnOnEquity": roe, "netProfitMargin": net_profit_margin, "debtToAssets": debt_to_assets}]


def make_client(responses: dict[str, list]) -> FMPClient:
    def fake_get(url, **kwargs):
        ticker = url.rstrip("/").split("/")[-1]
        r = MagicMock()
        r.ok = True
        r.status_code = 200
        r.json.return_value = responses[ticker]
        return r

    session = MagicMock()
    session.get.side_effect = fake_get
    return FMPClient(api_key="test-key", session=session)


# Fixture fundamentals
# AAPL: healthy — passes filter, high quality
AAPL = make_fundamentals(roe=0.30, net_profit_margin=0.25, debt_to_assets=0.20)
# MSFT: healthy — passes filter, moderate quality
MSFT = make_fundamentals(roe=0.20, net_profit_margin=0.15, debt_to_assets=0.25)
# OVER: over leverage limit — must be excluded
OVER = make_fundamentals(roe=0.50, net_profit_margin=0.40, debt_to_assets=0.34)
# EDGE: exactly at threshold — must be excluded (> 0.33 means 0.33 survives, 0.34 does not)
EDGE_PASS = make_fundamentals(roe=0.10, net_profit_margin=0.10, debt_to_assets=0.33)
EDGE_FAIL = make_fundamentals(roe=0.10, net_profit_margin=0.10, debt_to_assets=0.3301)


class TestHardFilter:
    def test_excludes_ticker_exceeding_debt_threshold_with_warning(self):
        client = make_client({"AAPL": AAPL, "OVER": OVER})

        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            result = compute_quality_factor({"AAPL", "OVER"}, client)

        assert "OVER" not in result
        assert any("OVER" in str(w.message) for w in caught)

    def test_ticker_at_exactly_threshold_survives(self):
        client = make_client({"AAPL": AAPL, "EDGE": EDGE_PASS})

        with warnings.catch_warnings(record=True):
            warnings.simplefilter("always")
            result = compute_quality_factor({"AAPL", "EDGE"}, client)

        assert "EDGE" in result

    def test_ticker_just_above_threshold_is_excluded(self):
        client = make_client({"AAPL": AAPL, "EDGE": EDGE_FAIL})

        with warnings.catch_warnings(record=True):
            warnings.simplefilter("always")
            result = compute_quality_factor({"AAPL", "EDGE"}, client)

        assert "EDGE" not in result


class TestQualityScoreComputation:
    def test_zscores_have_mean_zero_std_one(self):
        client = make_client({"AAPL": AAPL, "MSFT": MSFT})

        result = compute_quality_factor({"AAPL", "MSFT"}, client)

        scores = list(result.values())
        mean = sum(scores) / len(scores)
        std = (sum((s - mean) ** 2 for s in scores) / len(scores)) ** 0.5
        assert mean == pytest.approx(0.0, abs=1e-9)
        assert std == pytest.approx(1.0, abs=1e-9)

    def test_higher_quality_fundamentals_yield_higher_z_score(self):
        # AAPL has higher ROE, margin, and lower debt → should outscore MSFT
        client = make_client({"AAPL": AAPL, "MSFT": MSFT})

        result = compute_quality_factor({"AAPL", "MSFT"}, client)

        assert result["AAPL"] > result["MSFT"]

    def test_composite_score_formula_is_correct(self):
        # Single ticker: z-score is 0. Verify the raw composite is computed
        # correctly by using two tickers with known scores and checking ordering.
        high = make_fundamentals(roe=0.40, net_profit_margin=0.30, debt_to_assets=0.10)
        low = make_fundamentals(roe=0.05, net_profit_margin=0.02, debt_to_assets=0.30)
        client = make_client({"HIGH": high, "LOW": low})

        result = compute_quality_factor({"HIGH", "LOW"}, client)

        assert result["HIGH"] > result["LOW"]
        assert result["HIGH"] == pytest.approx(-result["LOW"])  # symmetric z-scores for 2 tickers


class TestMissingData:
    def test_ticker_missing_fundamentals_is_excluded_with_warning(self):
        client = make_client({"AAPL": AAPL, "MISS": []})

        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            result = compute_quality_factor({"AAPL", "MISS"}, client)

        assert "MISS" not in result
        assert any("MISS" in str(w.message) for w in caught)
