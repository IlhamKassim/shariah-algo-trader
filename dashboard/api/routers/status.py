import datetime
import logging
import os
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends

from dashboard.api.deps import get_alpaca, get_config
from dashboard.api.models import StatusResponse
from shariah_algo_trader.config import Config
from shariah_algo_trader.execution.alpaca_client import AlpacaClient, AlpacaError
from shariah_algo_trader.scheduling.trading_calendar import is_trading_day

router = APIRouter()
logger = logging.getLogger(__name__)

_ET = ZoneInfo("America/New_York")
# If any order was placed within this window, consider the bot alive.
_BOT_ALIVE_WINDOW_DAYS = 7


def _bot_health(client: AlpacaClient) -> tuple[bool, str | None]:
    """Infer bot liveness from the most recent Alpaca order.

    Cross-container process detection (pgrep) is not available on Render.
    Using recent order activity is the most reliable cross-container proxy.
    """
    try:
        orders = client.get("/v2/orders?status=all&limit=1&direction=desc")
        if not isinstance(orders, list) or not orders:
            return False, None
        created_at = orders[0].get("created_at", "")
        if not created_at:
            return False, None
        ts = datetime.datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        cutoff = datetime.datetime.now(tz=datetime.timezone.utc) - datetime.timedelta(
            days=_BOT_ALIVE_WINDOW_DAYS
        )
        return ts >= cutoff, ts.strftime("%Y-%m-%d %H:%M:%S")
    except AlpacaError as exc:
        logger.warning("Bot health check failed: %s", exc)
        return False, None


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
            next_dt = datetime.datetime(
                candidate.year, candidate.month, candidate.day, hour, minute, tzinfo=_ET
            )
            return next_dt.isoformat()
        candidate += datetime.timedelta(days=1)
    return None


@router.get("/api/status", response_model=StatusResponse)
def get_status(cfg: Config = Depends(get_config)) -> StatusResponse:
    client = get_alpaca()
    is_alive, last_activity_at = _bot_health(client)
    return StatusResponse(
        scheduler_running=is_alive,
        last_started_at=last_activity_at,
        next_fire_at=_next_fire_at(),
        etf_symbol=cfg.etf_symbol,
        top_n=cfg.top_n,
        broker_url=cfg.alpaca_base_url,
    )
