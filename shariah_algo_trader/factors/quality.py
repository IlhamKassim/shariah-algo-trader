import logging

from shariah_algo_trader.data.fmp_client import FMPClient
from shariah_algo_trader.factors._utils import z_scores

logger = logging.getLogger(__name__)

DEBT_TO_ASSETS_LIMIT = 0.33


def compute_quality_factor(tickers: set[str], client: FMPClient) -> dict[str, float]:
    """Compute Quality Factor z-scores for each ticker in the Eligible Universe.

    Hard filter: tickers with Total Debt / Total Assets > 0.33 are excluded before
    scoring — they receive no Factor Score regardless of profitability metrics.

    Composite for survivors:
        raw_quality = 0.40 × ROE + 0.30 × net_profit_margin + 0.30 × (1 − debt_to_assets)

    Returns a dict mapping ticker → z-score. Excluded tickers are logged as warnings.
    """
    logger.info("Computing Quality Factor for %d tickers", len(tickers))
    raw_scores: dict[str, float] = {}

    for ticker in tickers:
        data = client.get(
            f"/key-metrics/{ticker}",
            params={"period": "quarter", "limit": 1},
        )

        if not data:
            logger.warning("%s: no fundamental data, excluding from Quality Factor", ticker)
            continue

        metrics = data[0]
        roe = metrics.get("returnOnEquity")
        margin = metrics.get("netProfitMargin")
        debt_to_assets = metrics.get("debtToAssets")

        if any(v is None for v in (roe, margin, debt_to_assets)):
            logger.warning("%s: incomplete fundamental data, excluding from Quality Factor", ticker)
            continue

        if debt_to_assets > DEBT_TO_ASSETS_LIMIT:
            logger.warning(
                "%s: debt/assets %.4f exceeds Islamic finance limit of %.2f, excluding from Quality Factor",
                ticker, debt_to_assets, DEBT_TO_ASSETS_LIMIT,
            )
            continue

        raw_scores[ticker] = (
            0.40 * roe
            + 0.30 * margin
            + 0.30 * (1 - debt_to_assets)
        )

    logger.info("Quality Factor: %d/%d tickers scored", len(raw_scores), len(tickers))
    return z_scores(raw_scores)
