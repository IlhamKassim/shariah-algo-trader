import csv
import io
import logging

import requests

logger = logging.getLogger(__name__)

_POSSIBLE_TICKER_COLS = ["StockTicker", "Ticker", "TICKER", "Symbol", "SYMBOL", "ticker", "symbol"]

_ETF_CONFIG: dict[str, dict] = {
    "SPUS": {
        "url": "https://www.sp-funds.com/wp-content/uploads/data/TidalFG_Holdings_SPUS.csv",
    },
    "HLAL": {
        "url": "https://www.wisdomtree.com/investments/etfs/sharia/hlal/download/Holdings",
    },
}

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}


class UniverseError(Exception):
    pass


def _extract_tickers(reader: csv.DictReader, etf_symbol: str) -> set[str]:
    fieldnames = list(reader.fieldnames or [])
    ticker_col = next((c for c in _POSSIBLE_TICKER_COLS if c in fieldnames), None)
    if ticker_col is None:
        logger.warning("%s: no recognised ticker column in %s", etf_symbol, fieldnames)
        return set()

    tickers: set[str] = set()
    for row in reader:
        val = row.get(ticker_col, "").strip()
        upper = val.upper()
        if val and not upper.startswith("CASH") and not upper.startswith("USD"):
            tickers.add(val)
    return tickers


def _fetch_etf_holdings(etf_symbol: str) -> set[str]:
    cfg = _ETF_CONFIG.get(etf_symbol.upper())
    if cfg is None:
        raise UniverseError(f"No holdings source configured for ETF {etf_symbol!r}")

    logger.info("Fetching Holdings Snapshot for %s", etf_symbol)
    response = requests.get(cfg["url"], headers=_HEADERS, timeout=30)
    response.raise_for_status()

    reader = csv.DictReader(io.StringIO(response.text))
    return _extract_tickers(reader, etf_symbol)


def fetch_eligible_universe(etf_symbol: str) -> set[str]:
    """Return the Eligible Universe from a single ETF's Holdings Snapshot."""
    try:
        tickers = _fetch_etf_holdings(etf_symbol)
    except requests.RequestException as exc:
        raise UniverseError(f"Failed to fetch holdings for {etf_symbol}: {exc}") from exc

    if not tickers:
        raise UniverseError(f"ETF {etf_symbol!r} has no holdings in the Holdings Snapshot")

    logger.info("Eligible Universe: %d stocks from %s", len(tickers), etf_symbol)
    return tickers


def fetch_combined_universe(etf_symbols: list[str]) -> set[str]:
    """Return the union of holdings from multiple Shariah-compliant ETFs.

    Individual ETF failures are logged and skipped; raises UniverseError only
    if every ETF fails or the combined result is empty.
    """
    combined: set[str] = set()
    failed: list[str] = []

    for symbol in etf_symbols:
        try:
            holdings = _fetch_etf_holdings(symbol)
            if not holdings:
                logger.error("%s: empty holdings snapshot, skipping", symbol)
                failed.append(symbol)
                continue
            logger.info("%s: %d holdings added to universe", symbol, len(holdings))
            combined |= holdings
        except Exception as exc:
            logger.error(
                "Failed to fetch %s holdings (%s), skipping — "
                "universe will be built without this ETF",
                symbol, exc,
            )
            failed.append(symbol)

    if not combined:
        raise UniverseError(f"All ETF fetches failed — attempted: {etf_symbols}")

    if failed:
        logger.warning("Universe built without: %s", failed)

    logger.info(
        "Combined Eligible Universe: %d stocks from %s",
        len(combined),
        [s for s in etf_symbols if s not in failed],
    )
    return combined
