from unittest.mock import MagicMock
import pytest
from shariah_algo_trader.data.fmp_client import FMPClient, FMPError
from shariah_algo_trader.data.universe import fetch_eligible_universe


def make_client(response_data=None, status_code=200, raise_json=False):
    """Build an FMPClient backed by a mock session."""
    mock_response = MagicMock()
    mock_response.status_code = status_code
    mock_response.ok = status_code < 400
    if raise_json:
        mock_response.json.side_effect = ValueError("bad json")
    else:
        mock_response.json.return_value = response_data

    mock_session = MagicMock()
    mock_session.get.return_value = mock_response

    return FMPClient(api_key="test-key", session=mock_session)


FMP_HOLDINGS = [
    {"asset": "AAPL", "weightPercentage": 5.2},
    {"asset": "MSFT", "weightPercentage": 4.8},
    {"asset": "AMZN", "weightPercentage": 3.1},
]


class TestFetchEligibleUniverse:
    def test_returns_set_of_tickers_from_well_formed_response(self):
        client = make_client(response_data=FMP_HOLDINGS)

        result = fetch_eligible_universe("SPUS", client)

        assert result == {"AAPL", "MSFT", "AMZN"}

    def test_raises_on_empty_holdings(self):
        client = make_client(response_data=[])

        with pytest.raises(FMPError, match="no holdings"):
            fetch_eligible_universe("SPUS", client)

    def test_raises_on_http_error(self):
        client = make_client(response_data={"error": "Unauthorized"}, status_code=401)

        with pytest.raises(FMPError, match="401"):
            fetch_eligible_universe("SPUS", client)

    def test_raises_on_malformed_json(self):
        client = make_client(raise_json=True)

        with pytest.raises(FMPError, match="malformed"):
            fetch_eligible_universe("SPUS", client)
