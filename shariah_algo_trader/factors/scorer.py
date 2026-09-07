import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field

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


@dataclass
class SelectionDiagnostics:
    """Why the engine chose what it chose.

    `rank_by_factor_score` returns only the selected tickers, which loses the
    reasoning — in particular that a higher-scoring stock can be passed over
    because its sector is already at cap. The dashboard needs that to explain
    the decision to a user, so the selection loop records it here.
    """

    selected: list[str] = field(default_factory=list)
    #: Sector per ticker, for every ticker the selection loop examined.
    sectors: dict[str, str] = field(default_factory=dict)
    #: Ticker -> human-readable reason it was passed over despite ranking high enough.
    skipped: dict[str, str] = field(default_factory=dict)
    #: Ceiling applied per sector, i.e. max(1, int(sector_cap * top_n)).
    max_per_sector: int = 0


def fetch_sectors(tickers: list[str]) -> dict[str, str]:
    """Public wrapper so callers can top up sector data the ranking didn't reach."""
    return _fetch_sectors(tickers)


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

    Thin wrapper over :func:`rank_with_diagnostics` for callers that only need
    the target list.
    """
    return rank_with_diagnostics(
        momentum_scores, quality_scores, volatility_scores, value_scores,
        top_n=top_n, sector_cap=sector_cap,
    ).selected


def rank_with_diagnostics(
    momentum_scores: dict[str, float],
    quality_scores: dict[str, float],
    volatility_scores: dict[str, float],
    value_scores: dict[str, float],
    top_n: int,
    sector_cap: float = 0.20,
) -> SelectionDiagnostics:
    """Rank the Eligible Universe and return the selection plus its reasoning.

    Factor Score = 0.25 × Momentum + 0.25 × Quality + 0.25 × Low-Vol + 0.25 × Value

    Tickers missing momentum or quality scores are excluded entirely.
    Tickers missing volatility or value scores receive a neutral z-score of 0.

    Sector cap: no more than floor(sector_cap × top_n) stocks from any single
    GICS sector. Capped-out stocks are skipped and the next-best is selected.
    """
    if quality_scores:
        required = momentum_scores.keys() & quality_scores.keys()
    else:
        required = momentum_scores.keys()

    scores: dict[str, float] = {}
    for ticker in required:
        m = momentum_scores.get(ticker, 0.0)
        q = quality_scores.get(ticker, 0.0)
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
    skipped: dict[str, str] = {}

    for ticker in ranked:
        if len(selected) >= top_n:
            break
        if ticker not in sectors:
            missing = [t for t in ranked if t not in sectors]
            sectors.update(_fetch_sectors(missing))
        sector = sectors.get(ticker, "Unknown")
        # Tickers with unknown sector data are never capped
        if sector != "Unknown" and sector_counts.get(sector, 0) >= max_per_sector:
            logger.info(
                "%s skipped — sector %r at cap (%d/%d)",
                ticker, sector, sector_counts[sector], max_per_sector,
            )
            skipped[ticker] = (
                f"{sector} already at its cap of {max_per_sector} — "
                "a lower-ranked stock from another sector took the slot"
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
    return SelectionDiagnostics(
        selected=selected,
        sectors=sectors,
        skipped=skipped,
        max_per_sector=max_per_sector,
    )
