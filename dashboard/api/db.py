"""SQLite-backed notifications store.

Provides a thread-safe, single-file DB at <project_root>/data/notifications.db.
All public functions acquire a module-level lock so they're safe to call from
FastAPI request handlers and background threads concurrently.
"""

import datetime
import sqlite3
import threading
import uuid
from pathlib import Path

_DB_PATH = Path(__file__).parent.parent.parent / "data" / "notifications.db"
_lock = threading.Lock()


# ── Connection ────────────────────────────────────────────────────────────────

def _connect() -> sqlite3.Connection:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


# ── Schema ────────────────────────────────────────────────────────────────────

_initialized = False


def init_db() -> None:
    """Create the notifications and audit_logs tables and indexes on first run."""
    global _initialized
    with _lock:
        conn = _connect()
        try:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS notifications (
                    id         TEXT PRIMARY KEY,
                    source     TEXT NOT NULL,
                    category   TEXT NOT NULL,
                    severity   TEXT NOT NULL,
                    title      TEXT NOT NULL,
                    body       TEXT NOT NULL,
                    read       INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_notif_created
                ON notifications (created_at DESC)
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id          TEXT PRIMARY KEY,
                    event_type  TEXT NOT NULL,
                    actor       TEXT NOT NULL,
                    ip_address  TEXT NOT NULL,
                    details     TEXT NOT NULL,
                    created_at  TEXT NOT NULL
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_audit_created
                ON audit_logs (created_at DESC)
            """)
            conn.commit()
            _initialized = True
        finally:
            conn.close()


def _ensure_db_initialized() -> None:
    if not _initialized:
        init_db()


# ── Audit Log Helpers ────────────────────────────────────────────────────────

def log_audit_event(
    event_type: str,
    actor: str,
    ip_address: str,
    details: str,
) -> str:
    """Record a security or administrative event in the audit_logs table."""
    _ensure_db_initialized()
    event_id = str(uuid.uuid4())
    created_at = datetime.datetime.now(tz=datetime.timezone.utc).isoformat()
    with _lock:
        conn = _connect()
        try:
            conn.execute(
                """
                INSERT INTO audit_logs (id, event_type, actor, ip_address, details, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (event_id, event_type, actor, ip_address, details, created_at),
            )
            conn.commit()
            return event_id
        finally:
            conn.close()


def fetch_audit_logs(limit: int = 50) -> list[sqlite3.Row]:
    """Return the most recent *limit* audit log entries, newest first."""
    _ensure_db_initialized()
    with _lock:
        conn = _connect()
        try:
            return conn.execute(
                """
                SELECT id, event_type, actor, ip_address, details, created_at
                FROM audit_logs
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        finally:
            conn.close()




# ── Write helpers ─────────────────────────────────────────────────────────────

def purge_old(days: int = 30) -> None:
    """Delete notifications older than *days* days (rolling window)."""
    with _lock:
        conn = _connect()
        try:
            conn.execute(
                "DELETE FROM notifications WHERE created_at < datetime('now', ?)",
                (f"-{days} days",),
            )
            conn.commit()
        finally:
            conn.close()


def insert_notification(
    id: str,
    source: str,
    category: str,
    severity: str,
    title: str,
    body: str,
    created_at: str,
) -> bool:
    """Insert a notification row.

    Uses ``INSERT OR IGNORE`` so re-seeding on restart is idempotent.
    Returns ``True`` if the row was actually inserted, ``False`` if it
    already existed.
    """
    with _lock:
        conn = _connect()
        try:
            conn.execute(
                """
                INSERT OR IGNORE INTO notifications
                    (id, source, category, severity, title, body, read, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 0, ?)
                """,
                (id, source, category, severity, title, body, created_at),
            )
            inserted = conn.total_changes > 0
            conn.commit()
            return inserted
        finally:
            conn.close()


# ── Read helpers ──────────────────────────────────────────────────────────────

def fetch_notifications(limit: int = 50) -> list[sqlite3.Row]:
    """Return the most recent *limit* notifications, newest first."""
    with _lock:
        conn = _connect()
        try:
            return conn.execute(
                """
                SELECT id, source, category, severity, title, body, read, created_at
                FROM notifications
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        finally:
            conn.close()


def count_unread() -> int:
    with _lock:
        conn = _connect()
        try:
            return conn.execute(
                "SELECT COUNT(*) FROM notifications WHERE read = 0"
            ).fetchone()[0]
        finally:
            conn.close()


def mark_all_read() -> None:
    with _lock:
        conn = _connect()
        try:
            conn.execute("UPDATE notifications SET read = 1")
            conn.commit()
        finally:
            conn.close()


def mark_one_read(notification_id: str) -> None:
    with _lock:
        conn = _connect()
        try:
            conn.execute(
                "UPDATE notifications SET read = 1 WHERE id = ?",
                (notification_id,),
            )
            conn.commit()
        finally:
            conn.close()
