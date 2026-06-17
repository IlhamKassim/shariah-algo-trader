import logging
from typing import Callable

from shariah_algo_trader.execution.order_executor import OrderExecutor

logger = logging.getLogger(__name__)


def run_rebalance(
    get_portfolio: Callable[[], set[str]],
    get_positions: Callable[[], dict[str, float]],
    fetch_universe: Callable[[], set[str]],
    get_target_portfolio: Callable[[], list[str]],
    get_target_weights: Callable[[], dict[str, float]],
    executor: OrderExecutor,
    regime_ok: bool = True,
) -> None:
    """Rebalance the Portfolio to the top-N inverse-vol weighted Factor Score ranking.

    Steps:
    1. Sell stocks that left the eligible universe or dropped out of top-N.
    2. If the market regime is bearish, skip all new buys.
    3. For stocks that remain in the portfolio, adjust to their new target weight.
    4. Buy newly-entering stocks at their target weight.

    `get_positions` returns {ticker: current_market_value}.
    `get_target_weights` returns {ticker: weight_fraction} summing to ~1.0.
    """
    logger.info("Rebalance starting — regime_ok=%s", regime_ok)

    current = get_portfolio()
    positions = get_positions()
    eligible_universe = fetch_universe()
    target = get_target_portfolio()
    target_weights = get_target_weights()

    eligible_target = {t for t in target if t in eligible_universe}

    sells = current - eligible_target
    buys = eligible_target - current
    stays = current & eligible_target

    logger.info(
        "Rebalance diff — sells: %d %s, stays: %d, buys: %d %s",
        len(sells), sorted(sells), len(stays), len(buys), sorted(buys),
    )

    # 1. Sell departing positions first to free capital
    for ticker in sells:
        executor.sell(ticker)

    if not regime_ok:
        logger.warning(
            "Regime filter: SPY below 200-day MA — skipping all new buys and weight adjustments"
        )
        logger.info("Rebalance complete — %d sell(s), 0 buy(s) (bear market halt)", len(sells))
        return

    # 2. Adjust weights of continuing positions
    for ticker in stays:
        if ticker in target_weights and ticker in positions:
            executor.adjust(ticker, target_weights[ticker], positions[ticker])

    # 3. Buy entering positions at their target weight
    for ticker in buys:
        weight = target_weights.get(ticker, 1.0 / max(len(eligible_target), 1))
        executor.buy(ticker, weight)

    logger.info(
        "Rebalance complete — %d sell(s), %d adjust(s), %d buy(s) submitted",
        len(sells), len(stays), len(buys),
    )
