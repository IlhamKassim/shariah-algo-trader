import datetime
import logging
import os
from typing import Callable

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

from shariah_algo_trader.scheduling.trading_calendar import (
    is_trading_day as _is_trading_day,
    is_first_trading_day_of_month as _is_first_trading_day,
)

logger = logging.getLogger(__name__)


def run_daily_jobs(
    date: datetime.date,
    run_compliance_check: Callable,
    run_rebalance: Callable,
    is_trading_day: Callable = _is_trading_day,
    is_first_trading_day: Callable = _is_first_trading_day,
) -> None:
    """Dispatch the Compliance Check and (on the first trading day) the Rebalance.

    Exceptions from either job are caught and logged — a single job failure
    must not kill the Scheduler process.
    """
    if not is_trading_day(date):
        return

    try:
        run_compliance_check()
    except Exception as exc:
        logger.error("Compliance Check failed: %s", exc, exc_info=True)

    if is_first_trading_day(date):
        try:
            run_rebalance()
        except Exception as exc:
            logger.error("Rebalance failed: %s", exc, exc_info=True)


def start_scheduler(
    run_compliance_check: Callable,
    run_rebalance: Callable,
) -> None:
    """Start the long-running Scheduler process.

    Fires run_daily_jobs every weekday at the configured time (default 09:30 ET).
    Reads JOB_TIME (HH:MM, default 09:30) and JOB_TIMEZONE (default America/New_York)
    from environment variables.
    """
    job_time = os.environ.get("JOB_TIME", "09:30")
    timezone = os.environ.get("JOB_TIMEZONE", "America/New_York")
    hour, minute = job_time.split(":")

    scheduler = BlockingScheduler(timezone=timezone)
    scheduler.add_job(
        func=lambda: run_daily_jobs(
            datetime.date.today(),
            run_compliance_check=run_compliance_check,
            run_rebalance=run_rebalance,
        ),
        trigger=CronTrigger(
            day_of_week="mon-fri",
            hour=int(hour),
            minute=int(minute),
            timezone=timezone,
        ),
    )
    logger.info("Scheduler started — firing at %s:%s %s (Mon–Fri)", hour, minute, timezone)
    scheduler.start()
