import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

import yfinance as yf

logger = logging.getLogger(__name__)

# 50 high-volume, liquid US stocks — mix of tech, finance, energy, travel, consumer
_DEFAULT_WATCHLIST: list[str] = [
    # Mega-cap tech
    "AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "META", "GOOGL", "AMD", "INTC", "MU",
    # Finance
    "BAC", "JPM", "WFC", "C", "GS", "MS", "SOFI", "HOOD", "COIN", "SQ",
    # Energy
    "XOM", "CVX", "OXY", "SLB", "HAL",
    # Consumer / travel
    "F", "GM", "CCL", "AAL", "DAL", "UBER", "LYFT", "ABNB", "DASH", "NFLX",
    # Growth / tech
    "PLTR", "SHOP", "SNAP", "RBLX", "PINS", "DKNG", "PYPL", "DIS", "T", "PFE",
    # EV / speculative
    "NIO", "RIVN", "LCID", "MARA", "RIOT",
]

_MAX_WORKERS = 10


def fetch_avg_daily_volume(symbols: list[str]) -> dict[str, float]:
    """Fetch 30-day average daily volume for each symbol using yfinance.

    Returns {symbol: avg_volume}. Missing symbols are excluded.
    """
    logger.info("Fetching average daily volume for %d watchlist stocks", len(symbols))

    def _fetch(symbol: str) -> tuple[str, float | None]:
        try:
            info = yf.Ticker(symbol).info
            vol = info.get("averageVolume") or info.get("averageDailyVolume10Day")
            return symbol, float(vol) if vol else None
        except Exception as exc:
            logger.warning("%s: volume fetch failed (%s)", symbol, exc)
            return symbol, None

    result: dict[str, float] = {}
    with ThreadPoolExecutor(max_workers=_MAX_WORKERS) as pool:
        futures = {pool.submit(_fetch, s): s for s in symbols}
        for future in as_completed(futures):
            symbol, vol = future.result()
            if vol is not None:
                result[symbol] = vol

    logger.info("Average volume fetched for %d/%d symbols", len(result), len(symbols))
    return result


def get_watchlist() -> list[str]:
    return list(_DEFAULT_WATCHLIST)
