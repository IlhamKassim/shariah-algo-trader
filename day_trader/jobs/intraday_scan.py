import logging

from day_trader import state_persistence
from day_trader.config import DayTraderConfig
from day_trader.data.alpaca_data import fetch_latest_prices, fetch_recent_bars
from day_trader.execution.order_executor import DayOrderExecutor
from day_trader.signals.orb_breakout import is_valid_breakout_entry
from day_trader.state import ActivePosition, DayTraderState
from shariah_algo_trader.execution.alpaca_client import AlpacaClient

logger = logging.getLogger(__name__)

_LOOKBACK_MINUTES = 5


def run_intraday_scan(
    state: DayTraderState,
    cfg: DayTraderConfig,
    data_client: AlpacaClient,
    executor: DayOrderExecutor,
    watchlist: list[str],
    avg_volumes: dict[str, float],
) -> None:
    """Run every minute, 9:32 AM–3:54 PM ET — enter on Opening Range Breakouts.

    Gap and Go (market_scan.py) only enters right at the open. This job scans
    the rest of the day for symbols whose price later breaks above the
    opening range (computed once by market_scan.py and stashed in
    state.opening_ranges) with confirming volume — so the strategy keeps
    finding new setups all day instead of going idle after 9:31 AM.
    """
    try:
        _run(state, cfg, data_client, executor, watchlist, avg_volumes)
    finally:
        state_persistence.save(state)


def _run(
    state: DayTraderState,
    cfg: DayTraderConfig,
    data_client: AlpacaClient,
    executor: DayOrderExecutor,
    watchlist: list[str],
    avg_volumes: dict[str, float],
) -> None:
    if state.is_stale() or state.circuit_broken or not state.opening_ranges:
        return

    if state.open_position_count() >= cfg.max_positions:
        return

    executor.start_cycle()

    candidates = [s for s in watchlist if s in state.opening_ranges and s not in state.traded_today]
    if not candidates:
        return

    prices = fetch_latest_prices(data_client, candidates)
    recent_bars = fetch_recent_bars(data_client, candidates, lookback_minutes=_LOOKBACK_MINUTES)

    for symbol in candidates:
        if state.open_position_count() >= cfg.max_positions:
            break

        price = prices.get(symbol)
        if not price:
            continue

        if price < cfg.min_price:
            continue

        adv = avg_volumes.get(symbol, 0.0)
        if adv < cfg.min_adv:
            continue

        range_high, range_low = state.opening_ranges[symbol]

        bars = recent_bars.get(symbol, [])
        recent_vol = sum(int(b["v"]) for b in bars) if bars else 0
        expected_recent = (adv / 390) * _LOOKBACK_MINUTES
        rvol = recent_vol / max(expected_recent, 1)

        if not is_valid_breakout_entry(symbol, price, range_high, rvol, cfg.rvol_threshold):
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
            gap_amount=range_high - range_low,
        )
        state.traded_today.add(symbol)
        logger.info(
            "%s ORB entry — price %.2f, stop %.2f, range high %.2f, target %.2f",
            symbol, price, stop, range_high,
            price + cfg.profit_target_mult * (range_high - range_low),
        )
