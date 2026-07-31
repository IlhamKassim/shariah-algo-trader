import datetime
import logging
import threading
import time
from typing import Any, Callable
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel

from dashboard.api.deps import get_config
from shariah_algo_trader.config import Config
from shariah_algo_trader.execution.tenant_manager import trigger_single_tenant_rebalance

router = APIRouter()
logger = logging.getLogger(__name__)

# In-memory background job tracking by user_id
_job_status: dict[str, dict[str, Any]] = {}
_job_lock = threading.Lock()

# Ordered list of steps with estimated durations (in seconds) for the progress bar
_REBALANCE_STEPS = [
    ("universe",  "Fetching Shariah universe tickers (SPUS/HLAL)..."),
    ("momentum",  "Computing Momentum Factor (12-1 month returns)..."),
    ("quality",   "Computing Quality Factor (ROE, margins, AAOIFI debt screen)..."),
    ("volatility","Computing Volatility & Value Factors..."),
    ("ranking",   "Ranking top stocks by composite factor score..."),
    ("orders",    "Submitting orders to Alpaca..."),
    ("done",      "Finalising rebalance and recording audit log..."),
]


class RebalanceResponse(BaseModel):
    user_id: str
    rebalance_submitted: bool
    status: str
    accounts_processed: int
    results: list[dict[str, Any]]
    executed_at: str
    message: str


def _run_rebalance_background(user_id: str, cfg: Config) -> None:
    started_at = datetime.datetime.now(datetime.timezone.utc)
    started_ts = time.monotonic()

    def _progress(step_key: str, step_number: int) -> None:
        """Update the in-memory job status with the current step."""
        step_label = next(
            (label for key, label in _REBALANCE_STEPS if key == step_key),
            step_key,
        )
        elapsed = round(time.monotonic() - started_ts)
        _job_status[user_id] = {
            "status": "running",
            "rebalance_submitted": True,
            "started_at": started_at.isoformat(),
            "step_key": step_key,
            "step_number": step_number,
            "total_steps": len(_REBALANCE_STEPS),
            "elapsed_seconds": elapsed,
            "message": step_label,
            "steps": [key for key, _ in _REBALANCE_STEPS],
        }

    # Emit initial state immediately so the UI sees "running" on first poll
    _progress("universe", 1)

    try:
        res = trigger_single_tenant_rebalance(
            user_id=user_id,
            cfg=cfg,
            progress_callback=_progress,
        )
        elapsed = round(time.monotonic() - started_ts)
        _job_status[user_id] = {
            "status": "completed",
            "rebalance_submitted": True,
            "accounts_processed": res.get("accounts_processed", 1),
            "results": res.get("results", []),
            "executed_at": res.get("executed_at"),
            "completed_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "elapsed_seconds": elapsed,
            "message": f"Rebalance complete in {elapsed}s — orders submitted to Alpaca!",
        }
    except Exception as exc:
        elapsed = round(time.monotonic() - started_ts)
        logger.error("Background rebalance error for user %s: %s", user_id, exc, exc_info=True)
        _job_status[user_id] = {
            "status": "failed",
            "rebalance_submitted": False,
            "error": str(exc),
            "completed_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "elapsed_seconds": elapsed,
            "message": f"Rebalance failed after {elapsed}s: {exc}",
        }


@router.post("/api/rebalance/run", response_model=RebalanceResponse)
def trigger_manual_rebalance(
    request: Request,
    background_tasks: BackgroundTasks,
    cfg: Config = Depends(get_config),
) -> RebalanceResponse:
    """Trigger background manual portfolio allocation/rebalance for the logged-in user."""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="User authentication required")

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    with _job_lock:
        current = _job_status.get(user_id)
        if current and current.get("status") == "running":
            return RebalanceResponse(
                user_id=user_id,
                rebalance_submitted=True,
                status="running",
                accounts_processed=1,
                results=[],
                executed_at=current.get("started_at", ""),
                message="Rebalance execution is currently in progress...",
            )
        # Mark as running synchronously so a concurrent duplicate request
        # can't slip past the check above before the background task starts.
        _job_status[user_id] = {
            "status": "running",
            "rebalance_submitted": True,
            "started_at": now,
        }

    background_tasks.add_task(_run_rebalance_background, user_id, cfg)

    return RebalanceResponse(
        user_id=user_id,
        rebalance_submitted=True,
        status="running",
        accounts_processed=1,
        results=[],
        executed_at=now,
        message="Rebalance task started in background.",
    )


@router.get("/api/rebalance/status")
def get_rebalance_status(request: Request) -> dict[str, Any]:
    """Check status of active or recent rebalance job for logged-in user.

    Returns granular step progress including:
    - status: 'idle' | 'running' | 'completed' | 'failed'
    - step_key: current step identifier
    - step_number: 1-based step index
    - total_steps: total number of steps
    - elapsed_seconds: seconds since job started
    - message: human-readable description of current step
    """
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="User authentication required")
    return _job_status.get(user_id, {"status": "idle"})
