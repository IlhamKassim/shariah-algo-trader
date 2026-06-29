import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from day_trader.config import DayTraderConfig
from day_trader.data.alpaca_data import fetch_latest_prices
from day_trader.execution.order_executor import DayOrderExecutor
from day_trader.signals.orb import compute_stop_loss, is_breakout
from day_trader.state import ActivePosition, DayTraderState
from shariah_algo_trader.execution.alpaca_client import AlpacaClient

_ET = ZoneInfo("America/New_York")

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

    if not prices and state.positions:
        logger.warning("Price fetch returned empty — skipping stop checks for %d position(s)", len(state.positions))
        return

    # 1. Manage existing positions (stops and profit targets)
    to_exit: list[tuple[str, str]] = []
    for symbol, pos in state.positions.items():
        price = prices.get(symbol)
        if price is None:
            continue

        # Check profit target first (1.5× ORB range above entry)
        orb_data = state.orb.get(symbol)
        if orb_data is not None:
            orb_range = orb_data.high - orb_data.low
            target = pos.entry_price + cfg.profit_target_multiplier * orb_range
            if price >= target:
                logger.info(
                    "%s profit target hit at %.2f (target %.2f, entry %.2f, range %.2f)",
                    symbol, price, target, pos.entry_price, orb_range,
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

    # 2. Scan for late breakouts — hard cutoff at 11:30 AM to avoid chasing midday noise
    #    and to ensure positions have room to run before the 3:55 PM EOD liquidation.
    now_et = datetime.now(_ET)
    cutoff = now_et.replace(hour=11, minute=30, second=0, microsecond=0)
    if state.open_position_count() < cfg.max_positions and now_et < cutoff:
        for symbol, orb in state.orb.items():
            if symbol in state.positions or symbol in state.traded_today:
                continue
            if state.open_position_count() >= cfg.max_positions:
                break

            price = prices.get(symbol)
            if price is None:
                continue

            # Re-apply gap filter for late entries (gap condition set at open, unchanged)
            if orb.gap_pct < cfg.gap_pct:
                continue

            if not is_breakout(symbol, price, orb, cfg.rvol_threshold):
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
                "%s late breakout entry — price %.2f, stop %.2f, gap %.1f%%, RVOL %.2f",
                symbol, price, stop, orb.gap_pct * 100, orb.rvol,
            )
