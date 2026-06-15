import csv
import io
import logging

import requests

logger = logging.getLogger(__name__)

_HOLDINGS_URLS: dict[str, str] = {
    "SPUS": "https://www.sp-funds.com/wp-content/uploads/data/TidalFG_Holdings_SPUS.csv",
}


class UniverseError(Exception):
    pass


def fetch_eligible_universe(etf_symbol: str) -> set[str]:
    """Return the Eligible Universe as ticker symbols from an ETF's Holdings Snapshot.

    Raises UniverseError if the ETF is unsupported, the request fails, or the
    snapshot contains no equity holdings.
    """
    url = _HOLDINGS_URLS.get(etf_symbol.upper())
    if url is None:
        raise UniverseError(f"No holdings source configured for ETF {etf_symbol!r}")

    logger.info("Fetching Holdings Snapshot for %s", etf_symbol)
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    }
    try:
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise UniverseError(f"Failed to fetch holdings for {etf_symbol}: {exc}") from exc

    reader = csv.DictReader(io.StringIO(response.text))
    tickers = {
        row["StockTicker"].strip()
        for row in reader
        if row.get("StockTicker", "").strip()
        and not row["StockTicker"].strip().upper().startswith("CASH")
    }

    if not tickers:
        raise UniverseError(f"ETF {etf_symbol!r} has no holdings in the Holdings Snapshot")

    logger.info("Eligible Universe: %d stocks from %s", len(tickers), etf_symbol)
    return tickers
