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
        # Legacy WisdomTree URL returns HTTP 403 (verified). This Google Sheets
        # CSV export is the current working source — same StockTicker schema.
        "url": "https://docs.google.com/spreadsheets/d/1UC1Bk67bGuYsos_i8y_HQpNoHpVHAvqf71MbgrafJOQ/export?format=csv",
    },
    "SPTE": {
        "url": "https://www.sp-funds.com/wp-content/uploads/data/TidalFG_Holdings_SPTE.csv",
    },
    "SPRE": {
        "url": "https://www.sp-funds.com/wp-content/uploads/data/TidalFG_Holdings_SPRE.csv",
    },
    "SPWO": {
        "url": "https://www.sp-funds.com/wp-content/uploads/data/TidalFG_Holdings_SPWO.csv",
    },
    "UMMA": {
        "url": "https://docs.google.com/spreadsheets/d/1kACYezLTfiN5dWMrM02GL2uQWsYTj2nqVTejp6hJp2k/export?format=csv",
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


def _is_us_listed(ticker: str) -> bool:
    """Return True if a raw ticker string looks like a US-exchange listing.

    Source ETFs hold a global mix of equities, but Alpaca — this bot's only
    broker — can only execute trades on US-listed securities. Every foreign
    listing observed in these holdings CSVs is rendered as "<CODE> <SUFFIX>"
    (e.g. "ASML NA", "005930 KS", "1211 HK") — i.e. it contains whitespace.
    Confirmed US-listed tickers, including US-listed ADRs of foreign
    companies (e.g. "BABA", "TSM"), never do. DISCLAIMER: this bot does not
    yet support trading non-US-listed equities, even when they appear in a
    source ETF's Shariah-compliant holdings — those names are silently
    excluded here.
    """
    return " " not in ticker.strip()


def _extract_tickers(reader: csv.DictReader, etf_symbol: str) -> set[str]:
    fieldnames = list(reader.fieldnames or [])
    ticker_col = next((c for c in _POSSIBLE_TICKER_COLS if c in fieldnames), None)
    if ticker_col is None:
        logger.warning("%s: no recognised ticker column in %s", etf_symbol, fieldnames)
        return set()

    tickers: set[str] = set()
    skipped_foreign = 0
    for row in reader:
        val = row.get(ticker_col, "").strip()
        upper = val.upper()
        if not val or upper.startswith("CASH") or upper.startswith("USD"):
            continue
        if not _is_us_listed(val):
            skipped_foreign += 1
            continue
        tickers.add(val)

    if skipped_foreign:
        logger.info(
            "%s: excluded %d non-US-listed ticker(s) from Eligible Universe "
            "(Alpaca cannot execute non-US listings)",
            etf_symbol, skipped_foreign,
        )
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


def fetch_company_names(etf_symbols: list[str]) -> dict[str, str]:
    """Fetch ETF spreadsheets and build a mapping of symbol -> company_name.

    Note: unlike fetch_combined_universe, this does NOT apply the US-listed
    filter — it is a superset lookup table. Entries for non-US-listed tickers
    are harmless dead keys since callers only look up tickers that are
    already in the (filtered) Eligible Universe.
    """
    names: dict[str, str] = {}
    for symbol in etf_symbols:
        try:
            cfg = _ETF_CONFIG.get(symbol.upper())
            if cfg is None:
                continue
            response = requests.get(cfg["url"], headers=_HEADERS, timeout=30)
            response.raise_for_status()
            reader = csv.DictReader(io.StringIO(response.text))
            
            fieldnames = list(reader.fieldnames or [])
            ticker_col = next((c for c in _POSSIBLE_TICKER_COLS if c in fieldnames), None)
            name_col = next((c for c in ["SecurityName", "Name", "NAME", "description", "Description"] if c in fieldnames), None)
            
            if ticker_col and name_col:
                for row in reader:
                    t_val = row.get(ticker_col, "").strip().upper()
                    n_val = row.get(name_col, "").strip()
                    if t_val and n_val:
                        names[t_val] = n_val
        except Exception as exc:
            logger.warning("Failed to fetch company names for %s: %s", symbol, exc)
    return names

