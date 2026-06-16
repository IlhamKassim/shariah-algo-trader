import datetime
import os
import re
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends

from dashboard.api.deps import get_config
from dashboard.api.models import StatusResponse
from shariah_algo_trader.config import Config
from shariah_algo_trader.scheduling.trading_calendar import is_trading_day

router = APIRouter()

_LOG_PATH = os.environ.get("TRADER_LOG", "/tmp/shariah-trader.err")
_ET = ZoneInfo("America/New_York")
_STARTUP_RE = re.compile(r"Shariah Algo Trader starting")
_TS_RE = re.compile(r"^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})")


def _parse_last_started(log_path: str) -> str | None:
    try:
        with open(log_path) as f:
            lines = f.readlines()
    except OSError:
        return None
    for line in reversed(lines):
        if _STARTUP_RE.search(line):
            m = _TS_RE.match(line)
            if m:
                return m.group(1)
    return None


def _next_fire_at() -> str | None:
    job_time = os.environ.get("JOB_TIME", "09:30")
    hour, minute = (int(x) for x in job_time.split(":"))
    now_et = datetime.datetime.now(tz=_ET)
    candidate = now_et.date()
    fire_today = now_et.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if now_et >= fire_today:
        candidate += datetime.timedelta(days=1)
    for _ in range(14):
        if is_trading_day(candidate):
            next_dt = datetime.datetime(candidate.year, candidate.month, candidate.day,
                                        hour, minute, tzinfo=_ET)
            return next_dt.isoformat()
        candidate += datetime.timedelta(days=1)
    return None


@router.get("/api/status", response_model=StatusResponse)
def get_status(cfg: Config = Depends(get_config)) -> StatusResponse:
    return StatusResponse(
        scheduler_running=True,
        last_started_at=_parse_last_started(_LOG_PATH),
        next_fire_at=_next_fire_at(),
        etf_symbol=cfg.etf_symbol,
        top_n=cfg.top_n,
        broker_url=cfg.alpaca_base_url,
    )
