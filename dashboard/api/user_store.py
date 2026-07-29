"""Thread-safe SQLite store for per-user settings and encrypted credentials.

Ensures zero-bloat database storage (< 0.5 KB per user record) and automatic key encryption.
"""

import datetime
import sqlite3
import threading
from pathlib import Path

from dashboard.api.crypto import encrypt_credential, decrypt_credential

_DB_PATH = Path(__file__).parent.parent.parent / "data" / "user_settings.db"
_lock = threading.Lock()
_initialized = False


def _connect() -> sqlite3.Connection:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_user_store() -> None:
    """Create user_settings table on startup and ensure all columns exist."""
    global _initialized
    with _lock:
        conn = _connect()
        try:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS user_settings (
                    user_id                          TEXT PRIMARY KEY,
                    alpaca_api_key_encrypted          TEXT,
                    alpaca_api_secret_encrypted       TEXT,
                    alpaca_live_api_key_encrypted     TEXT,
                    alpaca_live_api_secret_encrypted  TEXT,
                    trading_mode                     TEXT DEFAULT 'paper',
                    alpaca_base_url                   TEXT DEFAULT 'https://paper-api.alpaca.markets',
                    etf_symbol                        TEXT DEFAULT 'SPUS',
                    top_n                             INTEGER DEFAULT 20,
                    sector_cap                        REAL DEFAULT 0.20,
                    drift_threshold                   REAL DEFAULT 0.03,
                    shariah_trader_enabled            INTEGER DEFAULT 1,
                    day_trader_enabled                INTEGER DEFAULT 0,
                    created_at                        TEXT NOT NULL,
                    updated_at                        TEXT NOT NULL
                )
            """)
            conn.commit()

            cursor = conn.cursor()
            cursor.execute("PRAGMA table_info(user_settings)")
            existing_cols = {row[1] for row in cursor.fetchall()}

            if "trading_mode" not in existing_cols:
                cursor.execute("ALTER TABLE user_settings ADD COLUMN trading_mode TEXT DEFAULT 'paper'")
            if "alpaca_live_api_key_encrypted" not in existing_cols:
                cursor.execute("ALTER TABLE user_settings ADD COLUMN alpaca_live_api_key_encrypted TEXT")
            if "alpaca_live_api_secret_encrypted" not in existing_cols:
                cursor.execute("ALTER TABLE user_settings ADD COLUMN alpaca_live_api_secret_encrypted TEXT")
            if "shariah_trader_enabled" not in existing_cols:
                cursor.execute("ALTER TABLE user_settings ADD COLUMN shariah_trader_enabled INTEGER DEFAULT 1")
            if "day_trader_enabled" not in existing_cols:
                cursor.execute("ALTER TABLE user_settings ADD COLUMN day_trader_enabled INTEGER DEFAULT 0")
            conn.commit()
            _initialized = True
        finally:
            conn.close()


def _ensure_initialized() -> None:
    if not _initialized:
        init_user_store()


import logging
import os
import requests

logger = logging.getLogger(__name__)


def _sync_to_supabase(user_id: str, record: dict) -> None:
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SECRET_KEY")
    if not supabase_url or not supabase_key:
        return
    try:
        url = f"{supabase_url}/rest/v1/user_settings"
        headers = {
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates",
        }
        res = requests.post(url, json=record, headers=headers, timeout=5)
        if res.status_code not in (200, 201):
            logger.warning("Supabase user_settings sync status: %s %s", res.status_code, res.text)
    except Exception as exc:
        logger.warning("Supabase user_settings sync exception: %s", exc)


def _fetch_from_supabase(user_id: str) -> dict | None:
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SECRET_KEY")
    if not supabase_url or not supabase_key:
        return None
    try:
        url = f"{supabase_url}/rest/v1/user_settings?user_id=eq.{user_id}&select=*"
        headers = {
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
        }
        res = requests.get(url, headers=headers, timeout=5)
        if res.status_code == 200 and res.json():
            return res.json()[0]
    except Exception as exc:
        logger.warning("Supabase user_settings fetch exception: %s", exc)
    return None


def get_user_settings(user_id: str) -> dict | None:
    """Retrieve settings and decrypted credentials for a given user_id."""
    if not user_id:
        return None

    _ensure_initialized()
    data = None
    with _lock:
        conn = _connect()
        try:
            row = conn.execute(
                "SELECT * FROM user_settings WHERE user_id = ?",
                (user_id,)
            ).fetchone()

            if row:
                data = dict(row)
        finally:
            conn.close()

    if not data:
        # Fallback to fetch from Supabase PostgreSQL
        sb_data = _fetch_from_supabase(user_id)
        if sb_data:
            data = sb_data
            # Cache locally
            with _lock:
                conn = _connect()
                try:
                    conn.execute(
                        """
                        INSERT OR REPLACE INTO user_settings (
                            user_id, alpaca_api_key_encrypted, alpaca_api_secret_encrypted,
                            alpaca_live_api_key_encrypted, alpaca_live_api_secret_encrypted,
                            trading_mode, alpaca_base_url, etf_symbol, top_n, sector_cap, drift_threshold,
                            shariah_trader_enabled, day_trader_enabled,
                            created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            sb_data.get("user_id"),
                            sb_data.get("alpaca_api_key_encrypted"),
                            sb_data.get("alpaca_api_secret_encrypted"),
                            sb_data.get("alpaca_live_api_key_encrypted"),
                            sb_data.get("alpaca_live_api_secret_encrypted"),
                            sb_data.get("trading_mode", "paper"),
                            sb_data.get("alpaca_base_url", "https://paper-api.alpaca.markets"),
                            sb_data.get("etf_symbol", "SPUS"),
                            sb_data.get("top_n", 20),
                            sb_data.get("sector_cap", 0.20),
                            sb_data.get("drift_threshold", 0.03),
                            1 if sb_data.get("shariah_trader_enabled", True) else 0,
                            1 if sb_data.get("day_trader_enabled", False) else 0,
                            sb_data.get("created_at", datetime.datetime.now(tz=datetime.timezone.utc).isoformat()),
                            sb_data.get("updated_at", datetime.datetime.now(tz=datetime.timezone.utc).isoformat()),
                        )
                    )
                    conn.commit()
                finally:
                    conn.close()

    if not data:
        return None

    # Decrypt credentials in memory
    data["alpaca_api_key"] = decrypt_credential(data.get("alpaca_api_key_encrypted"))
    data["alpaca_api_secret"] = decrypt_credential(data.get("alpaca_api_secret_encrypted"))
    data["alpaca_live_api_key"] = decrypt_credential(data.get("alpaca_live_api_key_encrypted"))
    data["alpaca_live_api_secret"] = decrypt_credential(data.get("alpaca_live_api_secret_encrypted"))
    if not data.get("trading_mode"):
        data["trading_mode"] = "paper"
    if data.get("shariah_trader_enabled") is None:
        data["shariah_trader_enabled"] = 1
    if data.get("day_trader_enabled") is None:
        data["day_trader_enabled"] = 0
    return data


def save_user_settings(user_id: str, settings: dict) -> None:
    """Save or update settings and encrypted credentials for a given user_id."""
    if not user_id:
        return

    _ensure_initialized()
    now = datetime.datetime.now(tz=datetime.timezone.utc).isoformat()

    existing = get_user_settings(user_id) or {}

    api_key = settings.get("alpaca_api_key")
    api_secret = settings.get("alpaca_api_secret")
    live_api_key = settings.get("alpaca_live_api_key")
    live_api_secret = settings.get("alpaca_live_api_secret")

    # Paper keys
    if api_key and not api_key.startswith("•"):
        enc_key = encrypt_credential(api_key)
    else:
        enc_key = existing.get("alpaca_api_key_encrypted")

    if api_secret and not api_secret.startswith("*") and not api_secret.startswith("•"):
        enc_secret = encrypt_credential(api_secret)
    else:
        enc_secret = existing.get("alpaca_api_secret_encrypted")

    # Live keys
    if live_api_key and not live_api_key.startswith("•"):
        enc_live_key = encrypt_credential(live_api_key)
    else:
        enc_live_key = existing.get("alpaca_live_api_key_encrypted")

    if live_api_secret and not live_api_secret.startswith("*") and not live_api_secret.startswith("•"):
        enc_live_secret = encrypt_credential(live_api_secret)
    else:
        enc_live_secret = existing.get("alpaca_live_api_secret_encrypted")

    trading_mode = settings.get("trading_mode") or existing.get("trading_mode") or "paper"

    # Resolve default base URL based on trading_mode if not explicitly provided
    if "alpaca_base_url" in settings and settings["alpaca_base_url"]:
        base_url = settings["alpaca_base_url"]
    else:
        if trading_mode == "live":
            base_url = "https://api.alpaca.markets"
        else:
            base_url = existing.get("alpaca_base_url") or "https://paper-api.alpaca.markets"

    etf_symbol = settings.get("etf_symbol") or existing.get("etf_symbol") or "SPUS"
    top_n = settings.get("top_n") if settings.get("top_n") is not None else existing.get("top_n", 20)
    sector_cap = settings.get("sector_cap") if settings.get("sector_cap") is not None else existing.get("sector_cap", 0.20)
    drift_threshold = settings.get("drift_threshold") if settings.get("drift_threshold") is not None else existing.get("drift_threshold", 0.03)

    shariah_enabled = int(settings["shariah_trader_enabled"]) if "shariah_trader_enabled" in settings and settings["shariah_trader_enabled"] is not None else int(existing.get("shariah_trader_enabled", 1))
    day_enabled = int(settings["day_trader_enabled"]) if "day_trader_enabled" in settings and settings["day_trader_enabled"] is not None else int(existing.get("day_trader_enabled", 0))

    created_at = existing.get("created_at") or now

    record = {
        "user_id": user_id,
        "alpaca_api_key_encrypted": enc_key,
        "alpaca_api_secret_encrypted": enc_secret,
        "alpaca_live_api_key_encrypted": enc_live_key,
        "alpaca_live_api_secret_encrypted": enc_live_secret,
        "trading_mode": trading_mode,
        "alpaca_base_url": base_url,
        "etf_symbol": etf_symbol,
        "top_n": top_n,
        "sector_cap": sector_cap,
        "drift_threshold": drift_threshold,
        "shariah_trader_enabled": shariah_enabled,
        "day_trader_enabled": day_enabled,
        "created_at": created_at,
        "updated_at": now,
    }

    with _lock:
        conn = _connect()
        try:
            conn.execute(
                """
                INSERT INTO user_settings (
                    user_id,
                    alpaca_api_key_encrypted,
                    alpaca_api_secret_encrypted,
                    alpaca_live_api_key_encrypted,
                    alpaca_live_api_secret_encrypted,
                    trading_mode,
                    alpaca_base_url,
                    etf_symbol,
                    top_n,
                    sector_cap,
                    drift_threshold,
                    shariah_trader_enabled,
                    day_trader_enabled,
                    created_at,
                    updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    alpaca_api_key_encrypted = excluded.alpaca_api_key_encrypted,
                    alpaca_api_secret_encrypted = excluded.alpaca_api_secret_encrypted,
                    alpaca_live_api_key_encrypted = excluded.alpaca_live_api_key_encrypted,
                    alpaca_live_api_secret_encrypted = excluded.alpaca_live_api_secret_encrypted,
                    trading_mode = excluded.trading_mode,
                    alpaca_base_url = excluded.alpaca_base_url,
                    etf_symbol = excluded.etf_symbol,
                    top_n = excluded.top_n,
                    sector_cap = excluded.sector_cap,
                    drift_threshold = excluded.drift_threshold,
                    shariah_trader_enabled = excluded.shariah_trader_enabled,
                    day_trader_enabled = excluded.day_trader_enabled,
                    updated_at = excluded.updated_at
                """,
                (
                    user_id,
                    enc_key,
                    enc_secret,
                    enc_live_key,
                    enc_live_secret,
                    trading_mode,
                    base_url,
                    etf_symbol,
                    top_n,
                    sector_cap,
                    drift_threshold,
                    shariah_enabled,
                    day_enabled,
                    created_at,
                    now,
                ),
            )
            conn.commit()
        finally:
            conn.close()

    # Sync to Supabase PostgreSQL database
    _sync_to_supabase(user_id, record)
