import pytest
import requests
from unittest.mock import MagicMock, patch

from shariah_algo_trader.data.universe import fetch_eligible_universe, UniverseError

HOLDINGS_CSV = """\
Date,Account,StockTicker,CUSIP,SecurityName,Shares,Price,MarketValue,Weightings
06/15/2026,SPUS,AAPL,037833100,Apple Inc,1000,200.00,200000.00,5.00%
06/15/2026,SPUS,MSFT,594918104,Microsoft Corp,900,390.00,351000.00,4.80%
06/15/2026,SPUS,AMZN,023135106,Amazon.com Inc,800,210.00,168000.00,3.10%
"""

EMPTY_CSV = "Date,Account,StockTicker,CUSIP,SecurityName,Shares,Price,MarketValue,Weightings\n"


def make_response(text: str, status_code: int = 200) -> MagicMock:
    resp = MagicMock()
    resp.text = text
    resp.status_code = status_code
    if status_code >= 400:
        resp.raise_for_status.side_effect = requests.HTTPError(f"{status_code}")
    else:
        resp.raise_for_status.return_value = None
    return resp


class TestFetchEligibleUniverse:
    def test_returns_set_of_tickers_from_well_formed_csv(self):
        with patch("shariah_algo_trader.data.universe.requests.get") as mock_get:
            mock_get.return_value = make_response(HOLDINGS_CSV)

            result = fetch_eligible_universe("SPUS")

        assert result == {"AAPL", "MSFT", "AMZN"}

    def test_raises_for_unsupported_etf(self):
        with pytest.raises(UniverseError, match="No holdings source"):
            fetch_eligible_universe("UNKNOWN")

    def test_raises_on_http_error(self):
        with patch("shariah_algo_trader.data.universe.requests.get") as mock_get:
            mock_get.return_value = make_response("", status_code=403)

            with pytest.raises(UniverseError):
                fetch_eligible_universe("SPUS")

    def test_raises_on_network_error(self):
        with patch("shariah_algo_trader.data.universe.requests.get") as mock_get:
            mock_get.side_effect = requests.ConnectionError("timeout")

            with pytest.raises(UniverseError):
                fetch_eligible_universe("SPUS")

    def test_raises_on_empty_holdings(self):
        with patch("shariah_algo_trader.data.universe.requests.get") as mock_get:
            mock_get.return_value = make_response(EMPTY_CSV)

            with pytest.raises(UniverseError, match="no holdings"):
                fetch_eligible_universe("SPUS")
