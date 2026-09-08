import datetime
from zoneinfo import ZoneInfo

from shariah_algo_trader.execution.alpaca_client import AlpacaClient, AlpacaError

_ET = ZoneInfo("America/New_York")


def live_account(client: AlpacaClient | None) -> tuple[str | None, float | None]:
    """Return ``(broker_account_id, equity)`` from a single /v2/account call.

    The broker account id is what keys the NAV store (ADR-0010): equity from
    two different Alpaca accounts must never merge into one curve, which is
    what happens if the store is keyed by app user alone.
    """
    if client is None:
        return None, None
    try:
        acct = client.get("/v2/account")
    except AlpacaError:
        return None, None
    account_id = acct.get("id") or None
    equity = float(acct.get("equity", 0))
    return account_id, (equity if equity > 0 else None)


def live_equity(client: AlpacaClient | None) -> float | None:
    return live_account(client)[1]


def patch_today(
    dates: list[str], equities: list[float], equity_now: float | None
) -> tuple[list[str], list[float]]:
    """Overwrite (or append) today's bar with live /v2/account equity.

    Alpaca's portfolio/history endpoint lags the live account for the
    current trading day — its last bar can read stale by up to a full
    session, which disagrees with panels that call /v2/account directly.
    """
    if equity_now is None:
        return dates, equities
    today = datetime.datetime.now(_ET).date().isoformat()
    if dates and dates[-1] == today:
        return dates[:-1] + [today], equities[:-1] + [equity_now]
    return dates + [today], equities + [equity_now]


def ts_to_date(ts: float) -> str:
    """Convert an Alpaca epoch timestamp to its UTC calendar date (ISO).

    Alpaca returns epoch timestamps; interpreting them in UTC gives a stable,
    server-timezone-independent label for each daily bar. This replaces the
    previous mix of server-local time (performance, sanity) and UTC (compare),
    which let bar dates drift by a day depending on the host machine's clock.
    """
    return datetime.datetime.fromtimestamp(ts, tz=datetime.timezone.utc).date().isoformat()
