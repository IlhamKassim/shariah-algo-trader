import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import yfinance as yf

from shariah_algo_trader.factors._utils import z_scores

logger = logging.getLogger(__name__)

_MAX_WORKERS = 10
_CACHE_TTL_SECONDS = 12 * 3600  # 12 hours TTL for valuation ratios

# In-memory cache: ticker -> (timestamp, fcf_yield)
_value_cache: dict[str, tuple[float, float | None]] = {}


def compute_value_factor(tickers: set[str]) -> dict[str, float]:
    """Compute FCF Yield (free cash flow / market cap) z-scores using parallel threads and 12h caching.

    Higher FCF yield = cheaper valuation = higher score.
    Companies with negative or missing FCF data are excluded.
    """
    logger.info("Computing Value Factor for %d tickers", len(tickers))
    now = time.time()
    raw_scores: dict[str, float] = {}

    to_fetch: list[str] = []
    for ticker in tickers:
        if ticker in _value_cache:
            ts, score = _value_cache[ticker]
            if now - ts < _CACHE_TTL_SECONDS:
                if score is not None:
                    raw_scores[ticker] = score
                continue
        to_fetch.append(ticker)

    if to_fetch:
        logger.info("Fetching fresh valuation data for %d tickers via parallel workers", len(to_fetch))

        def _fetch(ticker: str) -> tuple[str, float | None]:
            try:
                info = yf.Ticker(ticker).info
                fcf = info.get("freeCashflow")
                mktcap = info.get("marketCap")
                if fcf is None or mktcap is None or mktcap <= 0 or fcf <= 0:
                    return ticker, None
                return ticker, fcf / mktcap
            except Exception as exc:
                logger.warning("%s: value factor fetch failed (%s)", ticker, exc)
                return ticker, None

        with ThreadPoolExecutor(max_workers=_MAX_WORKERS) as pool:
            futures = {pool.submit(_fetch, t): t for t in to_fetch}
            for future in as_completed(futures):
                ticker, score = future.result()
                _value_cache[ticker] = (now, score)
                if score is not None:
                    raw_scores[ticker] = score

    logger.info("Value Factor: %d/%d tickers scored", len(raw_scores), len(tickers))
    return z_scores(raw_scores)
