from unittest.mock import MagicMock
import pytest
from shariah_algo_trader.execution.alpaca_client import AlpacaClient, AlpacaError
from shariah_algo_trader.execution.portfolio import get_current_portfolio


def make_client(response_data=None, status_code=200):
    mock_response = MagicMock()
    mock_response.status_code = status_code
    mock_response.ok = status_code < 400
    mock_response.json.return_value = response_data

    mock_session = MagicMock()
    mock_session.get.return_value = mock_response

    return AlpacaClient(
        api_key="test-key",
        api_secret="test-secret",
        base_url="https://paper-api.alpaca.markets",
        session=mock_session,
    )


ALPACA_POSITIONS = [
    {"symbol": "AAPL", "qty": "10", "market_value": "1750.00"},
    {"symbol": "MSFT", "qty": "5", "market_value": "2100.00"},
    {"symbol": "AMZN", "qty": "3", "market_value": "900.00"},
]


class TestGetCurrentPortfolio:
    def test_returns_set_of_tickers_from_populated_positions(self):
        client = make_client(response_data=ALPACA_POSITIONS)

        result = get_current_portfolio(client)

        assert result == {"AAPL", "MSFT", "AMZN"}

    def test_returns_empty_set_when_no_positions(self):
        client = make_client(response_data=[])

        result = get_current_portfolio(client)

        assert result == set()

    def test_raises_on_http_error(self):
        client = make_client(response_data={"message": "forbidden"}, status_code=403)

        with pytest.raises(AlpacaError, match="403"):
            get_current_portfolio(client)
