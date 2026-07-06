import datetime
import json
import logging
import os

from day_trader.execution.order_executor import DayOrderExecutor
from day_trader.state import ActivePosition, DayTraderState

logger = logging.getLogger(__name__)

_QTY_TOLERANCE = 0.001  # 0.1% — Alpaca qty vs. cached qty rounding tolerance

DEFAULT_PATH = os.path.join(os.path.dirname(__file__), ".runtime", "state.json")


def save(state: DayTraderState, path: str | None = None) -> None:
    """Write a same-container-restart-safe snapshot of state to a local JSON file.

    Only caches locally-derived risk parameters (stop level, trailing high-water
    mark, target basis) that Alpaca has no field for — Alpaca's live /v2/positions
    remains the sole authority for what positions actually exist (see load()'s
    reconciliation and docs/adr/0005-day-trader-state-persistence.md). Does not
    survive a full redeploy (fresh container, fresh disk), only a same-container
    process crash/restart.
    """
    path = path or DEFAULT_PATH
    payload = {
        "date": state.date.isoformat(),
        "positions": {
            symbol: {
                "symbol": pos.symbol,
                "entry_price": pos.entry_price,
                "stop_loss": pos.stop_loss,
                "highest_price": pos.highest_price,
                "qty": pos.qty,
                "gap_amount": pos.gap_amount,
            }
            for symbol, pos in state.positions.items()
        },
        "traded_today": sorted(state.traded_today),
        "starting_equity": state.starting_equity,
        "circuit_broken": state.circuit_broken,
    }
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            json.dump(payload, f)
    except (OSError, TypeError, ValueError) as exc:
        # Never let a persistence hiccup break the caller's actual trading logic —
        # this is a best-effort cache, not the source of truth (see ADR-0005).
        logger.error("Failed to save day-trader state cache: %s", exc)


def load(path: str | None = None) -> dict | None:
    """Read back a saved state snapshot, or None if missing/stale (not today)."""
    path = path or DEFAULT_PATH
    if not os.path.exists(path):
        return None
    try:
        with open(path) as f:
            payload = json.load(f)
    except (OSError, json.JSONDecodeError) as exc:
        logger.error("Failed to load day-trader state cache: %s", exc)
        return None

    if payload.get("date") != datetime.date.today().isoformat():
        logger.info("Day-trader state cache is stale (date %s) — ignoring", payload.get("date"))
        return None

    payload["positions"] = {
        symbol: ActivePosition(**fields) for symbol, fields in payload["positions"].items()
    }
    payload["traded_today"] = set(payload["traded_today"])
    return payload


def reconcile_on_startup(state: DayTraderState, executor: DayOrderExecutor) -> None:
    """Restore cached risk parameters for still-open positions after a restart.

    Alpaca's live /v2/positions remains the sole authority for what's actually
    open (per docs/adr/0002-alpaca-as-portfolio-state-source-of-truth.md) — the
    local cache is only trusted for a symbol Alpaca itself confirms is open with
    a matching quantity. Any live Alpaca position with no matching cached record
    has no recoverable stop/target parameters, so it's liquidated immediately
    rather than held un-managed (see docs/adr/0005-day-trader-state-persistence.md).
    """
    # No cache at all (missing or stale) means no live position could possibly
    # have a matching record — still need to sweep for and liquidate orphans,
    # so this proceeds with an empty cache rather than returning early.
    cached = load() or {
        "positions": {}, "traded_today": set(),
        "starting_equity": None, "circuit_broken": False,
    }

    try:
        live_positions = executor.list_positions()
    except Exception as exc:
        logger.error("Reconciliation: failed to fetch live Alpaca positions: %s", exc)
        return

    for pos in live_positions:
        symbol = pos["symbol"]
        live_qty = float(pos["qty"])
        cached_pos = cached["positions"].get(symbol)

        if cached_pos is not None and abs(cached_pos.qty - live_qty) / max(live_qty, 1e-9) <= _QTY_TOLERANCE:
            state.positions[symbol] = cached_pos
            logger.info("Reconciliation: restored %s from cache (qty %.4f)", symbol, live_qty)
        else:
            logger.warning(
                "Reconciliation: %s open on Alpaca with no matching cached risk parameters — liquidating",
                symbol,
            )
            executor.sell(symbol, reason="orphaned on restart, no cached risk parameters")

    state.traded_today = cached["traded_today"]
    state.starting_equity = cached["starting_equity"]
    state.circuit_broken = cached["circuit_broken"]
