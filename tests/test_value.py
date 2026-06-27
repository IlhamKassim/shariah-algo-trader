from unittest.mock import MagicMock, patch

from shariah_algo_trader.factors.value import compute_value_factor


def _mock_ticker(fcf=None, mktcap=None):
    ticker = MagicMock()
    ticker.info = {}
    if fcf is not None:
        ticker.info["freeCashflow"] = fcf
    if mktcap is not None:
        ticker.info["marketCap"] = mktcap
    return ticker


def _patched_value(tickers_info: dict):
    """Run compute_value_factor with yf.Ticker mocked per symbol."""
    def _ticker_factory(symbol):
        return tickers_info.get(symbol, _mock_ticker())

    with patch("shariah_algo_trader.factors.value.yf.Ticker", side_effect=_ticker_factory):
        return compute_value_factor(set(tickers_info.keys()))


class TestComputeValueFactor:
    def test_empty_universe_returns_empty(self):
        with patch("shariah_algo_trader.factors.value.yf.Ticker"):
            result = compute_value_factor(set())
        assert result == {}

    def test_higher_fcf_yield_gets_higher_score(self):
        result = _patched_value({
            "CHEAP": _mock_ticker(fcf=100, mktcap=500),    # FCF yield = 20%
            "EXPENSIVE": _mock_ticker(fcf=10, mktcap=500), # FCF yield = 2%
        })
        assert result["CHEAP"] > result["EXPENSIVE"]

    def test_ticker_with_missing_fcf_is_excluded(self):
        result = _patched_value({
            "VALID": _mock_ticker(fcf=100, mktcap=1000),
            "NO_FCF": _mock_ticker(fcf=None, mktcap=1000),
        })
        assert "NO_FCF" not in result
        assert "VALID" in result

    def test_ticker_with_missing_mktcap_is_excluded(self):
        result = _patched_value({
            "VALID": _mock_ticker(fcf=100, mktcap=1000),
            "NO_CAP": _mock_ticker(fcf=100, mktcap=None),
        })
        assert "NO_CAP" not in result

    def test_ticker_with_negative_fcf_is_excluded(self):
        result = _patched_value({
            "VALID": _mock_ticker(fcf=100, mktcap=1000),
            "NEG_FCF": _mock_ticker(fcf=-50, mktcap=1000),
        })
        assert "NEG_FCF" not in result

    def test_ticker_with_zero_mktcap_is_excluded(self):
        result = _patched_value({
            "VALID": _mock_ticker(fcf=100, mktcap=1000),
            "ZERO_CAP": _mock_ticker(fcf=100, mktcap=0),
        })
        assert "ZERO_CAP" not in result

    def test_fetch_exception_excludes_ticker(self):
        def _ticker_factory(symbol):
            if symbol == "BAD":
                t = MagicMock()
                type(t).info = property(lambda self: (_ for _ in ()).throw(Exception("timeout")))
                return t
            return _mock_ticker(fcf=100, mktcap=1000)

        with patch("shariah_algo_trader.factors.value.yf.Ticker", side_effect=_ticker_factory):
            result = compute_value_factor({"GOOD", "BAD"})

        assert "BAD" not in result
        assert "GOOD" in result

    def test_all_excluded_returns_empty(self):
        result = _patched_value({
            "A": _mock_ticker(fcf=None, mktcap=1000),
            "B": _mock_ticker(fcf=-10, mktcap=1000),
        })
        assert result == {}
