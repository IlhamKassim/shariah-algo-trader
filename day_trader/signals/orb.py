import logging

from day_trader.state import ORBData

logger = logging.getLogger(__name__)


def compute_orb(
    symbol: str,
    bars: list[dict],
    avg_daily_volume: float,
) -> ORBData | None:
    """Compute the Opening Range Breakout data from 1-minute bars.

    Returns None if there are fewer than 2 bars (insufficient data).
    """
    if len(bars) < 2:
        logger.warning("%s: only %d bar(s) in opening range, skipping", symbol, len(bars))
        return None

    highs = [float(b["h"]) for b in bars]
    lows = [float(b["l"]) for b in bars]
    volumes = [int(b["v"]) for b in bars]

    return ORBData(
        high=max(highs),
        low=min(lows),
        open_volume=sum(volumes),
        avg_daily_volume=avg_daily_volume,
    )


def is_breakout(
    symbol: str,
    current_price: float,
    orb: ORBData,
    volume_confirm_pct: float = 0.20,
) -> bool:
    """Return True if the current price constitutes a valid ORB breakout.

    Conditions:
    1. Price is above the opening range high.
    2. Opening range volume is at least volume_confirm_pct × avg daily volume
       (confirms that today's session has meaningful participation).
    """
    if current_price <= orb.high:
        return False

    if orb.avg_daily_volume > 0:
        vol_ratio = orb.open_volume / orb.avg_daily_volume
        if vol_ratio < volume_confirm_pct:
            logger.info(
                "%s: price breakout (%.2f > %.2f) but volume too low "
                "(%.1f%% of ADV, need %.0f%%)",
                symbol, current_price, orb.high,
                vol_ratio * 100, volume_confirm_pct * 100,
            )
            return False

    logger.info(
        "%s: ORB breakout confirmed — price %.2f > high %.2f, "
        "open vol %d (%.1f%% ADV)",
        symbol, current_price, orb.high,
        orb.open_volume, (orb.open_volume / max(orb.avg_daily_volume, 1)) * 100,
    )
    return True


def compute_stop_loss(entry_price: float, orb_low: float, stop_loss_pct: float) -> float:
    """Hard stop = tighter of ORB low or entry - stop_loss_pct."""
    return max(orb_low, entry_price * (1 - stop_loss_pct))
