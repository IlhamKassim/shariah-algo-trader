"""Daily NAV snapshot writer (ADR-0010).

Records each account's current equity once per trading day. The store is
append-only and idempotent (INSERT OR IGNORE), so re-running never duplicates a
day's row.

This is deliberately NOT wired into the trading Scheduler — that Scheduler is
owned by the trading bot and must stay untouched (ADR-0010: no change to
trading behaviour). Wire ``snapshot_all_accounts_nav(cfg)`` to a separate cron
or systemd timer if proactive snapshotting of inactive accounts is wanted. The
performance endpoint also backfills opportunistically on read, so the graph
stays correct even without this job being scheduled.
"""

import datetime
import logging
from zoneinfo import ZoneInfo

from dashboard.api.live_equity import live_equity
from dashboard.api.nav_store import record_nav
from dashboard.api.user_store import get_user_settings, list_pilot_users
from shariah_algo_trader.config import Config
from shariah_algo_trader.execution.alpaca_client import AlpacaClient

logger = logging.getLogger(__name__)

_ET = ZoneInfo("America/New_York")


def _snapshot_account(account_id: str, client: AlpacaClient) -> bool:
    equity = live_equity(client)
    if equity is None:
        return False
    today = datetime.datetime.now(_ET).date().isoformat()
    return record_nav(account_id, today, equity)


def snapshot_all_accounts_nav(cfg: Config) -> dict[str, bool]:
    """Snapshot current equity for every account that has Alpaca credentials.

    Returns ``{account_id: recorded?}``. Never raises — a single account
    failure (bad keys, API error, zero equity) is logged and skipped.
    """
    results: dict[str, bool] = {}

    # 1. Default / single-tenant account (server-level credentials).
    if cfg.alpaca_api_key and cfg.alpaca_api_secret:
        try:
            client = AlpacaClient(cfg.alpaca_api_key, cfg.alpaca_api_secret, cfg.alpaca_base_url)
            results["default"] = _snapshot_account("default", client)
        except Exception as exc:  # noqa: BLE001 — per-account isolation
            logger.warning("Default NAV snapshot failed: %s", exc)

    # 2. Multi-tenant pilot accounts (paper credentials only).
    for user in list_pilot_users():
        uid = user.get("user_id")
        if not uid:
            continue
        settings = get_user_settings(uid)
        if not settings:
            continue
        key = settings.get("alpaca_api_key")
        secret = settings.get("alpaca_api_secret")
        if not key or not secret:
            continue
        base_url = settings.get("alpaca_base_url") or cfg.alpaca_base_url
        try:
            client = AlpacaClient(key, secret, base_url)
            results[uid] = _snapshot_account(uid, client)
        except Exception as exc:  # noqa: BLE001 — per-account isolation
            logger.warning("NAV snapshot failed for %s: %s", uid, exc)

    return results
