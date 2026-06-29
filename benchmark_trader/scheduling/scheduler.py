import logging
from zoneinfo import ZoneInfo

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

from benchmark_trader.config import BenchmarkConfig
from benchmark_trader.jobs.eod_liquidation import run_eod_liquidation
from benchmark_trader.jobs.intraday_monitor import run_intraday_monitor
from benchmark_trader.jobs.market_open_scan import run_market_open_scan
from benchmark_trader.state import state
from day_trader.data.alpaca_data import fetch_avg_daily_volume
from day_trader.execution.order_executor import DayOrderExecutor
from shariah_algo_trader.execution.alpaca_client import AlpacaClient

logger = logging.getLogger(__name__)

_ET = ZoneInfo("America/New_York")


def start(cfg: BenchmarkConfig, watchlist: list[str]) -> None:
    trading_client = AlpacaClient(cfg.base_url, cfg.api_key, cfg.api_secret)
    data_client = AlpacaClient(cfg.data_url, cfg.api_key, cfg.api_secret)
    executor = DayOrderExecutor(trading_client)

    logger.info("Fetching 30-day ADV for %d benchmark watchlist stocks…", len(watchlist))
    avg_volumes = fetch_avg_daily_volume(data_client, watchlist)
    logger.info("ADV ready for %d/%d symbols", len(avg_volumes), len(watchlist))

    scheduler = BlockingScheduler(timezone=_ET)

    # 9:31 AM — enter gaps right after the first price prints
    scheduler.add_job(
        run_market_open_scan,
        CronTrigger(hour=9, minute=31, timezone=_ET),
        args=[state, cfg, trading_client, data_client, executor, watchlist, avg_volumes],
        id="market_open_scan",
        name="Gap and Go open scan",
    )

    # 9:32 AM – 3:54 PM every minute — manage stops and profit targets
    scheduler.add_job(
        run_intraday_monitor,
        CronTrigger(hour="9-15", minute="32-59", timezone=_ET),
        args=[state, cfg, data_client, executor],
        id="intraday_monitor_early",
        name="Intraday monitor (9:32–9:59)",
    )
    scheduler.add_job(
        run_intraday_monitor,
        CronTrigger(hour="10-14", minute="*", timezone=_ET),
        args=[state, cfg, data_client, executor],
        id="intraday_monitor_mid",
        name="Intraday monitor (10:00–14:59)",
    )
    scheduler.add_job(
        run_intraday_monitor,
        CronTrigger(hour=15, minute="0-54", timezone=_ET),
        args=[state, cfg, data_client, executor],
        id="intraday_monitor_late",
        name="Intraday monitor (15:00–15:54)",
    )

    # 3:55 PM — liquidate everything
    scheduler.add_job(
        run_eod_liquidation,
        CronTrigger(hour=15, minute=55, timezone=_ET),
        args=[state, executor],
        id="eod_liquidation",
        name="EOD liquidation",
    )

    logger.info("Benchmark scheduler started — Gap and Go strategy, %d stocks", len(watchlist))
    scheduler.start()
