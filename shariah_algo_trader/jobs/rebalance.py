from typing import Callable
from shariah_algo_trader.execution.order_executor import OrderExecutor


def run_rebalance(
    get_portfolio: Callable[[], set[str]],
    fetch_universe: Callable[[], set[str]],
    get_target_portfolio: Callable[[], list[str]],
    executor: OrderExecutor,
) -> None:
    """Rebalance the Portfolio to match the top-N Factor Score ranking.

    Sells departing stocks first, then buys entering stocks. Stocks outside
    the Eligible Universe are always sold and never bought, regardless of
    what the Factor Scorer returns.
    """
    current = get_portfolio()
    eligible_universe = fetch_universe()
    target = get_target_portfolio()

    # Eligible target: factor-scored tickers cross-checked against the universe
    eligible_target = {t for t in target if t in eligible_universe}

    sells = current - eligible_target
    buys = eligible_target - current

    for ticker in sells:
        executor.sell(ticker)

    for ticker in buys:
        executor.buy(ticker)
