import logging
import sys

from day_trader.config import DayTraderConfig
from day_trader.data.alpaca_data import fetch_avg_daily_volume
from day_trader.data.watchlist import get_watchlist
from day_trader.execution.order_executor import DayOrderExecutor
from day_trader.jobs.eod_liquidation import run_eod_liquidation
from day_trader.jobs.intraday_monitor import run_intraday_monitor
from day_trader.jobs.market_scan import run_market_scan
from day_trader.scheduling.scheduler import start_scheduler
from day_trader.state import state
from shariah_algo_trader.execution.alpaca_client import AlpacaClient

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

    def market_scan_job() -> None:
        run_market_scan(
            state=state,
            cfg=cfg,
            trading_client=trading_client,
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

    def eod_liquidation_job() -> None:
        run_eod_liquidation(state=state, executor=executor)

    logger.info(
        "Day Trader starting — max_positions=%d, position_size=%.0f%%, "
        "stop_loss=%.1f%%, trailing_stop=%.1f%%, ORB=%dmin",
        cfg.max_positions, cfg.position_size_pct * 100,
        cfg.stop_loss_pct * 100, cfg.trailing_stop_pct * 100, cfg.orb_minutes,
    )

    start_scheduler(
        run_market_scan=market_scan_job,
        run_intraday_monitor=intraday_monitor_job,
        run_eod_liquidation=eod_liquidation_job,
    )


if __name__ == "__main__":
    main()
