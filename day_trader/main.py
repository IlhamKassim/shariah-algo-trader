import datetime
import logging
import sys

from day_trader.config import DayTraderConfig
from day_trader.data.alpaca_data import ET, compute_opening_ranges, fetch_avg_daily_volume
from day_trader.data.watchlist import get_watchlist
from day_trader.execution.order_executor import DayOrderExecutor
from day_trader.jobs.eod_liquidation import run_eod_liquidation
from day_trader.jobs.intraday_monitor import run_intraday_monitor
from day_trader.jobs.intraday_scan import run_intraday_scan
from day_trader.jobs.market_scan import run_market_scan
from day_trader.scheduling.scheduler import start_scheduler
from day_trader.state import state
from day_trader.state_persistence import reconcile_on_startup
from shariah_algo_trader.execution.alpaca_client import AlpacaClient
from shariah_algo_trader.scheduling.trading_calendar import is_trading_day

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


def main() -> None:
    try:
        cfg = DayTraderConfig()
    except EnvironmentError as exc:
        logger.error("Day-trader startup failed: %s", exc)
        sys.exit(1)

    trading_client = AlpacaClient(cfg.api_key, cfg.api_secret, cfg.base_url)
    data_client = AlpacaClient(cfg.api_key, cfg.api_secret, cfg.data_url)
    executor = DayOrderExecutor(trading_client)

    watchlist = get_watchlist()
    logger.info("Watchlist: %d symbols — fetching average daily volumes...", len(watchlist))
    avg_volumes = fetch_avg_daily_volume(data_client, watchlist)

    reconcile_on_startup(state, executor)

    # Opening ranges are only computed once a day, by the 9:31 AM Gap and Go
    # scan — if this process started after that (e.g. a mid-day restart), the
    # ORB breakout scanner would otherwise have nothing to check against for
    # the rest of today. Alpaca's historical bars for the fixed 9:30 AM window
    # are still valid no matter what time it is now, so backfill directly from
    # there rather than needing to have cached it locally.
    now_et = datetime.datetime.now(tz=ET)
    range_close = now_et.replace(hour=9, minute=30, second=0, microsecond=0) + datetime.timedelta(minutes=cfg.orb_minutes)
    if is_trading_day(now_et.date()) and now_et >= range_close and not state.opening_ranges:
        logger.info("Backfilling today's opening ranges (process started after the %d-minute window closed)...", cfg.orb_minutes)
        state.opening_ranges.update(compute_opening_ranges(data_client, watchlist, cfg.orb_minutes))
        logger.info("Opening ranges backfilled for %d/%d symbols", len(state.opening_ranges), len(watchlist))

    def refresh_adv_job() -> None:
        fresh = fetch_avg_daily_volume(data_client, watchlist)
        avg_volumes.clear()
        avg_volumes.update(fresh)
        logger.info("ADV refreshed — %d symbols", len(avg_volumes))

    def market_scan_job() -> None:
        run_market_scan(
            state=state,
            cfg=cfg,
            data_client=data_client,
            executor=executor,
            watchlist=watchlist,
            avg_volumes=avg_volumes,
        )

    def intraday_monitor_job() -> None:
        run_intraday_monitor(
            state=state,
            cfg=cfg,
            data_client=data_client,
            executor=executor,
        )

    def intraday_scan_job() -> None:
        run_intraday_scan(
            state=state,
            cfg=cfg,
            data_client=data_client,
            executor=executor,
            watchlist=watchlist,
            avg_volumes=avg_volumes,
        )

    def eod_liquidation_job() -> None:
        run_eod_liquidation(state=state, executor=executor)

    logger.info(
        "Day Trader starting — Gap and Go (9:31 AM open) + ORB breakout (9:32 AM-3:54 PM), "
        "%d stocks, gap≥%.1f%%, RVOL≥%.1f, max_positions=%d, position_size=%.0f%%, orb_minutes=%d",
        len(watchlist), cfg.gap_threshold * 100, cfg.rvol_threshold,
        cfg.max_positions, cfg.position_size_pct * 100, cfg.orb_minutes,
    )

    start_scheduler(
        run_market_scan=market_scan_job,
        run_intraday_monitor=intraday_monitor_job,
        run_intraday_scan=intraday_scan_job,
        run_eod_liquidation=eod_liquidation_job,
        refresh_adv=refresh_adv_job,
    )


if __name__ == "__main__":
    main()
