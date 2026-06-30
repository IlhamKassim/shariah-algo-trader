import datetime
import logging
from typing import Callable

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

from shariah_algo_trader.scheduling.trading_calendar import is_trading_day

logger = logging.getLogger(__name__)

_TIMEZONE = "America/New_York"


def start_scheduler(
    run_market_scan: Callable,
    run_intraday_monitor: Callable,
    run_eod_liquidation: Callable,
    refresh_adv: Callable | None = None,
) -> None:
    """Start the day-trading scheduler.

    Schedule (all times ET, Mon–Fri non-holidays only):
    - 9:00 AM  — Refresh average daily volumes
    - 9:31 AM  — Gap and Go open scan (enter gapping stocks right at open)
    - 9:32 AM – 3:54 PM — intraday monitor every minute (stops + profit targets)
    - 3:55 PM  — EOD liquidation (close all, no overnight holds)
    """
    scheduler = BlockingScheduler(timezone=_TIMEZONE)

    def _safe(fn: Callable, name: str) -> Callable:
        def wrapper():
            if not is_trading_day(datetime.date.today()):
                logger.info("%s skipped — market holiday", name)
                return
            try:
                fn()
            except Exception as exc:
                logger.error("%s failed: %s", name, exc, exc_info=True)
        return wrapper

    # 9:00 AM — Refresh ADV before open
    if refresh_adv is not None:
        scheduler.add_job(
            func=_safe(refresh_adv, "RefreshADV"),
            trigger=CronTrigger(day_of_week="mon-fri", hour=9, minute=0, timezone=_TIMEZONE),
        )

    # 9:31 AM — Gap and Go open scan
    scheduler.add_job(
        func=_safe(run_market_scan, "MarketOpenScan"),
        trigger=CronTrigger(day_of_week="mon-fri", hour=9, minute=31, timezone=_TIMEZONE),
    )

    # 9:32–9:59 AM
    scheduler.add_job(
        func=_safe(run_intraday_monitor, "IntradayMonitor"),
        trigger=CronTrigger(
            day_of_week="mon-fri",
            hour=9,
            minute="32-59",
            timezone=_TIMEZONE,
        ),
    )
    # 10:00 AM – 3:54 PM
    scheduler.add_job(
        func=_safe(run_intraday_monitor, "IntradayMonitor"),
        trigger=CronTrigger(
            day_of_week="mon-fri",
            hour="10-15",
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
        "Day-trader scheduler started — ADV refresh 9:00, scan 9:31, monitor 9:32–15:54, EOD 15:55 ET (Mon–Fri, NYSE holidays excluded)"
    )
    scheduler.start()
