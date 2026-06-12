import datetime
import logging

from shariah_algo_trader.data.fmp_client import FMPClient
from shariah_algo_trader.factors._utils import z_scores

logger = logging.getLogger(__name__)

_MIN_PRICES = 250
_LOOKBACK_DAYS = 390


def compute_momentum_factor(tickers: set[str], client: FMPClient) -> dict[str, float]:
    """Compute Momentum Factor z-scores for each ticker in the Eligible Universe.

    Returns a dict mapping ticker → z-score. Tickers with insufficient price
    history are excluded and logged as warnings.
    """
    logger.info("Computing Momentum Factor for %d tickers", len(tickers))
    one_month_ago = datetime.date.today() - datetime.timedelta(days=30)
    raw_returns: dict[str, float] = {}

    for ticker in tickers:
        data = client.get(
            f"/historical-price-full/{ticker}",
            params={"serietype": "line", "timeseries": _LOOKBACK_DAYS},
        )
        historical = data.get("historical", [])

        if len(historical) < _MIN_PRICES:
            logger.warning(
                "%s: insufficient price history (%d records), excluding from Momentum Factor",
                ticker, len(historical),
            )
            continue

        prices = sorted(historical, key=lambda p: p["date"])
        price_13m_ago = prices[0]["close"]
        price_1m_ago = _price_on_or_before(prices, one_month_ago)

        if price_13m_ago == 0 or price_1m_ago is None:
            logger.warning("%s: invalid price data, excluding from Momentum Factor", ticker)
            continue

        raw_returns[ticker] = price_1m_ago / price_13m_ago - 1

    logger.info("Momentum Factor: %d/%d tickers scored", len(raw_returns), len(tickers))
    return z_scores(raw_returns)


def _price_on_or_before(prices: list[dict], target: datetime.date) -> float | None:
    target_str = str(target)
    result = None
    for p in prices:
        if p["date"] <= target_str:
            result = p["close"]
        else:
            break
    return result
