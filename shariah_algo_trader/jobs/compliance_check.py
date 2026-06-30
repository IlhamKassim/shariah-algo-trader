import logging
from typing import Callable

from shariah_algo_trader.execution.order_executor import OrderExecutor

logger = logging.getLogger(__name__)


def run_compliance_check(
    get_portfolio: Callable[[], set[str]],
    fetch_universe: Callable[[], set[str]],
    executor: OrderExecutor,
    get_position_weights: Callable[[], dict[str, float]] | None = None,
    get_target_weights: Callable[[], dict[str, float]] | None = None,
    drift_threshold: float = 0.03,
    top_n: int = 20,
    trigger_rebalance: Callable[[], None] | None = None,
) -> None:
    """Run compliance exits and drift-based rebalance detection.

    Compliance: immediately sells any holding absent from the Eligible Universe.

    Drift: if any position's weight deviates more than `drift_threshold` from
    its target inv-vol weight (or equal weight when no target is available),
    calls `trigger_rebalance` to force an early rebalance.
    Drift detection is skipped when `get_position_weights` or `trigger_rebalance`
    are not provided.
    """
    logger.info("Compliance Check starting")
    portfolio = get_portfolio()
    eligible_universe = fetch_universe()

    non_compliant = portfolio - eligible_universe
    if non_compliant:
        logger.warning(
            "Compliance Exit triggered for %d stock(s): %s",
            len(non_compliant), sorted(non_compliant),
        )
        for ticker in non_compliant:
            executor.sell(ticker)
        logger.info("Compliance Check — %d Compliance Exit(s) submitted", len(non_compliant))
    else:
        logger.info("Compliance Check — Portfolio fully compliant, no exits required")

    # Drift detection
    if get_position_weights is None or trigger_rebalance is None:
        return

    try:
        weights = get_position_weights()
    except Exception as exc:
        logger.warning("Drift check: failed to fetch position weights (%s), skipping", exc)
        return

    if not weights:
        return

    # Use target inv-vol weights if available; fall back to equal weight.
    target: dict[str, float] = {}
    if get_target_weights is not None:
        try:
            target = get_target_weights()
        except Exception as exc:
            logger.warning("Drift check: failed to fetch target weights (%s), falling back to equal weight", exc)
    fallback_weight = 1.0 / top_n

    drifted = {
        ticker: weight
        for ticker, weight in weights.items()
        if abs(weight - target.get(ticker, fallback_weight)) > drift_threshold
    }

    if drifted:
        logger.warning(
            "Drift detected in %d position(s): %s — triggering early rebalance",
            len(drifted),
            {t: f"{w:.1%}" for t, w in sorted(drifted.items(), key=lambda x: -abs(x[1] - target.get(x[0], fallback_weight)))},
        )
        try:
            trigger_rebalance()
        except Exception as exc:
            logger.error("Drift-triggered rebalance failed: %s", exc, exc_info=True)
    else:
        logger.info(
            "Drift check — all %d positions within %.1f%% of target weight",
            len(weights), drift_threshold * 100,
        )
