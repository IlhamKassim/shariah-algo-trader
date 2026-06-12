import logging
from typing import Callable

from shariah_algo_trader.execution.order_executor import OrderExecutor

logger = logging.getLogger(__name__)


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
    logger.info("Rebalance starting")
    current = get_portfolio()
    eligible_universe = fetch_universe()
    target = get_target_portfolio()

    eligible_target = {t for t in target if t in eligible_universe}

    sells = current - eligible_target
    buys = eligible_target - current

    logger.info(
        "Rebalance diff — sells: %d %s, buys: %d %s",
        len(sells), sorted(sells), len(buys), sorted(buys),
    )

    for ticker in sells:
        executor.sell(ticker)

    for ticker in buys:
        executor.buy(ticker)

    logger.info("Rebalance complete — %d sell(s), %d buy(s) submitted", len(sells), len(buys))
