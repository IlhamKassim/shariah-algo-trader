import logging

from day_trader import state_persistence
from day_trader.config import DayTraderConfig
from day_trader.data.alpaca_data import fetch_latest_prices
from day_trader.execution.order_executor import DayOrderExecutor
from day_trader.state import DayTraderState
from shariah_algo_trader.execution.alpaca_client import AlpacaClient

logger = logging.getLogger(__name__)


def run_intraday_monitor(
    state: DayTraderState,
    cfg: DayTraderConfig,
    data_client: AlpacaClient,
    executor: DayOrderExecutor,
) -> None:
    """Run every minute — manage trailing stops and profit targets.

    Gap and Go only enters at the 9:31 AM open scan; the ORB breakout scanner
    (intraday_scan.py) enters throughout the day. This job purely manages
    existing positions regardless of how they were entered. No new entries
    are made here.
    """
    try:
        _run(state, cfg, data_client, executor)
    finally:
        state_persistence.save(state)


def _run(
    state: DayTraderState,
    cfg: DayTraderConfig,
    data_client: AlpacaClient,
    executor: DayOrderExecutor,
) -> None:
    if state.is_stale():
        state.reset()
        return

    if state.circuit_broken:
        return

    if not state.positions:
        return

    # Circuit breaker: close everything and halt if daily loss exceeds the limit
    if state.starting_equity is not None:
        current_equity = executor.equity()
        if current_equity is not None:
            loss_pct = (state.starting_equity - current_equity) / state.starting_equity
            if loss_pct >= cfg.max_loss_pct:
                logger.warning(
                    "Circuit breaker triggered — daily loss %.1f%% exceeds limit %.1f%%; closing all positions",
                    loss_pct * 100, cfg.max_loss_pct * 100,
                )
                executor.close_all()
                state.positions.clear()
                state.circuit_broken = True
                return

    prices = fetch_latest_prices(data_client, list(state.positions.keys()))

    if not prices:
        logger.warning(
            "Price fetch returned empty — skipping stop checks for %d position(s)",
            len(state.positions),
        )
        return

    to_exit: list[tuple[str, str]] = []

    for symbol, pos in state.positions.items():
        price = prices.get(symbol)
        if price is None:
            continue

        # Profit target: entry + profit_target_mult × gap_amount
        target = pos.entry_price + cfg.profit_target_mult * pos.gap_amount
        if price >= target:
            logger.info(
                "%s profit target hit at %.2f (target %.2f, entry %.2f, gap $%.2f)",
                symbol, price, target, pos.entry_price, pos.gap_amount,
            )
            to_exit.append((symbol, f"profit target at {target:.2f}"))
            continue

        # Update trailing stop peak
        if price > pos.highest_price:
            pos.highest_price = price

        trailing_stop = pos.highest_price * (1 - cfg.trailing_stop_pct)
        effective_stop = max(pos.stop_loss, trailing_stop)

        if price <= effective_stop:
            reason = (
                f"trailing stop (peak={pos.highest_price:.2f}, floor={trailing_stop:.2f})"
                if trailing_stop > pos.stop_loss
                else f"hard stop ({pos.stop_loss:.2f})"
            )
            logger.info("%s stop hit at %.2f — %s", symbol, price, reason)
            to_exit.append((symbol, reason))

    for symbol, exit_reason in to_exit:
        pos = state.positions.pop(symbol, None)
        if pos is None:
            continue
        exit_price = prices.get(symbol)
        executor.sell(symbol, reason=exit_reason)
        if exit_price is not None:
            pnl_pct = (exit_price / pos.entry_price - 1) * 100
            logger.info("%s closed — P&L %.2f%%", symbol, pnl_pct)
        else:
            logger.warning("%s closed — exit price unavailable, P&L unknown", symbol)
