from unittest.mock import patch

import pandas as pd
import numpy as np

from shariah_algo_trader.factors.volatility import (
    compute_inv_vol_weights,
    compute_raw_volatility,
    compute_volatility_factor,
)


class TestComputeVolatilityFactor:
    def test_empty_input_returns_empty(self):
        assert compute_volatility_factor({}) == {}

    def test_lower_volatility_gets_higher_score(self):
        raw = {"LOW_VOL": 0.10, "HIGH_VOL": 0.40}
        result = compute_volatility_factor(raw)
        assert result["LOW_VOL"] > result["HIGH_VOL"]

    def test_single_ticker_returns_zero(self):
        result = compute_volatility_factor({"AAPL": 0.20})
        assert result == {"AAPL": 0.0}

    def test_output_keys_match_input(self):
        raw = {"A": 0.1, "B": 0.2, "C": 0.3}
        result = compute_volatility_factor(raw)
        assert set(result.keys()) == {"A", "B", "C"}


class TestComputeInvVolWeights:
    def test_empty_tickers_returns_empty(self):
        assert compute_inv_vol_weights([], {}) == {}

    def test_weights_sum_to_one(self):
        tickers = ["A", "B", "C"]
        raw_vols = {"A": 0.10, "B": 0.20, "C": 0.30}
        weights = compute_inv_vol_weights(tickers, raw_vols)
        assert abs(sum(weights.values()) - 1.0) < 1e-9

    def test_lower_vol_gets_higher_weight(self):
        tickers = ["LOW", "HIGH"]
        raw_vols = {"LOW": 0.10, "HIGH": 0.40}
        weights = compute_inv_vol_weights(tickers, raw_vols)
        assert weights["LOW"] > weights["HIGH"]

    def test_low_vol_ticker_gets_higher_weight_than_high_vol(self):
        # With 2 tickers, just verify the low-vol one gets the higher share
        tickers = ["LOW", "HIGH"]
        raw_vols = {"LOW": 0.001, "HIGH": 0.50}
        weights = compute_inv_vol_weights(tickers, raw_vols)
        assert weights["LOW"] > weights["HIGH"]

    def test_weights_sum_to_one_after_capping(self):
        tickers = ["A", "B", "C", "D", "E"]
        raw_vols = {"A": 0.001, "B": 0.50, "C": 0.50, "D": 0.50, "E": 0.50}
        weights = compute_inv_vol_weights(tickers, raw_vols)
        assert abs(sum(weights.values()) - 1.0) < 1e-9

    def test_missing_vol_data_uses_average_weight(self):
        tickers = ["KNOWN", "UNKNOWN"]
        raw_vols = {"KNOWN": 0.20}
        weights = compute_inv_vol_weights(tickers, raw_vols)
        # Both should get non-zero weight and they should sum to 1
        assert weights["UNKNOWN"] > 0
        assert abs(sum(weights.values()) - 1.0) < 1e-9

    def test_all_tickers_missing_vol_gives_equal_weights(self):
        tickers = ["A", "B", "C"]
        weights = compute_inv_vol_weights(tickers, {})
        for w in weights.values():
            assert abs(w - 1 / 3) < 1e-9


class TestComputeRawVolatility:
    def _make_prices(self, tickers, n=250):
        dates = pd.date_range("2023-01-01", periods=n, freq="B")
        np.random.seed(42)
        data = {t: np.cumprod(1 + np.random.normal(0, 0.01, n)) * 100 for t in tickers}
        df = pd.DataFrame(data, index=dates)
        df.columns = pd.MultiIndex.from_product([["Close"], df.columns])
        return df

    def test_returns_positive_annualised_volatility(self):
        tickers = {"AAPL", "MSFT"}
        mock_data = self._make_prices(list(tickers))
        with patch("shariah_algo_trader.factors.volatility.yf.download", return_value=mock_data):
            result = compute_raw_volatility(tickers)
        assert set(result.keys()) == tickers
        for v in result.values():
            assert v > 0

    def test_empty_data_returns_empty(self):
        with patch("shariah_algo_trader.factors.volatility.yf.download", return_value=pd.DataFrame()):
            result = compute_raw_volatility({"AAPL"})
        assert result == {}

    def test_ticker_with_insufficient_history_is_excluded(self):
        tickers = {"AAPL", "SHORT"}
        dates = pd.date_range("2024-01-01", periods=10, freq="B")
        short_data = pd.DataFrame(
            [[100.0, 50.0]] * 10,
            columns=pd.MultiIndex.from_tuples([("Close", "AAPL"), ("Close", "SHORT")]),
            index=dates,
        )
        with patch("shariah_algo_trader.factors.volatility.yf.download", return_value=short_data):
            result = compute_raw_volatility(tickers)
        # Both excluded — only 10 rows, well under the 200-price minimum
        assert "SHORT" not in result
        assert "AAPL" not in result
