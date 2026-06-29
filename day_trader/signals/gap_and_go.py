import logging

from day_trader.state import GapData

logger = logging.getLogger(__name__)


def compute_gap(
    symbol: str,
    open_price: float,
    prev_close: float,
    first_min_volume: int,
    avg_daily_volume: float,
) -> GapData | None:
    """Compute gap metrics from the first price print after open.

    Returns None if prev_close is missing or prices are invalid.
    """
    if prev_close <= 0 or open_price <= 0:
        return None

    gap_pct = (open_price - prev_close) / prev_close
    gap_amount = open_price - prev_close

    # RVOL: first-minute volume vs historical 1-minute rate (ADV / 390 minutes)
    expected_1min = avg_daily_volume / 390
    rvol = first_min_volume / max(expected_1min, 1)

    return GapData(
        prev_close=prev_close,
        gap_pct=gap_pct,
        gap_amount=gap_amount,
        rvol=rvol,
    )


def is_valid_gap_entry(
    symbol: str,
    gap: GapData,
    gap_threshold: float = 0.03,
    rvol_threshold: float = 1.5,
) -> bool:
    """Return True if this gap qualifies for a Gap and Go entry.

    Conditions:
    1. Gap >= gap_threshold above prior close (overnight catalyst required).
    2. First-minute RVOL >= rvol_threshold (real participation at open, not thin volume).
    """
    if gap.gap_pct < gap_threshold:
        logger.info(
            "%s: gap too small (%.1f%%, need %.0f%%)",
            symbol, gap.gap_pct * 100, gap_threshold * 100,
        )
        return False

    if gap.rvol < rvol_threshold:
        logger.info(
            "%s: gap confirmed (%.1f%%) but first-minute RVOL too low (%.2f, need %.1f)",
            symbol, gap.gap_pct * 100, gap.rvol, rvol_threshold,
        )
        return False

    logger.info(
        "%s: Gap and Go entry — gap %.1f%% ($%.2f), RVOL %.2f",
        symbol, gap.gap_pct * 100, gap.gap_amount, gap.rvol,
    )
    return True
