import logging

from day_trader.config import DayTraderConfig
from day_trader.data.alpaca_data import fetch_latest_prices, fetch_opening_range_bars, fetch_prev_close
from day_trader.execution.order_executor import DayOrderExecutor
from day_trader.signals.orb import compute_orb, compute_stop_loss, is_breakout
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
    """Run at 10:00 AM ET — compute ORB for all watchlist stocks and enter breakouts.

    This is the main signal detection window. After this job runs, the intraday
    monitor takes over to watch for late breakouts and manage stops.
    """
    if state.is_stale():
        state.reset()

    logger.info("Market scan starting — %d watchlist stocks", len(watchlist))

    # Fetch opening range bars (9:30–10:00 AM) and previous closes in parallel
    all_bars = fetch_opening_range_bars(data_client, watchlist, cfg.orb_minutes)
    prev_closes = fetch_prev_close(data_client, watchlist)

    # Compute ORB for each symbol
    for symbol in watchlist:
        bars = all_bars.get(symbol, [])
        adv = avg_volumes.get(symbol, 1_000_000)
        orb = compute_orb(
            symbol, bars, adv,
            orb_minutes=cfg.orb_minutes,
            prev_close=prev_closes.get(symbol, 0.0),
        )
        if orb is not None:
            state.orb[symbol] = orb

    logger.info("ORB computed for %d/%d symbols", len(state.orb), len(watchlist))

    if not state.orb:
        logger.warning("No ORB data available — market may be closed or data feed issue")
        return

    # Fetch current prices
    prices = fetch_latest_prices(data_client, list(state.orb.keys()))

    # Detect breakouts and enter positions
    for symbol, orb in state.orb.items():
        if state.open_position_count() >= cfg.max_positions:
            logger.info("Max positions (%d) reached — skipping remaining signals", cfg.max_positions)
            break

        if symbol in state.traded_today:
            continue

        price = prices.get(symbol)
        if price is None:
            continue

        # Gap filter: require at least cfg.gap_pct gap from prior close
        if orb.gap_pct < cfg.gap_pct:
            logger.info(
                "%s: gap too small (%.1f%%, need %.0f%%) — skipping",
                symbol, orb.gap_pct * 100, cfg.gap_pct * 100,
            )
            continue

        if not is_breakout(symbol, price, orb, cfg.rvol_threshold):
            continue

        # Enter position
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
            "%s entered — price %.2f, stop %.2f, ORB [%.2f, %.2f], gap %.1f%%, RVOL %.2f",
            symbol, price, stop, orb.low, orb.high, orb.gap_pct * 100, orb.rvol,
        )

    logger.info(
        "Market scan complete — %d position(s) opened, %d slot(s) remaining",
        state.open_position_count(),
        cfg.max_positions - state.open_position_count(),
    )
