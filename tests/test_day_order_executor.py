from unittest.mock import MagicMock
import pytest
from shariah_algo_trader.execution.alpaca_client import AlpacaClient
from day_trader.execution.order_executor import DayOrderExecutor


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


ORDER_RESPONSE = {"id": "abc123", "status": "accepted"}


class TestBuy:
    def test_submits_market_buy_sized_off_equity(self):
        account = {"equity": "100000.00", "cash": "100000.00", "currency": "USD"}
        client = make_client(get_data=account, post_data=ORDER_RESPONSE)
        executor = DayOrderExecutor(client)

        notional = executor.buy("AAPL", position_size_pct=0.10)

        assert notional == pytest.approx(10000.00)
        posted = client._session.post.call_args
        body = posted.kwargs.get("json") or posted.args[1]
        assert body["notional"] == pytest.approx(10000.00)
        assert body["side"] == "buy"
        assert body["type"] == "market"

    def test_notional_capped_to_available_cash(self):
        low_cash = {"equity": "100000.00", "cash": "3000.00", "currency": "USD"}
        client = make_client(get_data=low_cash, post_data=ORDER_RESPONSE)
        executor = DayOrderExecutor(client)

        # 10% of equity ($10000) exceeds the $3000 cash on hand.
        notional = executor.buy("AAPL", position_size_pct=0.10)

        assert notional < 3000.00
        assert notional == pytest.approx(3000.00 - 100000.00 * 0.005)

    def test_returns_none_when_no_cash_available(self):
        no_cash = {"equity": "100000.00", "cash": "0.00", "currency": "USD"}
        client = make_client(get_data=no_cash, post_data=ORDER_RESPONSE)
        executor = DayOrderExecutor(client)

        notional = executor.buy("AAPL", position_size_pct=0.10)

        assert notional is None
        client._session.post.assert_not_called()

    def test_successive_buys_in_one_scan_share_one_cash_pool(self):
        # $6000 cash, buffer leaves ~$5500. Two buys at 10% of equity ($10000 each)
        # should not both fill at full size within the same scan cycle.
        tight_cash = {"equity": "100000.00", "cash": "6000.00", "currency": "USD"}
        client = make_client(get_data=tight_cash, post_data=ORDER_RESPONSE)
        executor = DayOrderExecutor(client)

        n1 = executor.buy("AAPL", position_size_pct=0.10)
        n2 = executor.buy("MSFT", position_size_pct=0.10)

        assert n1 + (n2 or 0) <= 6000.00 - 100000.00 * 0.005 + 0.01

    def test_start_cycle_refreshes_cash_pool(self):
        tight_cash = {"equity": "100000.00", "cash": "6000.00", "currency": "USD"}
        client = make_client(get_data=tight_cash, post_data=ORDER_RESPONSE)
        executor = DayOrderExecutor(client)

        executor.buy("AAPL", position_size_pct=0.10)  # depletes the pool to ~$500
        executor.start_cycle()
        notional = executor.buy("MSFT", position_size_pct=0.05)  # $5000, fits the refreshed pool

        assert notional == pytest.approx(5000.00)


class TestSell:
    def test_closes_full_position_via_delete(self):
        client = make_client(delete_data={"status": "pending_cancel"})
        executor = DayOrderExecutor(client)

        result = executor.sell("MSFT")

        assert result is True
        client._session.delete.assert_called_once()
        url = client._session.delete.call_args.args[0]
        assert url.endswith("/v2/positions/MSFT")
