from unittest.mock import MagicMock, call
import pytest
from shariah_algo_trader.execution.alpaca_client import AlpacaClient, AlpacaError
from shariah_algo_trader.execution.order_executor import OrderExecutor


def make_client(get_data=None, post_data=None, delete_data=None, status_code=200):
    def mock_response(data):
        r = MagicMock()
        r.status_code = status_code
        r.ok = status_code < 400
        r.json.return_value = data
        return r

    session = MagicMock()
    session.get.return_value = mock_response(get_data)
    session.post.return_value = mock_response(post_data)
    session.delete.return_value = mock_response(delete_data)

    return AlpacaClient(
        api_key="key", api_secret="secret",
        base_url="https://paper-api.alpaca.markets",
        session=session,
    )


ACCOUNT = {"equity": "100000.00", "currency": "USD"}
ORDER_RESPONSE = {"id": "abc123", "status": "accepted"}


class TestBuy:
    def test_submits_market_buy_with_five_percent_notional(self):
        client = make_client(get_data=ACCOUNT, post_data=ORDER_RESPONSE)
        executor = OrderExecutor(client)

        executor.buy("AAPL")

        posted = client._session.post.call_args
        body = posted.kwargs.get("json") or posted.args[1]
        assert body["symbol"] == "AAPL"
        assert body["notional"] == pytest.approx(5000.00)
        assert body["side"] == "buy"
        assert body["type"] == "market"
        assert body["time_in_force"] == "day"

    def test_buy_payload_contains_no_margin_or_short_fields(self):
        client = make_client(get_data=ACCOUNT, post_data=ORDER_RESPONSE)
        executor = OrderExecutor(client)

        executor.buy("AAPL")

        posted = client._session.post.call_args
        body = posted.kwargs.get("json") or posted.args[1]
        forbidden = {"margin", "leverage", "short", "extended_hours"}
        assert not forbidden.intersection(body.keys())


class TestSell:
    def test_closes_full_position_via_delete(self):
        client = make_client(delete_data={"status": "pending_cancel"})
        executor = OrderExecutor(client)

        executor.sell("MSFT")

        client._session.delete.assert_called_once()
        url = client._session.delete.call_args.args[0]
        assert url.endswith("/v2/positions/MSFT")
