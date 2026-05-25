import datetime
import warnings

import numpy as np

from shariah_algo_trader.data.fmp_client import FMPClient

# Minimum number of price records needed to compute a valid 12-1 month return.
# 13 months × ~21 trading days/month, with some slack for holidays.
_MIN_PRICES = 250
_LOOKBACK_DAYS = 390  # ~13 months of trading days requested from FMP


def compute_momentum_factor(tickers: set[str], client: FMPClient) -> dict[str, float]:
    """Compute Momentum Factor z-scores for each ticker in the Eligible Universe.

    Returns a dict mapping ticker → z-score. Tickers with insufficient price
    history are excluded and a warning is emitted.
    """
    one_month_ago = datetime.date.today() - datetime.timedelta(days=30)
    raw_returns: dict[str, float] = {}

    for ticker in tickers:
        data = client.get(
            f"/historical-price-full/{ticker}",
            params={"serietype": "line", "timeseries": _LOOKBACK_DAYS},
        )
        historical = data.get("historical", [])

        if len(historical) < _MIN_PRICES:
            warnings.warn(
                f"{ticker}: insufficient price history ({len(historical)} records), "
                "excluding from Momentum Factor computation"
            )
            continue

        # Sort ascending by date (FMP returns newest-first)
        prices = sorted(historical, key=lambda p: p["date"])

        # 12-1 return: price at ~1 month ago ÷ oldest price − 1
        price_13m_ago = prices[0]["close"]
        price_1m_ago = _price_on_or_before(prices, one_month_ago)

        if price_13m_ago == 0 or price_1m_ago is None:
            warnings.warn(f"{ticker}: invalid price data, excluding from Momentum Factor computation")
            continue

        raw_returns[ticker] = price_1m_ago / price_13m_ago - 1

    if not raw_returns:
        return {}

    values = np.array(list(raw_returns.values()), dtype=float)
    std = values.std()

    if std == 0:
        return {t: 0.0 for t in raw_returns}

    z_scores = (values - values.mean()) / std
    return dict(zip(raw_returns.keys(), z_scores.tolist()))


def _price_on_or_before(
    prices: list[dict], target: datetime.date
) -> float | None:
    """Return the closing price of the last record on or before target date."""
    target_str = str(target)
    result = None
    for p in prices:
        if p["date"] <= target_str:
            result = p["close"]
        else:
            break
    return result
