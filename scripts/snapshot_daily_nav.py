"""One-shot daily NAV snapshot (ADR-0010 writer).

Run once per trading day (cron / systemd timer) to record every account's
current equity into the NAV store. Safe to run repeatedly: the store is
append-only and idempotent, so re-runs never duplicate a day's row.

Usage:
    .venv/bin/python scripts/snapshot_daily_nav.py
"""

import json
import logging

from dashboard.api.nav_job import snapshot_all_accounts_nav
from shariah_algo_trader.config import Config

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")
logger = logging.getLogger("snapshot_daily_nav")


def main() -> None:
    cfg = Config()
    results = snapshot_all_accounts_nav(cfg)
    logger.info("NAV snapshot results: %s", json.dumps(results, default=str))


if __name__ == "__main__":
    main()
