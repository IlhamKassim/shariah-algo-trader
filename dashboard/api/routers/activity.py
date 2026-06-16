import os
import re
from typing import Optional

from fastapi import APIRouter, Query

from dashboard.api.models import ActivityEntry, ActivityResponse

router = APIRouter()

_LOG_PATH = os.environ.get("TRADER_LOG", "/tmp/shariah-trader.err")
_LINE_RE = re.compile(
    r"^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d+)\s+(\w+)\s+(\S+)\s+—\s+(.+)$"
)
_TICKER_RE = re.compile(r"\b([A-Z]{1,5})\b")


def _classify(module: str, level: str) -> str:
    if "compliance_check" in module:
        return "compliance"
    if "rebalance" in module:
        return "rebalance"
    if "order_executor" in module:
        return "order"
    if level in ("ERROR", "WARNING"):
        return "error"
    return "system"


def _extract_tickers(message: str) -> list[str]:
    # Pull out capitalised short words that look like tickers, excluding known non-ticker words
    _EXCLUDE = {"BUY", "SELL", "INFO", "ERROR", "WARNING", "DEBUG", "FULL", "HTTP"}
    return [t for t in _TICKER_RE.findall(message) if t not in _EXCLUDE]


def _parse_log(log_path: str, max_lines: int = 500) -> list[ActivityEntry]:
    try:
        with open(log_path) as f:
            lines = f.readlines()
    except OSError:
        return []

    entries: list[ActivityEntry] = []
    for line in reversed(lines[-max_lines:]):
        m = _LINE_RE.match(line.rstrip())
        if not m:
            continue
        ts, level, module, message = m.groups()
        entries.append(ActivityEntry(
            timestamp=ts,
            level=level,
            type=_classify(module, level),
            message=message,
            tickers=_extract_tickers(message),
        ))
    return entries


@router.get("/api/activity", response_model=ActivityResponse)
def get_activity(
    type: Optional[str] = Query(default=None),
    date: Optional[str] = Query(default=None),
) -> ActivityResponse:
    entries = _parse_log(_LOG_PATH)
    if type:
        entries = [e for e in entries if e.type == type]
    if date:
        entries = [e for e in entries if e.timestamp.startswith(date)]
    return ActivityResponse(entries=entries)
