import warnings

import numpy as np

from shariah_algo_trader.data.fmp_client import FMPClient

# Islamic finance hard filter: total debt / total assets must not exceed this.
DEBT_TO_ASSETS_LIMIT = 0.33


def compute_quality_factor(tickers: set[str], client: FMPClient) -> dict[str, float]:
    """Compute Quality Factor z-scores for each ticker in the Eligible Universe.

    Hard filter: tickers with Total Debt / Total Assets > 0.33 are excluded before
    scoring — they receive no Factor Score regardless of profitability metrics.

    Composite for survivors:
        raw_quality = 0.40 × ROE + 0.30 × net_profit_margin + 0.30 × (1 − debt_to_assets)

    Returns a dict mapping ticker → z-score. Excluded tickers emit warnings.warn.
    """
    raw_scores: dict[str, float] = {}

    for ticker in tickers:
        data = client.get(
            f"/key-metrics/{ticker}",
            params={"period": "quarter", "limit": 1},
        )

        if not data:
            warnings.warn(
                f"{ticker}: no fundamental data available, "
                "excluding from Quality Factor computation"
            )
            continue

        metrics = data[0]
        roe = metrics.get("returnOnEquity")
        margin = metrics.get("netProfitMargin")
        debt_to_assets = metrics.get("debtToAssets")

        if any(v is None for v in (roe, margin, debt_to_assets)):
            warnings.warn(
                f"{ticker}: incomplete fundamental data, "
                "excluding from Quality Factor computation"
            )
            continue

        if debt_to_assets > DEBT_TO_ASSETS_LIMIT:
            warnings.warn(
                f"{ticker}: Total Debt / Total Assets {debt_to_assets:.4f} exceeds "
                f"Islamic finance limit of {DEBT_TO_ASSETS_LIMIT}, "
                "excluding from Quality Factor computation"
            )
            continue

        raw_scores[ticker] = (
            0.40 * roe
            + 0.30 * margin
            + 0.30 * (1 - debt_to_assets)
        )

    if not raw_scores:
        return {}

    values = np.array(list(raw_scores.values()), dtype=float)
    std = values.std()

    if std == 0:
        return {t: 0.0 for t in raw_scores}

    z_scores = (values - values.mean()) / std
    return dict(zip(raw_scores.keys(), z_scores.tolist()))
