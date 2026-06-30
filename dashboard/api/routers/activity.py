import datetime
import logging
from typing import Optional

from fastapi import APIRouter, Query

from dashboard.api.deps import get_alpaca
from dashboard.api.models import ActivityEntry, ActivityResponse
from shariah_algo_trader.execution.alpaca_client import AlpacaError

router = APIRouter()
logger = logging.getLogger(__name__)

_PAGE_SIZE = 100


def _fetch_activities() -> list[ActivityEntry]:
    """Fetch recent trade fills from Alpaca /v2/account/activities."""
    client = get_alpaca()
    entries: list[ActivityEntry] = []
    try:
        data = client.get(f"/v2/account/activities?activity_type=FILL&page_size={_PAGE_SIZE}")
        if not isinstance(data, list):
            return []
        for act in data:
            ts_raw = act.get("transaction_time", "")
            try:
                ts = datetime.datetime.fromisoformat(
                    ts_raw.replace("Z", "+00:00")
                ).strftime("%Y-%m-%dT%H:%M:%S.000Z")
            except (ValueError, AttributeError):
                ts = ts_raw
            symbol = act.get("symbol", "")
            side = act.get("side", "").upper()
            price = act.get("price", "")
            qty = act.get("qty", "")
            message = f"{side} {symbol} — {qty} shares @ ${price}"
            entries.append(ActivityEntry(
                timestamp=ts,
                level="INFO",
                type="order",
                message=message,
                tickers=[symbol] if symbol else [],
            ))
    except AlpacaError as exc:
        logger.warning("Activity fetch failed: %s", exc)
    return entries


@router.get("/api/activity", response_model=ActivityResponse)
def get_activity(
    type: Optional[str] = Query(default=None),
    date: Optional[str] = Query(default=None),
) -> ActivityResponse:
    entries = _fetch_activities()
    if type and type != "order":
        # All Alpaca activities are trade orders; other type filters return empty
        entries = []
    if date:
        entries = [e for e in entries if e.timestamp.startswith(date)]
    return ActivityResponse(entries=entries)
