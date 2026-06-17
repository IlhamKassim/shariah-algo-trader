import datetime
import logging

import pandas as pd
import yfinance as yf

from shariah_algo_trader.factors._utils import z_scores

logger = logging.getLogger(__name__)

_LOOKBACK_DAYS = 400
_MIN_PRICES = 200
_TRADING_DAYS_PER_YEAR = 252


def compute_raw_volatility(tickers: set[str]) -> dict[str, float]:
    """Compute annualised daily-return standard deviation for each ticker."""
    logger.info("Computing raw volatility for %d tickers", len(tickers))

    end = datetime.date.today()
    start = end - datetime.timedelta(days=_LOOKBACK_DAYS)

    raw = yf.download(
        sorted(tickers),
        start=str(start),
        end=str(end),
        auto_adjust=True,
        progress=False,
    )

    if raw.empty:
        logger.warning("Volatility: yfinance returned no data")
        return {}

    close = raw["Close"]
    if isinstance(close, pd.Series):
        close = close.to_frame(name=next(iter(tickers)))

    result: dict[str, float] = {}
    for ticker in tickers:
        if ticker not in close.columns:
            continue
        series = close[ticker].dropna()
        if len(series) < _MIN_PRICES:
            continue
        daily_ret = series.pct_change().dropna()
        result[ticker] = float(daily_ret.std() * (_TRADING_DAYS_PER_YEAR ** 0.5))

    logger.info("Volatility: %d/%d tickers computed", len(result), len(tickers))
    return result


def compute_volatility_factor(raw_vols: dict[str, float]) -> dict[str, float]:
    """Z-score of negative annualised volatility — lower vol → higher score."""
    if not raw_vols:
        return {}
    return z_scores({t: -v for t, v in raw_vols.items()})


def compute_inv_vol_weights(tickers: list[str], raw_vols: dict[str, float]) -> dict[str, float]:
    """Compute inverse-volatility normalised position weights.

    Positions with no volatility data receive the cross-sectional average
    inverse-vol weight. Individual weights are capped at 2× equal weight to
    prevent extreme concentration in a single low-vol name.
    """
    if not tickers:
        return {}

    n = len(tickers)
    cap = 2.0 / n

    inv_vol_list: list[float | None] = []
    for t in tickers:
        vol = raw_vols.get(t, 0)
        inv_vol_list.append(1.0 / vol if vol > 0 else None)

    valid = [v for v in inv_vol_list if v is not None]
    avg = sum(valid) / len(valid) if valid else 1.0
    inv_vols = [v if v is not None else avg for v in inv_vol_list]

    total = sum(inv_vols)
    weights = [v / total for v in inv_vols]

    # Single-pass cap + renormalise
    weights = [min(w, cap) for w in weights]
    total2 = sum(weights)
    weights = [w / total2 for w in weights]

    return dict(zip(tickers, weights))
