import logging
from typing import Callable

from shariah_algo_trader.execution.order_executor import OrderExecutor

logger = logging.getLogger(__name__)


def run_compliance_check(
    get_portfolio: Callable[[], set[str]],
    fetch_universe: Callable[[], set[str]],
    executor: OrderExecutor,
) -> None:
    """Trigger a Compliance Exit for every Portfolio stock absent from the Eligible Universe.

    Reads Portfolio State and the current Holdings Snapshot at call time. Sells
    non-compliant stocks immediately. Never buys. Leaves vacated slots empty.
    """
    logger.info("Compliance Check starting")
    portfolio = get_portfolio()
    eligible_universe = fetch_universe()

    non_compliant = portfolio - eligible_universe
    if not non_compliant:
        logger.info("Compliance Check complete — Portfolio fully compliant, no exits required")
        return

    logger.warning("Compliance Exit triggered for %d stock(s): %s", len(non_compliant), sorted(non_compliant))
    for ticker in non_compliant:
        executor.sell(ticker)
    logger.info("Compliance Check complete — %d Compliance Exit(s) submitted", len(non_compliant))
