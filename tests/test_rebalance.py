from unittest.mock import MagicMock, call
from shariah_algo_trader.jobs.rebalance import run_rebalance


def make_executor():
    return MagicMock()


class TestRebalanceDiff:
    def test_buys_entering_stocks_and_sells_departing_stocks(self):
        executor = make_executor()

        run_rebalance(
            get_portfolio=lambda: {"AAPL", "MSFT"},
            fetch_universe=lambda: {"AAPL", "AMZN", "GOOG"},
            get_target_portfolio=lambda: ["AAPL", "AMZN"],
            executor=executor,
        )

        executor.sell.assert_called_once_with("MSFT")
        executor.buy.assert_called_once_with("AMZN")

    def test_sells_are_submitted_before_buys(self):
        executor = make_executor()

        run_rebalance(
            get_portfolio=lambda: {"MSFT"},
            fetch_universe=lambda: {"AAPL", "AMZN"},
            get_target_portfolio=lambda: ["AAPL", "AMZN"],
            executor=executor,
        )

        calls = executor.method_calls
        sell_indices = [i for i, c in enumerate(calls) if c[0] == "sell"]
        buy_indices  = [i for i, c in enumerate(calls) if c[0] == "buy"]
        assert sell_indices and buy_indices
        assert max(sell_indices) < min(buy_indices)

    def test_empty_portfolio_buys_all_target_stocks(self):
        executor = make_executor()

        run_rebalance(
            get_portfolio=lambda: set(),
            fetch_universe=lambda: {"AAPL", "MSFT"},
            get_target_portfolio=lambda: ["AAPL", "MSFT"],
            executor=executor,
        )

        executor.sell.assert_not_called()
        bought = {c.args[0] for c in executor.buy.call_args_list}
        assert bought == {"AAPL", "MSFT"}

    def test_portfolio_already_matches_target_submits_no_orders(self):
        executor = make_executor()

        run_rebalance(
            get_portfolio=lambda: {"AAPL", "MSFT"},
            fetch_universe=lambda: {"AAPL", "MSFT"},
            get_target_portfolio=lambda: ["AAPL", "MSFT"],
            executor=executor,
        )

        executor.sell.assert_not_called()
        executor.buy.assert_not_called()

    def test_sells_non_eligible_stock_even_if_in_target(self):
        # Safety invariant: target sneaks in an ineligible ticker — must not be bought
        executor = make_executor()

        run_rebalance(
            get_portfolio=lambda: {"AAPL", "HARAM"},
            fetch_universe=lambda: {"AAPL", "MSFT"},        # HARAM not in universe
            get_target_portfolio=lambda: ["AAPL", "HARAM"], # buggy scorer
            executor=executor,
        )

        sold = {c.args[0] for c in executor.sell.call_args_list}
        bought = {c.args[0] for c in executor.buy.call_args_list}
        assert "HARAM" in sold
        assert "HARAM" not in bought

    def test_universe_smaller_than_top_n_buys_all_ranked_stocks(self):
        executor = make_executor()

        run_rebalance(
            get_portfolio=lambda: set(),
            fetch_universe=lambda: {"AAPL", "MSFT"},
            get_target_portfolio=lambda: ["AAPL", "MSFT"],  # only 2, top_n was 20
            executor=executor,
        )

        bought = {c.args[0] for c in executor.buy.call_args_list}
        assert bought == {"AAPL", "MSFT"}
        executor.sell.assert_not_called()
