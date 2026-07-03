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


ACCOUNT = {"equity": "100000.00", "cash": "100000.00", "currency": "USD"}
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

    def test_buy_notional_capped_to_available_cash(self):
        low_cash = {"equity": "100000.00", "cash": "3000.00", "currency": "USD"}
        client = make_client(get_data=low_cash, post_data=ORDER_RESPONSE)
        executor = OrderExecutor(client)

        # 5% of equity ($5000) exceeds the $3000 cash on hand — order should be
        # capped to cash minus the settlement buffer, not go negative.
        executor.buy("AAPL")

        posted = client._session.post.call_args
        body = posted.kwargs.get("json") or posted.args[1]
        assert body["notional"] < 3000.00
        assert body["notional"] == pytest.approx(3000.00 - 100000.00 * 0.005)

    def test_buy_skipped_when_cash_below_minimum_notional(self):
        no_cash = {"equity": "100000.00", "cash": "10.00", "currency": "USD"}
        client = make_client(get_data=no_cash, post_data=ORDER_RESPONSE)
        executor = OrderExecutor(client)

        executor.buy("AAPL")

        client._session.post.assert_not_called()

    def test_successive_buys_share_one_cash_pool_within_a_cycle(self):
        # $6000 cash, buffer leaves ~$5500. Two buys at 5% of equity ($5000 each)
        # should not both fill — the second must be capped by what the first left behind.
        tight_cash = {"equity": "100000.00", "cash": "6000.00", "currency": "USD"}
        client = make_client(get_data=tight_cash, post_data=ORDER_RESPONSE)
        executor = OrderExecutor(client)

        executor.buy("AAPL")
        executor.buy("MSFT")

        notionals = [
            (c.kwargs.get("json") or c.args[1])["notional"]
            for c in client._session.post.call_args_list
        ]
        assert sum(notionals) <= 6000.00 - 100000.00 * 0.005 + 0.01

    def test_start_cycle_refreshes_cash_pool(self):
        tight_cash = {"equity": "100000.00", "cash": "6000.00", "currency": "USD"}
        client = make_client(get_data=tight_cash, post_data=ORDER_RESPONSE)
        executor = OrderExecutor(client)

        executor.buy("AAPL")  # spends most of the tracked cash pool
        executor.start_cycle()
        executor.buy("MSFT")  # should re-read cash fresh, not inherit depletion

        posted = client._session.post.call_args
        body = posted.kwargs.get("json") or posted.args[1]
        assert body["notional"] == pytest.approx(5000.00)


class TestSell:
    def test_closes_full_position_via_delete(self):
        client = make_client(delete_data={"status": "pending_cancel"})
        executor = OrderExecutor(client)

        executor.sell("MSFT")

        client._session.delete.assert_called_once()
        url = client._session.delete.call_args.args[0]
        assert url.endswith("/v2/positions/MSFT")

    def test_sell_proceeds_credited_to_pool_for_later_buy_same_cycle(self):
        # $3000 cash on hand is nowhere near enough for a 5% ($5000) buy, but
        # selling a $10,000 position first should free that cash within the
        # same cycle — the broker's reported cash balance won't reflect the
        # fill yet, so the executor must track it itself.
        low_cash = {"equity": "100000.00", "cash": "3000.00", "currency": "USD"}
        client = make_client(get_data=low_cash, delete_data={"status": "pending_cancel"}, post_data=ORDER_RESPONSE)
        executor = OrderExecutor(client)
        executor.start_cycle()

        executor.sell("MSFT", value=10000.00)
        executor.buy("AAPL")

        posted = client._session.post.call_args
        body = posted.kwargs.get("json") or posted.args[1]
        assert body["notional"] == pytest.approx(5000.00)


class TestAdjust:
    def test_top_up_notional_capped_to_available_cash(self):
        low_cash = {"equity": "100000.00", "cash": "1000.00", "currency": "USD"}
        client = make_client(get_data=low_cash, post_data=ORDER_RESPONSE)
        executor = OrderExecutor(client)

        # target 10% ($10000) vs current $8000 held => wants to buy $2000, but only
        # ~$1000 cash is on hand — must be capped, not overspend into negative cash.
        executor.adjust("AAPL", target_weight=0.10, current_value=8000.00)

        posted = client._session.post.call_args
        body = posted.kwargs.get("json") or posted.args[1]
        assert body["notional"] == pytest.approx(1000.00 - 100000.00 * 0.005)

    def test_top_up_skipped_when_cash_below_minimum_notional(self):
        no_cash = {"equity": "100000.00", "cash": "300.00", "currency": "USD"}
        client = make_client(get_data=no_cash, post_data=ORDER_RESPONSE)
        executor = OrderExecutor(client)

        # Buffer (0.5% of $100k = $500) exceeds the $300 cash on hand, so the
        # capped notional is $0 — must skip rather than submit a zero/dust order.
        executor.adjust("AAPL", target_weight=0.10, current_value=8000.00)

        client._session.post.assert_not_called()

    def test_trim_is_not_cash_capped(self):
        low_cash = {"equity": "100000.00", "cash": "0.00", "currency": "USD"}
        client = make_client(get_data=low_cash, post_data=ORDER_RESPONSE)
        executor = OrderExecutor(client)

        # target 5% ($5000) vs current $9000 held => wants to sell $4000. Selling
        # frees cash, so it should never be blocked by the cash-availability cap.
        executor.adjust("AAPL", target_weight=0.05, current_value=9000.00)

        posted = client._session.post.call_args
        body = posted.kwargs.get("json") or posted.args[1]
        assert body["side"] == "sell"
        assert body["notional"] == pytest.approx(4000.00)

    def test_trim_proceeds_credited_to_pool_for_later_buy_same_cycle(self):
        # No cash on hand, but trimming MSFT down to target frees $6000 —
        # that should be available for AAPL's buy later in the same cycle.
        no_cash = {"equity": "100000.00", "cash": "500.00", "currency": "USD"}
        client = make_client(get_data=no_cash, post_data=ORDER_RESPONSE)
        executor = OrderExecutor(client)
        executor.start_cycle()

        executor.adjust("MSFT", target_weight=0.03, current_value=9000.00)
        executor.buy("AAPL")

        posted = client._session.post.call_args_list[-1]
        body = posted.kwargs.get("json") or posted.args[1]
        assert body["symbol"] == "AAPL"
        assert body["notional"] == pytest.approx(5000.00)
