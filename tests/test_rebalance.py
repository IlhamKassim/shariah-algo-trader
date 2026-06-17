from unittest.mock import MagicMock
from shariah_algo_trader.jobs.rebalance import run_rebalance


def make_executor():
    return MagicMock()


def _equal_weights(tickers):
    n = len(tickers) or 1
    return {t: 1.0 / n for t in tickers}


def _run(portfolio, universe, target, executor, regime_ok=True):
    tgt = list(target)
    run_rebalance(
        get_portfolio=lambda: set(portfolio),
        get_positions=lambda: {},
        fetch_universe=lambda: set(universe),
        get_target_portfolio=lambda: tgt,
        get_target_weights=lambda: _equal_weights(tgt),
        executor=executor,
        regime_ok=regime_ok,
    )


class TestRebalanceDiff:
    def test_buys_entering_stocks_and_sells_departing_stocks(self):
        executor = make_executor()
        _run({"AAPL", "MSFT"}, {"AAPL", "AMZN", "GOOG"}, ["AAPL", "AMZN"], executor)
        executor.sell.assert_called_once_with("MSFT")
        bought = {c.args[0] for c in executor.buy.call_args_list}
        assert bought == {"AMZN"}

    def test_sells_are_submitted_before_buys(self):
        executor = make_executor()
        _run({"MSFT"}, {"AAPL", "AMZN"}, ["AAPL", "AMZN"], executor)
        calls = executor.method_calls
        sell_indices = [i for i, c in enumerate(calls) if c[0] == "sell"]
        buy_indices = [i for i, c in enumerate(calls) if c[0] == "buy"]
        assert sell_indices and buy_indices
        assert max(sell_indices) < min(buy_indices)

    def test_empty_portfolio_buys_all_target_stocks(self):
        executor = make_executor()
        _run(set(), {"AAPL", "MSFT"}, ["AAPL", "MSFT"], executor)
        executor.sell.assert_not_called()
        bought = {c.args[0] for c in executor.buy.call_args_list}
        assert bought == {"AAPL", "MSFT"}

    def test_portfolio_already_matches_target_submits_no_orders(self):
        executor = make_executor()
        _run({"AAPL", "MSFT"}, {"AAPL", "MSFT"}, ["AAPL", "MSFT"], executor)
        executor.sell.assert_not_called()
        executor.buy.assert_not_called()

    def test_sells_non_eligible_stock_even_if_in_target(self):
        executor = make_executor()
        _run({"AAPL", "HARAM"}, {"AAPL", "MSFT"}, ["AAPL", "HARAM"], executor)
        sold = {c.args[0] for c in executor.sell.call_args_list}
        bought = {c.args[0] for c in executor.buy.call_args_list}
        assert "HARAM" in sold
        assert "HARAM" not in bought

    def test_universe_smaller_than_top_n_buys_all_ranked_stocks(self):
        executor = make_executor()
        _run(set(), {"AAPL", "MSFT"}, ["AAPL", "MSFT"], executor)
        bought = {c.args[0] for c in executor.buy.call_args_list}
        assert bought == {"AAPL", "MSFT"}
        executor.sell.assert_not_called()

    def test_bear_market_skips_buys_but_still_sells(self):
        executor = make_executor()
        _run({"MSFT"}, {"AAPL", "AMZN"}, ["AAPL", "AMZN"], executor, regime_ok=False)
        executor.sell.assert_called_once_with("MSFT")
        executor.buy.assert_not_called()
