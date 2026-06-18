import datetime
import logging
from zoneinfo import ZoneInfo

from shariah_algo_trader.execution.alpaca_client import AlpacaClient

logger = logging.getLogger(__name__)

ET = ZoneInfo("America/New_York")
_FEED = "iex"  # free feed; upgrade to "sip" with a paid Alpaca subscription


def _et_to_rfc3339(dt: datetime.datetime) -> str:
    return dt.astimezone(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def fetch_opening_range_bars(
    client: AlpacaClient,
    symbols: list[str],
    orb_minutes: int = 30,
) -> dict[str, list[dict]]:
    """Fetch 1-minute bars for the opening range window for today.

    Returns {symbol: [bar, ...]} where each bar has keys: t, o, h, l, c, v.
    """
    today = datetime.date.today()
    market_open = datetime.datetime(today.year, today.month, today.day, 9, 30, tzinfo=ET)
    range_end = market_open + datetime.timedelta(minutes=orb_minutes)

    params = (
        f"symbols={','.join(symbols)}"
        f"&timeframe=1Min"
        f"&start={_et_to_rfc3339(market_open)}"
        f"&end={_et_to_rfc3339(range_end)}"
        f"&limit=10000"
        f"&feed={_FEED}"
        f"&sort=asc"
    )

    try:
        response = client.get(f"/v2/stocks/bars?{params}")
        return response.get("bars", {})
    except Exception as exc:
        logger.error("Failed to fetch opening range bars: %s", exc)
        return {}


def fetch_latest_prices(
    client: AlpacaClient,
    symbols: list[str],
) -> dict[str, float]:
    """Fetch the latest trade price for each symbol.

    Returns {symbol: price}.
    """
    params = f"symbols={','.join(symbols)}&feed={_FEED}"
    try:
        response = client.get(f"/v2/stocks/trades/latest?{params}")
        trades = response.get("trades", {})
        return {sym: float(data["p"]) for sym, data in trades.items() if "p" in data}
    except Exception as exc:
        logger.error("Failed to fetch latest prices: %s", exc)
        return {}


def fetch_current_day_volume(
    client: AlpacaClient,
    symbols: list[str],
) -> dict[str, int]:
    """Fetch total volume traded so far today for each symbol.

    Returns {symbol: volume}.
    """
    params = f"symbols={','.join(symbols)}&feed={_FEED}"
    try:
        response = client.get(f"/v2/stocks/snapshots?{params}")
        snapshots = response.get("snapshots", response)
        result: dict[str, int] = {}
        for sym, snap in snapshots.items():
            daily = snap.get("dailyBar") or {}
            v = daily.get("v", 0)
            result[sym] = int(v)
        return result
    except Exception as exc:
        logger.error("Failed to fetch day volumes: %s", exc)
        return {}
