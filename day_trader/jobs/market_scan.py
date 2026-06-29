import logging

from day_trader.config import DayTraderConfig
from day_trader.data.alpaca_data import fetch_avg_daily_volume, fetch_latest_prices, fetch_opening_range_bars, fetch_prev_close
from day_trader.execution.order_executor import DayOrderExecutor
from day_trader.signals.gap_and_go import compute_gap, is_valid_gap_entry
from day_trader.state import ActivePosition, DayTraderState
from shariah_algo_trader.execution.alpaca_client import AlpacaClient

logger = logging.getLogger(__name__)


def run_market_scan(
    state: DayTraderState,
    cfg: DayTraderConfig,
    trading_client: AlpacaClient,
    data_client: AlpacaClient,
    executor: DayOrderExecutor,
    watchlist: list[str],
    avg_volumes: dict[str, float],
) -> None:
    """Run at 9:31 AM ET — find gapping stocks and enter immediately.

    Gap and Go enters right at the open on stocks with a significant overnight
    gap confirmed by strong first-minute volume (RVOL). No waiting for a range.
    """
    if state.is_stale():
        state.reset()

    logger.info("Gap and Go scan starting — %d watchlist stocks", len(watchlist))

    # Fetch first-minute bars (9:30–9:31) for volume, previous closes, and current prices
    first_bars = fetch_opening_range_bars(data_client, watchlist, orb_minutes=1)
    prev_closes = fetch_prev_close(data_client, watchlist)
    prices = fetch_latest_prices(data_client, watchlist)

    for symbol in watchlist:
        price = prices.get(symbol)
        prev_close = prev_closes.get(symbol, 0.0)
        if not price or not prev_close:
            continue

        bars = first_bars.get(symbol, [])
        first_min_vol = sum(int(b["v"]) for b in bars) if bars else 0
        adv = avg_volumes.get(symbol, 1_000_000)

        gap = compute_gap(symbol, price, prev_close, first_min_vol, adv)
        if gap is None:
            continue

        if not is_valid_gap_entry(symbol, gap, cfg.gap_threshold, cfg.rvol_threshold):
            continue

        state.gaps[symbol] = gap

        if state.open_position_count() >= cfg.max_positions:
            logger.info("Max positions (%d) reached — skipping %s", cfg.max_positions, symbol)
            continue

        if symbol in state.traded_today:
            continue

        notional = executor.buy(symbol, cfg.position_size_pct)
        if notional is None:
            continue

        stop = price * (1 - cfg.stop_loss_pct)
        state.positions[symbol] = ActivePosition(
            symbol=symbol,
            entry_price=price,
            stop_loss=stop,
            highest_price=price,
            qty=notional / price,
            gap_amount=gap.gap_amount,
        )
        state.traded_today.add(symbol)
        logger.info(
            "%s entered — price %.2f, stop %.2f, gap %.1f%%, target %.2f",
            symbol, price, stop,
            gap.gap_pct * 100,
            price + cfg.profit_target_mult * gap.gap_amount,
        )

    logger.info(
        "Gap and Go scan complete — %d position(s) opened, %d slot(s) remaining",
        state.open_position_count(),
        cfg.max_positions - state.open_position_count(),
    )
