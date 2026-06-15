import datetime
import logging
from unittest.mock import patch

import pandas as pd
import pytest

from shariah_algo_trader.factors.momentum import compute_momentum_factor

TODAY = datetime.date.today()


def make_download_result(price_data: dict[str, list[float]]) -> pd.DataFrame:
    """Build a DataFrame mimicking yf.download output with MultiIndex columns.

    Shorter series are right-aligned (NaN-padded at the front) to match how
    yfinance fills missing history for newly-listed tickers.
    """
    n = max(len(v) for v in price_data.values())
    dates = pd.bdate_range(end=str(TODAY), periods=n)
    padded = {
        ticker: ([float("nan")] * (n - len(prices)) + prices)
        for ticker, prices in price_data.items()
    }
    close_df = pd.DataFrame(padded, index=dates)
    close_df.columns = pd.MultiIndex.from_product([["Close"], close_df.columns])
    return close_df


# 400-day price series with known 12-1 month returns.
# oldest price = 100, prices from ~30 bdays ago onward = 150 → return ≈ 0.50
AAPL_PRICES = [100.0] + [110.0] * 369 + [150.0] * 30

# oldest = 200, prices from ~30 bdays ago onward = 220 → return ≈ 0.10
MSFT_PRICES = [200.0] + [210.0] * 369 + [220.0] * 30


class TestMomentumFactor:
    def test_computes_twelve_one_month_return(self):
        with patch("shariah_algo_trader.factors.momentum.yf.download") as mock_dl:
            mock_dl.return_value = make_download_result({"AAPL": AAPL_PRICES})

            result = compute_momentum_factor({"AAPL"})

        assert "AAPL" in result
        assert isinstance(result["AAPL"], float)

    def test_zscores_are_mean_zero_std_one_across_universe(self):
        with patch("shariah_algo_trader.factors.momentum.yf.download") as mock_dl:
            mock_dl.return_value = make_download_result(
                {"AAPL": AAPL_PRICES, "MSFT": MSFT_PRICES}
            )

            result = compute_momentum_factor({"AAPL", "MSFT"})

        scores = list(result.values())
        mean = sum(scores) / len(scores)
        std = (sum((s - mean) ** 2 for s in scores) / len(scores)) ** 0.5
        assert mean == pytest.approx(0.0, abs=1e-9)
        assert std == pytest.approx(1.0, abs=1e-9)

    def test_higher_return_gets_higher_z_score(self):
        with patch("shariah_algo_trader.factors.momentum.yf.download") as mock_dl:
            mock_dl.return_value = make_download_result(
                {"AAPL": AAPL_PRICES, "MSFT": MSFT_PRICES}
            )

            result = compute_momentum_factor({"AAPL", "MSFT"})

        assert result["AAPL"] > result["MSFT"]

    def test_ticker_with_insufficient_history_is_excluded_with_warning(self, caplog):
        short_prices = [100.0, 110.0, 120.0]
        with patch("shariah_algo_trader.factors.momentum.yf.download") as mock_dl:
            mock_dl.return_value = make_download_result(
                {"AAPL": AAPL_PRICES, "TINY": short_prices}
            )

            with caplog.at_level(logging.WARNING):
                result = compute_momentum_factor({"AAPL", "TINY"})

        assert "TINY" not in result
        assert "TINY" in caplog.text

    def test_excluded_ticker_does_not_affect_output_keys(self, caplog):
        short_prices = [100.0, 110.0]
        with patch("shariah_algo_trader.factors.momentum.yf.download") as mock_dl:
            mock_dl.return_value = make_download_result(
                {"AAPL": AAPL_PRICES, "TINY": short_prices}
            )

            with caplog.at_level(logging.WARNING):
                result = compute_momentum_factor({"AAPL", "TINY"})

        assert set(result.keys()) == {"AAPL"}
