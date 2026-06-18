import logging

from day_trader.config import DayTraderConfig
from day_trader.data.alpaca_data import fetch_latest_prices
from day_trader.execution.order_executor import DayOrderExecutor
from day_trader.signals.orb import compute_stop_loss, is_breakout
from day_trader.state import ActivePosition, DayTraderState
from shariah_algo_trader.execution.alpaca_client import AlpacaClient

logger = logging.getLogger(__name__)


def run_intraday_monitor(
    state: DayTraderState,
    cfg: DayTraderConfig,
    data_client: AlpacaClient,
    executor: DayOrderExecutor,
) -> None:
    """Run every minute — manage stops and scan for late breakouts.

    For held positions: updates trailing stop and exits if stop is hit.
    For untraded symbols with ORB data: checks for late breakout entry.
    """
    if state.is_stale():
        state.reset()
        return

    symbols_to_watch = set(state.positions.keys()) | set(state.orb.keys())
    if not symbols_to_watch:
        return

    prices = fetch_latest_prices(data_client, list(symbols_to_watch))

    # 1. Manage existing positions (stops)
    to_exit: list[str] = []
    for symbol, pos in state.positions.items():
        price = prices.get(symbol)
        if price is None:
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
            to_exit.append(symbol)

    for symbol in to_exit:
        pos = state.positions.pop(symbol)
        executor.sell(symbol, reason=f"stop at {prices.get(symbol, 0):.2f}")
        pnl_pct = (prices.get(symbol, pos.entry_price) / pos.entry_price - 1) * 100
        logger.info("%s closed — P&L %.2f%%", symbol, pnl_pct)

    # 2. Scan for late breakouts
    if state.open_position_count() < cfg.max_positions:
        for symbol, orb in state.orb.items():
            if symbol in state.positions or symbol in state.traded_today:
                continue
            if state.open_position_count() >= cfg.max_positions:
                break

            price = prices.get(symbol)
            if price is None:
                continue

            if not is_breakout(symbol, price, orb, cfg.volume_confirm_pct):
                continue

            notional = executor.buy(symbol, cfg.position_size_pct)
            if notional is None:
                continue

            stop = compute_stop_loss(price, orb.low, cfg.stop_loss_pct)
            state.positions[symbol] = ActivePosition(
                symbol=symbol,
                entry_price=price,
                stop_loss=stop,
                highest_price=price,
                qty=notional / price,
            )
            state.traded_today.add(symbol)
            logger.info(
                "%s late breakout entry — price %.2f, stop %.2f",
                symbol, price, stop,
            )
