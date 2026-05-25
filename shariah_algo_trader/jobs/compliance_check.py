from typing import Callable
from shariah_algo_trader.execution.order_executor import OrderExecutor


def run_compliance_check(
    get_portfolio: Callable[[], set[str]],
    fetch_universe: Callable[[], set[str]],
    executor: OrderExecutor,
) -> None:
    """Trigger a Compliance Exit for every Portfolio stock absent from the Eligible Universe.

    Reads Portfolio State and the current Holdings Snapshot at call time. Sells
    non-compliant stocks immediately. Never buys. Leaves vacated slots empty.
    """
    portfolio = get_portfolio()
    eligible_universe = fetch_universe()

    for ticker in portfolio - eligible_universe:
        executor.sell(ticker)
