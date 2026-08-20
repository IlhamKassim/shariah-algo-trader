import pytest
import requests
from unittest.mock import MagicMock, patch

from shariah_algo_trader.data.universe import (
    _ETF_CONFIG,
    _is_us_listed,
    fetch_combined_universe,
    fetch_eligible_universe,
    UniverseError,
)

HOLDINGS_CSV = """\
Date,Account,StockTicker,CUSIP,SecurityName,Shares,Price,MarketValue,Weightings
06/15/2026,SPUS,AAPL,037833100,Apple Inc,1000,200.00,200000.00,5.00%
06/15/2026,SPUS,MSFT,594918104,Microsoft Corp,900,390.00,351000.00,4.80%
06/15/2026,SPUS,AMZN,023135106,Amazon.com Inc,800,210.00,168000.00,3.10%
"""

OTHER_CSV = """\
Date,Account,StockTicker,CUSIP,SecurityName,Shares,Price,MarketValue,Weightings
06/15/2026,HLAL,AAPL,037833100,Apple Inc,500,200.00,100000.00,4.00%
06/15/2026,HLAL,GOOGL,02079K305,Alphabet Inc,300,150.00,45000.00,2.00%
"""

FOREIGN_MIX_CSV = """\
Date,Account,StockTicker,CUSIP,SecurityName,Shares,Price,MarketValue,Weightings
06/15/2026,SPWO,BABA,,Alibaba Group ADR,100,80.00,8000.00,2.00%
06/15/2026,SPWO,005930 KS,,Samsung Electronics,50,70000,3500000.00,3.00%
06/15/2026,SPWO,ASML NA,,ASML Holding,10,700.00,7000.00,1.50%
06/15/2026,SPWO,TSM,,Taiwan Semi ADR,60,180.00,10800.00,2.50%
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


class TestIsUsListed:
    def test_us_ticker_with_no_space_is_us_listed(self):
        assert _is_us_listed("AAPL") is True

    def test_adr_with_no_space_is_us_listed(self):
        assert _is_us_listed("TSM") is True
        assert _is_us_listed("BABA") is True

    def test_foreign_ticker_with_space_is_excluded(self):
        assert _is_us_listed("ASML NA") is False
        assert _is_us_listed("005930 KS") is False


class TestExtractTickersFiltersNonUsListed:
    def test_foreign_listed_tickers_excluded_from_universe(self):
        with patch("shariah_algo_trader.data.universe.requests.get") as mock_get:
            mock_get.return_value = make_response(FOREIGN_MIX_CSV)

            result = fetch_eligible_universe("SPUS")

        assert result == {"BABA", "TSM"}
        assert "005930 KS" not in result
        assert "ASML NA" not in result


class TestFetchCombinedUniverse:
    def test_unions_holdings_across_etfs(self):
        with patch("shariah_algo_trader.data.universe.requests.get") as mock_get:
            mock_get.side_effect = [make_response(HOLDINGS_CSV), make_response(OTHER_CSV)]

            result = fetch_combined_universe(["SPUS", "HLAL"])

        assert result == {"AAPL", "MSFT", "AMZN", "GOOGL"}

    def test_partial_failure_still_returns_union_of_successes(self):
        with patch("shariah_algo_trader.data.universe.requests.get") as mock_get:
            mock_get.side_effect = [make_response(HOLDINGS_CSV), requests.ConnectionError("timeout")]

            result = fetch_combined_universe(["SPUS", "HLAL"])

        assert result == {"AAPL", "MSFT", "AMZN"}

    def test_raises_when_all_etfs_fail(self):
        with patch("shariah_algo_trader.data.universe.requests.get") as mock_get:
            mock_get.side_effect = requests.ConnectionError("timeout")

            with pytest.raises(UniverseError, match="All ETF fetches failed"):
                fetch_combined_universe(["SPUS", "HLAL"])


class TestEtfConfigWiring:
    def test_all_expected_symbols_configured(self):
        for symbol in ("SPUS", "HLAL", "SPTE", "SPRE", "SPWO", "UMMA"):
            assert symbol in _ETF_CONFIG
            assert _ETF_CONFIG[symbol]["url"].startswith("https://")

    def test_hlal_uses_google_sheets_export_not_wisdomtree(self):
        assert "wisdomtree.com" not in _ETF_CONFIG["HLAL"]["url"]
        assert "docs.google.com" in _ETF_CONFIG["HLAL"]["url"]

    def test_new_symbols_are_fetchable_via_mocked_http(self):
        with patch("shariah_algo_trader.data.universe.requests.get") as mock_get:
            mock_get.return_value = make_response(HOLDINGS_CSV)

            result = fetch_eligible_universe("SPTE")

        assert result
