import datetime
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query

from dashboard.api.deps import get_alpaca
from dashboard.api.models import ActivityEntry, ActivityResponse
from shariah_algo_trader.execution.alpaca_client import AlpacaClient, AlpacaError

router = APIRouter()
logger = logging.getLogger(__name__)

_PAGE_SIZE = 100


def _fetch_activities(client: AlpacaClient | None) -> list[ActivityEntry]:
    """Fetch recent trade fills from Alpaca /v2/account/activities."""
    if not client:
        return []
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

            # Keep the parsed numbers alongside the message so the ledger can
            # total and filter without re-parsing prose.
            try:
                qty_f = float(qty) if qty not in (None, "") else None
            except (TypeError, ValueError):
                qty_f = None
            try:
                price_f = float(price) if price not in (None, "") else None
            except (TypeError, ValueError):
                price_f = None

            entries.append(ActivityEntry(
                timestamp=ts,
                level="INFO",
                type="order",
                message=message,
                tickers=[symbol] if symbol else [],
                symbol=symbol or None,
                side=side or None,
                qty=qty_f,
                price=price_f,
                notional=round(qty_f * price_f, 2) if qty_f is not None and price_f is not None else None,
            ))
    except AlpacaError as exc:
        logger.warning("Activity fetch failed: %s", exc)
    return entries


def annotate_realized_pl(entries: list[ActivityEntry]) -> list[ActivityEntry]:
    """Match each SELL against earlier BUYs FIFO and attach realized P&L.

    Cost basis is derivable from the fill stream itself, so this needs no
    position or lot tracking elsewhere. The window is finite (``_PAGE_SIZE``
    fills), so a sell can close shares that were bought before it starts. Those
    keep ``realized_pl=None`` — "not derivable" — rather than being reported as
    a profit measured from an imaginary zero-cost lot.

    Entries are annotated in place order-independently: FIFO needs oldest-first,
    but the returned list preserves the caller's ordering.
    """
    lots: dict[str, list[list[float]]] = {}  # symbol -> [[qty, price], ...]

    for e in sorted(entries, key=lambda x: x.timestamp):
        if not e.symbol or e.qty is None or e.price is None or e.qty <= 0:
            continue
        side = (e.side or "").upper()

        if side == "BUY":
            lots.setdefault(e.symbol, []).append([e.qty, e.price])
            continue
        if side != "SELL":
            continue

        remaining = e.qty
        matched_qty = 0.0
        matched_cost = 0.0
        queue = lots.get(e.symbol, [])
        while remaining > 1e-9 and queue:
            lot = queue[0]
            take = min(lot[0], remaining)
            matched_qty += take
            matched_cost += take * lot[1]
            lot[0] -= take
            remaining -= take
            if lot[0] <= 1e-9:
                queue.pop(0)

        # Partially (or wholly) unmatched: the opening trade predates the window.
        if remaining > 1e-9 or matched_qty <= 0:
            continue

        avg_cost = matched_cost / matched_qty
        e.cost_basis = round(avg_cost, 4)
        e.realized_pl = round((e.price - avg_cost) * matched_qty, 2)
        e.realized_pl_pct = round((e.price / avg_cost - 1) * 100, 4) if avg_cost else None

    return entries


@router.get("/api/activity", response_model=ActivityResponse)
def get_activity(
    type: Optional[str] = Query(default=None),
    date: Optional[str] = Query(default=None),
    client: AlpacaClient | None = Depends(get_alpaca),
) -> ActivityResponse:
    entries = _fetch_activities(client)
    if type and type != "order":
        # All Alpaca activities are trade orders; other type filters return empty
        entries = []
    # Match lots before any date filter: a sell's cost basis lives in earlier
    # fills, which a single-day filter would otherwise hide.
    entries = annotate_realized_pl(entries)
    if date:
        entries = [e for e in entries if e.timestamp.startswith(date)]
    return ActivityResponse(entries=entries)
