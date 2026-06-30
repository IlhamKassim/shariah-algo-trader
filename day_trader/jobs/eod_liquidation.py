import logging

from day_trader.execution.order_executor import DayOrderExecutor
from day_trader.state import DayTraderState

logger = logging.getLogger(__name__)


def run_eod_liquidation(state: DayTraderState, executor: DayOrderExecutor) -> None:
    """Run at 3:55 PM ET — close all open positions before market close.

    This guarantees no overnight holds, which keeps the strategy long-only
    intraday and avoids any overnight interest or gap risk.
    """
    logger.info("EOD liquidation starting — %d position(s) to close", len(state.positions))
    failed = executor.close_all()
    # Only remove positions that were successfully closed so we don't lose
    # track of positions that Alpaca still holds (e.g. on transient API errors).
    for symbol in list(state.positions):
        if symbol not in failed:
            del state.positions[symbol]
    if failed:
        logger.warning("EOD: %d position(s) NOT cleared from state (sell failed): %s", len(failed), sorted(failed))
    else:
        logger.info("EOD liquidation complete — all positions cleared from state")
