import logging

logger = logging.getLogger(__name__)


def is_valid_breakout_entry(
    symbol: str,
    current_price: float,
    range_high: float,
    rvol: float,
    rvol_threshold: float = 1.5,
) -> bool:
    """Return True if price has broken above the opening range with volume confirmation.

    Conditions:
    1. Current price > the opening range high (momentum continuing past the morning's range).
    2. Rolling RVOL >= rvol_threshold (real participation behind the breakout, not thin volume).
    """
    if current_price <= range_high:
        return False

    if rvol < rvol_threshold:
        logger.info(
            "%s: broke range high (%.2f > %.2f) but RVOL too low (%.2f, need %.1f)",
            symbol, current_price, range_high, rvol, rvol_threshold,
        )
        return False

    logger.info(
        "%s: ORB breakout entry — price %.2f above range high %.2f, RVOL %.2f",
        symbol, current_price, range_high, rvol,
    )
    return True
