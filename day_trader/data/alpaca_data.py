import datetime
import logging
import os
from zoneinfo import ZoneInfo

from shariah_algo_trader.execution.alpaca_client import AlpacaClient

logger = logging.getLogger(__name__)

ET = ZoneInfo("America/New_York")
_FEED = os.environ.get("ALPACA_FEED", "iex")  # set to "sip" with a paid Alpaca subscription


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


def fetch_recent_bars(
    client: AlpacaClient,
    symbols: list[str],
    lookback_minutes: int = 5,
) -> dict[str, list[dict]]:
    """Fetch 1-minute bars for a rolling trailing window ending now.

    Used by the all-day ORB breakout scanner to compute a rolling volume rate,
    as opposed to fetch_opening_range_bars' fixed 9:30 AM window.

    Returns {symbol: [bar, ...]} where each bar has keys: t, o, h, l, c, v.
    """
    now = datetime.datetime.now(tz=ET)
    start = now - datetime.timedelta(minutes=lookback_minutes)

    params = (
        f"symbols={','.join(symbols)}"
        f"&timeframe=1Min"
        f"&start={_et_to_rfc3339(start)}"
        f"&end={_et_to_rfc3339(now)}"
        f"&limit=10000"
        f"&feed={_FEED}"
        f"&sort=asc"
    )

    try:
        response = client.get(f"/v2/stocks/bars?{params}")
        return response.get("bars", {})
    except Exception as exc:
        logger.error("Failed to fetch recent bars: %s", exc)
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


def fetch_prev_close(
    client: AlpacaClient,
    symbols: list[str],
) -> dict[str, float]:
    """Fetch the most recent previous trading day's closing price for each symbol.

    Returns {symbol: close_price}. Symbols with no data are excluded.
    """
    end = datetime.date.today() - datetime.timedelta(days=1)
    start = end - datetime.timedelta(days=7)  # buffer for weekends / holidays

    params = (
        f"symbols={','.join(symbols)}"
        f"&timeframe=1Day"
        f"&start={start.isoformat()}"
        f"&end={end.isoformat()}"
        f"&limit=10000"
        f"&feed={_FEED}"
        f"&sort=desc"
    )

    try:
        response = client.get(f"/v2/stocks/bars?{params}")
        bars_by_symbol = response.get("bars", {})
    except Exception as exc:
        logger.error("Failed to fetch previous close bars: %s", exc)
        return {}

    result: dict[str, float] = {}
    for symbol, bars in bars_by_symbol.items():
        if bars:
            result[symbol] = float(bars[0]["c"])  # most recent bar (sort=desc)

    logger.info("Previous close fetched for %d/%d symbols", len(result), len(symbols))
    return result


def fetch_avg_daily_volume(
    client: AlpacaClient,
    symbols: list[str],
    lookback_days: int = 30,
) -> dict[str, float]:
    """Fetch 30-day average daily volume for each symbol using Alpaca daily bars.

    Returns {symbol: avg_volume}. Symbols with no data are excluded.
    """
    end = datetime.date.today() - datetime.timedelta(days=1)
    start = end - datetime.timedelta(days=lookback_days + 7)  # extra buffer for non-trading days

    params = (
        f"symbols={','.join(symbols)}"
        f"&timeframe=1Day"
        f"&start={start.isoformat()}"
        f"&end={end.isoformat()}"
        f"&limit=10000"
        f"&feed={_FEED}"
    )

    try:
        response = client.get(f"/v2/stocks/bars?{params}")
        bars_by_symbol = response.get("bars", {})
    except Exception as exc:
        logger.error("Failed to fetch daily bars for ADV: %s", exc)
        return {}

    result: dict[str, float] = {}
    for symbol, bars in bars_by_symbol.items():
        if bars:
            result[symbol] = sum(b["v"] for b in bars) / len(bars)

    logger.info("Average daily volume fetched for %d/%d symbols", len(result), len(symbols))
    return result


