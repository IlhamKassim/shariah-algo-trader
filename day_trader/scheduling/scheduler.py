import logging
from typing import Callable

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)

_TIMEZONE = "America/New_York"


def start_scheduler(
    run_market_scan: Callable,
    run_intraday_monitor: Callable,
    run_eod_liquidation: Callable,
) -> None:
    """Start the day-trading scheduler.

    Schedule (all times ET, Mon–Fri only):
    - 10:00 AM — market scan (compute ORB, enter initial breakouts)
    - 10:01 AM – 3:54 PM — intraday monitor every minute (stops + late entries)
    - 3:55 PM — EOD liquidation (close all, no overnight holds)
    """
    scheduler = BlockingScheduler(timezone=_TIMEZONE)

    def _safe(fn: Callable, name: str) -> Callable:
        def wrapper():
            try:
                fn()
            except Exception as exc:
                logger.error("%s failed: %s", name, exc, exc_info=True)
        return wrapper

    # 10:00 AM — ORB scan
    scheduler.add_job(
        func=_safe(run_market_scan, "MarketScan"),
        trigger=CronTrigger(day_of_week="mon-fri", hour=10, minute=0, timezone=_TIMEZONE),
    )

    # 10:01–10:59 AM — avoid firing at the same instant as market scan at 10:00
    scheduler.add_job(
        func=_safe(run_intraday_monitor, "IntradayMonitor"),
        trigger=CronTrigger(
            day_of_week="mon-fri",
            hour=10,
            minute="1-59",
            timezone=_TIMEZONE,
        ),
    )
    # 11:00 AM – 3:54 PM (intraday_monitor guards against new entries after 15:00)
    scheduler.add_job(
        func=_safe(run_intraday_monitor, "IntradayMonitor"),
        trigger=CronTrigger(
            day_of_week="mon-fri",
            hour="11-15",
            minute="0-54",
            timezone=_TIMEZONE,
        ),
    )

    # 3:55 PM — EOD close
    scheduler.add_job(
        func=_safe(run_eod_liquidation, "EODLiquidation"),
        trigger=CronTrigger(day_of_week="mon-fri", hour=15, minute=55, timezone=_TIMEZONE),
    )

    logger.info(
        "Day-trader scheduler started — scan 10:00, monitor 10:01–15:54, EOD 15:55 ET (Mon–Fri)"
    )
    scheduler.start()
