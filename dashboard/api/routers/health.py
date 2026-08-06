"""Public health-check endpoint for uptime monitoring.

GET /health -> 200 JSON when the dashboard is alive and its SQLite user
store is reachable; 503 JSON otherwise. Intentionally dependency-light
(no broker calls, no heavy imports) so external monitors (UptimeRobot,
Hermes watchdog cron) can poll it every few minutes without side effects
or rate-limit pressure on the Alpaca API.

Public by design: uptime monitors cannot authenticate. It exposes no
user data — only liveness + a boolean db check.
"""

import datetime
import logging
import sqlite3
import time

from fastapi import APIRouter, Response

logger = logging.getLogger(__name__)

router = APIRouter()

SERVICE = "shariah-trader-dashboard"
VERSION = "0.1.0"
_STARTED_AT = time.time()


def _db_reachable() -> bool:
    """User store (SQLite) exists and answers a trivial query."""
    try:
        from dashboard.api.user_store import _DB_PATH

        if not _DB_PATH.exists():
            return False
        conn = sqlite3.connect(str(_DB_PATH), timeout=2)
        try:
            conn.execute("SELECT 1")
        finally:
            conn.close()
        return True
    except Exception as exc:
        logger.warning("health: user store check failed: %s", exc)
        return False


@router.get("/health")
def health(response: Response) -> dict:
    db_ok = _db_reachable()
    body = {
        "status": "ok" if db_ok else "degraded",
        "service": SERVICE,
        "version": VERSION,
        "time": datetime.datetime.now(datetime.timezone.utc).isoformat(
            timespec="seconds"
        ),
        "uptime_seconds": int(time.time() - _STARTED_AT),
        "checks": {"db": "ok" if db_ok else "fail"},
    }
    if not db_ok:
        response.status_code = 503
    return body
