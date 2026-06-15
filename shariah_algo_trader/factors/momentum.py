import datetime
import logging

import pandas as pd
import yfinance as yf

from shariah_algo_trader.factors._utils import z_scores

logger = logging.getLogger(__name__)

_MIN_PRICES = 250
_LOOKBACK_DAYS = 400


def compute_momentum_factor(tickers: set[str]) -> dict[str, float]:
    """Compute Momentum Factor z-scores for each ticker in the Eligible Universe.

    Returns a dict mapping ticker → z-score. Tickers with insufficient price
    history are excluded and logged as warnings.
    """
    logger.info("Computing Momentum Factor for %d tickers", len(tickers))

    end = datetime.date.today()
    start = end - datetime.timedelta(days=_LOOKBACK_DAYS)
    one_month_ago = pd.Timestamp(end - datetime.timedelta(days=30))

    raw = yf.download(
        sorted(tickers),
        start=str(start),
        end=str(end),
        auto_adjust=True,
        progress=False,
    )

    if raw.empty:
        logger.warning("yfinance returned no price data")
        return {}

    close = raw["Close"]
    if isinstance(close, pd.Series):
        close = close.to_frame(name=next(iter(tickers)))

    raw_returns: dict[str, float] = {}

    for ticker in tickers:
        if ticker not in close.columns:
            logger.warning("%s: no price data from yfinance, excluding from Momentum Factor", ticker)
            continue

        series = close[ticker].dropna()

        if len(series) < _MIN_PRICES:
            logger.warning(
                "%s: insufficient price history (%d records), excluding from Momentum Factor",
                ticker, len(series),
            )
            continue

        price_13m_ago = float(series.iloc[0])

        series_until_1m = series[series.index <= one_month_ago]
        if series_until_1m.empty:
            logger.warning(
                "%s: no price data before 1-month cutoff, excluding from Momentum Factor", ticker
            )
            continue

        price_1m_ago = float(series_until_1m.iloc[-1])

        if price_13m_ago == 0:
            logger.warning(
                "%s: zero price at start of window, excluding from Momentum Factor", ticker
            )
            continue

        raw_returns[ticker] = price_1m_ago / price_13m_ago - 1

    logger.info("Momentum Factor: %d/%d tickers scored", len(raw_returns), len(tickers))
    return z_scores(raw_returns)
