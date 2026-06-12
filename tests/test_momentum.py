import datetime
import logging
from unittest.mock import MagicMock
import pytest
from shariah_algo_trader.data.fmp_client import FMPClient
from shariah_algo_trader.factors.momentum import compute_momentum_factor

TODAY = datetime.date.today()


def make_price_series(prices: list[float], end_date: datetime.date = TODAY) -> dict:
    """Build a fake FMP historical-price-full response.

    prices[0] is the oldest close; prices[-1] is the most recent close.
    Dates are assigned going backwards from end_date, one calendar day each
    (tests don't rely on exact trading-day spacing).
    """
    historical = []
    for i, close in enumerate(reversed(prices)):
        date = end_date - datetime.timedelta(days=i)
        historical.append({"date": str(date), "close": close})
    return {"historical": historical}


def _one_month_ago() -> datetime.date:
    return TODAY - datetime.timedelta(days=30)


def make_client(responses: dict[str, dict]) -> FMPClient:
    """FMPClient backed by a mock session; responses keyed by ticker."""
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


# Build a 400-day price series where we know the exact 12-1 return.
# oldest price (day 0)  = 100.0  → the "13 months ago" anchor
# price at day 370 (≥ 30 days before end of 400-day series) = 150.0
# → 12-1 return for AAPL = 150/100 - 1 = 0.50
AAPL_PRICES = [100.0] + [110.0] * 369 + [150.0] * 30  # 400 prices

# MSFT: oldest = 200, price ~1 month ago = 220 → return = 0.10
MSFT_PRICES = [200.0] + [210.0] * 369 + [220.0] * 30


class TestMomentumFactor:
    def test_computes_correct_twelve_one_month_return(self):
        client = make_client({"AAPL": make_price_series(AAPL_PRICES)})

        result = compute_momentum_factor({"AAPL"}, client)

        # Single-ticker universe: z-score of a lone value is 0.0
        assert "AAPL" in result
        assert isinstance(result["AAPL"], float)

    def test_zscores_are_mean_zero_std_one_across_universe(self):
        client = make_client({
            "AAPL": make_price_series(AAPL_PRICES),
            "MSFT": make_price_series(MSFT_PRICES),
        })

        result = compute_momentum_factor({"AAPL", "MSFT"}, client)

        scores = list(result.values())
        mean = sum(scores) / len(scores)
        std = (sum((s - mean) ** 2 for s in scores) / len(scores)) ** 0.5
        assert mean == pytest.approx(0.0, abs=1e-9)
        assert std == pytest.approx(1.0, abs=1e-9)

    def test_higher_return_gets_higher_z_score(self):
        # AAPL return (0.50) > MSFT return (0.10) so AAPL z-score > MSFT z-score
        client = make_client({
            "AAPL": make_price_series(AAPL_PRICES),
            "MSFT": make_price_series(MSFT_PRICES),
        })

        result = compute_momentum_factor({"AAPL", "MSFT"}, client)

        assert result["AAPL"] > result["MSFT"]

    def test_ticker_with_insufficient_history_is_excluded_with_warning(self, caplog):
        short_prices = [100.0, 110.0, 120.0]  # far too few data points
        client = make_client({
            "AAPL": make_price_series(AAPL_PRICES),
            "TINY": make_price_series(short_prices),
        })

        with caplog.at_level(logging.WARNING):
            result = compute_momentum_factor({"AAPL", "TINY"}, client)

        assert "TINY" not in result
        assert "TINY" in caplog.text

    def test_excluded_ticker_does_not_affect_output_keys(self, caplog):
        short_prices = [100.0, 110.0]
        client = make_client({
            "AAPL": make_price_series(AAPL_PRICES),
            "TINY": make_price_series(short_prices),
        })

        with caplog.at_level(logging.WARNING):
            result = compute_momentum_factor({"AAPL", "TINY"}, client)

        assert set(result.keys()) == {"AAPL"}
