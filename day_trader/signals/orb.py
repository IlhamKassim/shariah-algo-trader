import logging

from day_trader.state import ORBData

logger = logging.getLogger(__name__)


def compute_orb(
    symbol: str,
    bars: list[dict],
    avg_daily_volume: float,
    *,
    orb_minutes: int = 30,
    prev_close: float = 0.0,
) -> ORBData | None:
    """Compute the Opening Range Breakout data from 1-minute bars.

    Returns None if there are fewer than 2 bars (insufficient data).
    """
    if len(bars) < 2:
        logger.warning("%s: only %d bar(s) in opening range, skipping", symbol, len(bars))
        return None

    highs = [float(b["h"]) for b in bars]
    lows = [float(b["l"]) for b in bars]
    closes = [float(b["c"]) for b in bars]
    volumes = [int(b["v"]) for b in bars]

    open_volume = sum(volumes)

    # RVOL: how much faster today's opening traded vs the historical daily average.
    # Normalise by the fraction of the day the opening window covers (orb_minutes/390).
    expected_opening_vol = avg_daily_volume * (orb_minutes / 390)
    rvol = open_volume / max(expected_opening_vol, 1)

    # Opening range VWAP (typical price × volume weighted average)
    cum_tp_vol = sum((h + l + c) / 3 * v for h, l, c, v in zip(highs, lows, closes, volumes))
    vwap = cum_tp_vol / max(open_volume, 1)

    # Gap: today's open vs yesterday's close
    today_open = float(bars[0]["o"]) if bars else 0.0
    gap_pct = (today_open - prev_close) / prev_close if prev_close > 0 else 0.0

    return ORBData(
        high=max(highs),
        low=min(lows),
        open_volume=open_volume,
        avg_daily_volume=avg_daily_volume,
        rvol=rvol,
        vwap=vwap,
        gap_pct=gap_pct,
    )


def is_breakout(
    symbol: str,
    current_price: float,
    orb: ORBData,
    rvol_threshold: float = 1.5,
) -> bool:
    """Return True if the current price constitutes a valid ORB breakout.

    Conditions:
    1. Price is strictly above the opening range high.
    2. RVOL >= rvol_threshold (opening pace is at least 1.5× the historical norm
       for this time of day — ensures real participation, not a thin drift).
    """
    if current_price <= orb.high:
        return False

    if orb.avg_daily_volume > 0 and orb.rvol < rvol_threshold:
        logger.info(
            "%s: price breakout (%.2f > %.2f) but RVOL too low (%.2f, need %.1f)",
            symbol, current_price, orb.high, orb.rvol, rvol_threshold,
        )
        return False

    logger.info(
        "%s: ORB breakout confirmed — price %.2f > high %.2f, RVOL %.2f",
        symbol, current_price, orb.high, orb.rvol,
    )
    return True


def compute_stop_loss(entry_price: float, orb_low: float, stop_loss_pct: float) -> float:
    """Hard stop = tighter of ORB low or entry - stop_loss_pct."""
    return max(orb_low, entry_price * (1 - stop_loss_pct))
