import datetime

from shariah_algo_trader.execution.alpaca_client import AlpacaClient, AlpacaError

_ET = datetime.timezone(datetime.timedelta(hours=-4))  # EDT


def live_equity(client: AlpacaClient) -> float | None:
    try:
        acct = client.get("/v2/account")
        equity = float(acct.get("equity", 0))
        return equity if equity > 0 else None
    except AlpacaError:
        return None


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
