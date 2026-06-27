from unittest.mock import patch

import numpy as np
import pandas as pd

from shariah_algo_trader.data.regime import is_bull_market


def _make_spy(n=250, above_ma=True):
    """Return a yf.download-shaped DataFrame for SPY (flat columns, single ticker)."""
    dates = pd.date_range("2023-01-01", periods=n, freq="B")
    if above_ma:
        prices = np.linspace(300, 500, n)
    else:
        prices = np.linspace(500, 300, n)
    return pd.DataFrame({"Close": prices}, index=dates)


class TestIsBullMarket:
    def test_returns_true_when_price_above_200d_ma(self):
        with patch("shariah_algo_trader.data.regime.yf.download", return_value=_make_spy(above_ma=True)):
            assert is_bull_market() is True

    def test_returns_false_when_price_below_200d_ma(self):
        with patch("shariah_algo_trader.data.regime.yf.download", return_value=_make_spy(above_ma=False)):
            assert is_bull_market() is False

    def test_defaults_to_true_when_data_is_empty(self):
        with patch("shariah_algo_trader.data.regime.yf.download", return_value=pd.DataFrame()):
            assert is_bull_market() is True

    def test_defaults_to_true_when_insufficient_history(self):
        # Fewer than 200 rows — can't compute 200-day MA
        with patch("shariah_algo_trader.data.regime.yf.download", return_value=_make_spy(n=100)):
            assert is_bull_market() is True

    def test_defaults_to_true_when_fetch_raises(self):
        with patch("shariah_algo_trader.data.regime.yf.download", side_effect=Exception("network error")):
            assert is_bull_market() is True
