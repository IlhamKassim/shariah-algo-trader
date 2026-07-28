import logging
from fastapi import APIRouter, Depends
from starlette.requests import Request
from pydantic import BaseModel

from dashboard.api.db import fetch_audit_logs
from dashboard.api.deps import get_config, verify_auth
from dashboard.api.sanity_check import run_performance_sanity_check
from shariah_algo_trader.config import Config

router = APIRouter()
logger = logging.getLogger(__name__)


class SanityCheckResponse(BaseModel):
    user_id: str
    status: str
    is_realistic: bool
    trading_mode: str | None = None
    latest_date: str | None = None
    strategy_cumulative_return: float | None = None
    spus_cumulative_return: float | None = None
    sp500_cumulative_return: float | None = None
    total_alpha: float | None = None
    latest_strategy_daily_return: float | None = None
    latest_spus_daily_return: float | None = None
    latest_sp500_daily_return: float | None = None
    daily_alpha_drift: float | None = None
    anomalies: list[str] = []
    checked_at: str


@router.post("/api/sanity-check", response_model=SanityCheckResponse)
def trigger_sanity_check(
    request: Request,
    cfg: Config = Depends(get_config),
) -> SanityCheckResponse:
    """Run an end-of-market performance sanity audit on the user's paper or live account."""
    user_id = getattr(request.state, "user_id", None) or "system_default"
    result = run_performance_sanity_check(user_id=user_id, cfg=cfg)
    return SanityCheckResponse(**result)


@router.get("/api/sanity-check/status")
def get_sanity_check_status(
    request: Request,
) -> dict:
    """Retrieve the latest performance sanity check audit log entry for the current user."""
    user_id = getattr(request.state, "user_id", None) or "system_default"
    audit_logs = fetch_audit_logs(limit=50)

    user_sanity_logs = [
        dict(log) for log in audit_logs
        if log["event_type"] == "performance_sanity_check" and log["actor"] == user_id
    ]

    if not user_sanity_logs:
        return {
            "has_run": False,
            "last_check": None,
            "message": "No sanity checks executed yet for this account.",
        }

    latest = user_sanity_logs[0]
    return {
        "has_run": True,
        "last_check": latest["created_at"],
        "details": latest["details"],
    }
