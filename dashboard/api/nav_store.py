"""Thread-safe SQLite store for daily account-equity (NAV) snapshots.

This is the self-owned source of truth for the dashboard's "since inception"
performance curve (ADR-0010). One row per (account_id, date); rows are
**append-only** — once a trading day is recorded it is never overwritten, so a
later Alpaca history reset cannot rewrite the past.

Never read by trading/rebalancing/compliance logic: it is a read-only audit
record for the dashboard graph, distinct from ADR-0002's "Alpaca is the source
of truth for *current* positions".
"""

import datetime
import sqlite3
import threading
from pathlib import Path

_DB_PATH = Path(__file__).parent.parent.parent / "data" / "portfolio.db"
_lock = threading.Lock()
_initialized = False


def _connect() -> sqlite3.Connection:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_nav_store() -> None:
    """Create the daily_nav table and index on first use."""
    global _initialized
    with _lock:
        conn = _connect()
        try:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS daily_nav (
                    account_id  TEXT NOT NULL,
                    date        TEXT NOT NULL,
                    equity      REAL NOT NULL,
                    recorded_at TEXT NOT NULL,
                    PRIMARY KEY (account_id, date)
                )
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_nav_account
                ON daily_nav (account_id, date ASC)
                """
            )
            conn.commit()
            _initialized = True
        finally:
            conn.close()


def _ensure_initialized() -> None:
    if not _initialized:
        init_nav_store()


def record_nav(account_id: str, date: str, equity: float) -> bool:
    """Record one snapshot. Append-only and idempotent (INSERT OR IGNORE).

    Returns True when a new row was inserted; False when the (account, date)
    pair already existed (or the input was invalid), so re-runs never duplicate.
    """
    if not account_id or not date or equity is None or equity <= 0:
        return False
    _ensure_initialized()
    recorded_at = datetime.datetime.now(tz=datetime.timezone.utc).isoformat()
    with _lock:
        conn = _connect()
        try:
            cur = conn.execute(
                """
                INSERT OR IGNORE INTO daily_nav (account_id, date, equity, recorded_at)
                VALUES (?, ?, ?, ?)
                """,
                (account_id, date, float(equity), recorded_at),
            )
            conn.commit()
            return cur.rowcount == 1
        finally:
            conn.close()


def record_nav_many(account_id: str, items: list[tuple[str, float]]) -> int:
    """Bulk-insert snapshots in one transaction. Append-only (INSERT OR IGNORE).

    ``items`` is a list of (date_iso, equity). Returns the number of rows
    actually inserted (already-present rows are skipped, never overwritten).
    """
    if not account_id or not items:
        return 0
    valid = [(d, float(e)) for (d, e) in items if d and e and float(e) > 0]
    if not valid:
        return 0
    _ensure_initialized()
    recorded_at = datetime.datetime.now(tz=datetime.timezone.utc).isoformat()
    rows = [(account_id, d, e, recorded_at) for (d, e) in valid]
    with _lock:
        conn = _connect()
        try:
            cur = conn.executemany(
                """
                INSERT OR IGNORE INTO daily_nav (account_id, date, equity, recorded_at)
                VALUES (?, ?, ?, ?)
                """,
                rows,
            )
            conn.commit()
            return cur.rowcount
        finally:
            conn.close()


def load_nav(account_id: str) -> dict[str, float]:
    """Return ``{date_iso: equity}`` for one account, ordered oldest → newest."""
    _ensure_initialized()
    with _lock:
        conn = _connect()
        try:
            rows = conn.execute(
                "SELECT date, equity FROM daily_nav WHERE account_id = ? ORDER BY date ASC",
                (account_id,),
            ).fetchall()
            return {r["date"]: float(r["equity"]) for r in rows}
        finally:
            conn.close()
