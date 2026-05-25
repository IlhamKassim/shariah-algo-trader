from unittest.mock import MagicMock, call
from shariah_algo_trader.jobs.compliance_check import run_compliance_check


def make_executor(*tickers_to_expect):
    return MagicMock()


class TestComplianceCheck:
    def test_sells_stock_absent_from_eligible_universe(self):
        executor = MagicMock()

        run_compliance_check(
            get_portfolio=lambda: {"AAPL", "MSFT"},
            fetch_universe=lambda: {"AAPL"},
            executor=executor,
        )

        executor.sell.assert_called_once_with("MSFT")

    def test_sells_each_non_compliant_stock_once(self):
        executor = MagicMock()

        run_compliance_check(
            get_portfolio=lambda: {"AAPL", "MSFT", "AMZN"},
            fetch_universe=lambda: {"AAPL"},
            executor=executor,
        )

        assert executor.sell.call_count == 2
        sold = {c.args[0] for c in executor.sell.call_args_list}
        assert sold == {"MSFT", "AMZN"}

    def test_does_not_sell_compliant_stocks(self):
        executor = MagicMock()

        run_compliance_check(
            get_portfolio=lambda: {"AAPL", "MSFT"},
            fetch_universe=lambda: {"AAPL", "MSFT", "AMZN"},
            executor=executor,
        )

        executor.sell.assert_not_called()

    def test_no_op_on_empty_portfolio(self):
        executor = MagicMock()

        run_compliance_check(
            get_portfolio=lambda: set(),
            fetch_universe=lambda: {"AAPL", "MSFT"},
            executor=executor,
        )

        executor.sell.assert_not_called()

    def test_never_calls_buy(self):
        executor = MagicMock()

        run_compliance_check(
            get_portfolio=lambda: {"AAPL", "MSFT"},
            fetch_universe=lambda: {"AAPL"},
            executor=executor,
        )

        executor.buy.assert_not_called()
