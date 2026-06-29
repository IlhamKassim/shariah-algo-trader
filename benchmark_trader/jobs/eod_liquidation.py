import logging

from benchmark_trader.state import BenchmarkState
from day_trader.execution.order_executor import DayOrderExecutor

logger = logging.getLogger(__name__)


def run_eod_liquidation(state: BenchmarkState, executor: DayOrderExecutor) -> None:
    """Run at 3:55 PM ET — close all open positions before market close."""
    logger.info("EOD liquidation starting — %d position(s) to close", len(state.positions))
    executor.close_all()
    state.positions.clear()
    logger.info("EOD liquidation complete")
