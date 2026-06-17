import datetime
import logging

import pandas as pd
import yfinance as yf

logger = logging.getLogger(__name__)

_REGIME_TICKER = "SPY"
_MA_DAYS = 200
_LOOKBACK_DAYS = 300


def is_bull_market() -> bool:
    """Return True if SPY is above its 200-day moving average.

    Defaults to True on data failure so the bot never freezes buys on bad data.
    """
    end = datetime.date.today()
    start = end - datetime.timedelta(days=_LOOKBACK_DAYS)

    try:
        data = yf.download(
            _REGIME_TICKER,
            start=str(start),
            end=str(end),
            auto_adjust=True,
            progress=False,
        )
    except Exception as exc:
        logger.warning("Regime filter: failed to fetch %s (%s) — assuming bull market", _REGIME_TICKER, exc)
        return True

    if data.empty or len(data) < _MA_DAYS:
        logger.warning("Regime filter: insufficient data (%d rows) — assuming bull market", len(data))
        return True

    close = data["Close"].squeeze()
    if isinstance(close, pd.DataFrame):
        close = close.iloc[:, 0]

    current = float(close.iloc[-1])
    ma = float(close.rolling(_MA_DAYS).mean().iloc[-1])
    bull = current > ma

    logger.info(
        "Regime filter: %s %.2f vs %d-day MA %.2f — %s",
        _REGIME_TICKER, current, _MA_DAYS, ma, "BULL" if bull else "BEAR",
    )
    return bull
