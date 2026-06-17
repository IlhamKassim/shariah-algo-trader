import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

import yfinance as yf

logger = logging.getLogger(__name__)

_MAX_SECTOR_WORKERS = 10
_CANDIDATE_MULTIPLIER = 4  # fetch sectors for top N × this before applying caps


def _fetch_sector(ticker: str) -> tuple[str, str]:
    try:
        info = yf.Ticker(ticker).info
        return ticker, info.get("sector", "Unknown") or "Unknown"
    except Exception:
        return ticker, "Unknown"


def _fetch_sectors(tickers: list[str]) -> dict[str, str]:
    result: dict[str, str] = {}
    with ThreadPoolExecutor(max_workers=_MAX_SECTOR_WORKERS) as pool:
        futures = {pool.submit(_fetch_sector, t): t for t in tickers}
        for future in as_completed(futures):
            ticker, sector = future.result()
            result[ticker] = sector
    return result


def rank_by_factor_score(
    momentum_scores: dict[str, float],
    quality_scores: dict[str, float],
    volatility_scores: dict[str, float],
    value_scores: dict[str, float],
    top_n: int,
    sector_cap: float = 0.20,
) -> list[str]:
    """Rank the Eligible Universe by composite Factor Score and return the top-N.

    Factor Score = 0.25 × Momentum + 0.25 × Quality + 0.25 × Low-Vol + 0.25 × Value

    Tickers missing momentum or quality scores are excluded entirely.
    Tickers missing volatility or value scores receive a neutral z-score of 0.

    Sector cap: no more than floor(sector_cap × top_n) stocks from any single
    GICS sector. Capped-out stocks are skipped and the next-best is selected.
    """
    required = momentum_scores.keys() & quality_scores.keys()

    scores: dict[str, float] = {}
    for ticker in required:
        m = momentum_scores[ticker]
        q = quality_scores[ticker]
        v = volatility_scores.get(ticker, 0.0)
        val = value_scores.get(ticker, 0.0)
        scores[ticker] = 0.25 * m + 0.25 * q + 0.25 * v + 0.25 * val

    ranked = sorted(scores, key=lambda t: scores[t], reverse=True)

    # Fetch sectors for a buffer of top candidates to minimise API calls
    candidates = ranked[: top_n * _CANDIDATE_MULTIPLIER]
    sectors = _fetch_sectors(candidates)

    max_per_sector = max(1, int(sector_cap * top_n))
    sector_counts: dict[str, int] = {}
    selected: list[str] = []

    for ticker in ranked:
        if len(selected) >= top_n:
            break
        sector = sectors.get(ticker, "Unknown")
        # Tickers with unknown sector data are never capped
        if sector != "Unknown" and sector_counts.get(sector, 0) >= max_per_sector:
            logger.info(
                "%s skipped — sector %r at cap (%d/%d)",
                ticker, sector, sector_counts[sector], max_per_sector,
            )
            continue
        selected.append(ticker)
        sector_counts[sector] = sector_counts.get(sector, 0) + 1

    if len(selected) < top_n:
        logger.warning(
            "Sector cap limited selection to %d/%d stocks", len(selected), top_n
        )

    logger.info(
        "Sector distribution: %s",
        {k: v for k, v in sorted(sector_counts.items(), key=lambda x: -x[1])},
    )
    return selected
