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
    executor.close_all()
    state.positions.clear()
    logger.info("EOD liquidation complete — all positions cleared from state")
