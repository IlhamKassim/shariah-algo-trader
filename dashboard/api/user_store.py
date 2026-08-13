"""Thread-safe SQLite store for per-user settings and encrypted credentials.

Ensures zero-bloat database storage (< 0.5 KB per user record) and automatic key encryption.
"""

import datetime
import secrets
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
                    risk_acknowledged_at              TEXT,
                    created_at                        TEXT NOT NULL,
                    updated_at                        TEXT NOT NULL
                )
            """)
            # Beta pilot (SPEC-BETA-PILOT.md section 6): LOCAL-ONLY pilot
            # registry tables — the pilot lifecycle (invites, pending/active/
            # revoked states) is server-side; deliberately NOT mirrored to
            # Supabase (avoids new RLS surface).
            conn.execute("""
                CREATE TABLE IF NOT EXISTS pilot_users (
                    user_id        TEXT PRIMARY KEY,          -- Supabase auth UID (UUID string)
                    email          TEXT NOT NULL,
                    role           TEXT NOT NULL DEFAULT 'tester',   -- 'tester' | 'admin'
                    state          TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'active' | 'revoked'
                    invite_code    TEXT,                      -- code they signed up with
                    linkedin_url   TEXT,                      -- collected at onboarding
                    notes          TEXT,                      -- admin free text
                    approved_by    TEXT,                      -- admin user_id
                    created_at     TEXT NOT NULL,
                    updated_at     TEXT NOT NULL
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS pilot_invites (
                    code           TEXT PRIMARY KEY,          -- e.g. 8-char URL-safe token
                    created_by     TEXT NOT NULL,             -- admin user_id
                    max_uses       INTEGER NOT NULL DEFAULT 1,
                    uses           INTEGER NOT NULL DEFAULT 0,
                    expires_at     TEXT NOT NULL,
                    created_at     TEXT NOT NULL
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
            if "risk_acknowledged_at" not in existing_cols:
                cursor.execute("ALTER TABLE user_settings ADD COLUMN risk_acknowledged_at TEXT")
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
                            shariah_trader_enabled, day_trader_enabled, risk_acknowledged_at,
                            created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                            sb_data.get("risk_acknowledged_at"),
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

    # G3 (paper-only invariant, SPEC section 8): a pilot tester can never
    # persist live-key columns or trading_mode='live' — checked here, before
    # the sync record is built, as defense when routers are bypassed.
    _enforce_paper_only(user_id, settings, existing)

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

    # Resolve default base URL based on trading_mode if not explicitly provided.
    # Any user-supplied URL must pass SSRF validation (https + *.alpaca.markets
    # + public resolution) — this is the single write path for per-user URLs.
    from dashboard.api.hardening import validate_alpaca_base_url
    if "alpaca_base_url" in settings and settings["alpaca_base_url"]:
        validated = validate_alpaca_base_url(settings["alpaca_base_url"])
        if not validated:
            raise ValueError(
                f"Invalid alpaca_base_url: {settings['alpaca_base_url']!r} — "
                "must be an https URL on an *.alpaca.markets host."
            )
        base_url = validated
    else:
        if trading_mode == "live":
            base_url = "https://api.alpaca.markets"
        else:
            existing_url = existing.get("alpaca_base_url")
            validated = validate_alpaca_base_url(existing_url)
            base_url = validated or "https://paper-api.alpaca.markets"

    risk_acknowledged_at = settings.get("risk_acknowledged_at") or existing.get("risk_acknowledged_at")

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
        "risk_acknowledged_at": risk_acknowledged_at,
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
                    risk_acknowledged_at,
                    created_at,
                    updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    risk_acknowledged_at = excluded.risk_acknowledged_at,
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
                    risk_acknowledged_at,
                    created_at,
                    now,
                ),
            )
            conn.commit()
        finally:
            conn.close()

    # Sync to Supabase PostgreSQL database
    _sync_to_supabase(user_id, record)


# ── Pilot store helpers (SPEC-BETA-PILOT.md section 6) ───────────────────────

_INVITE_TTL_DAYS = 30


class PaperOnlyGuardError(Exception):
    """Raised when a pilot tester attempts to persist live trading state (G3)."""


def pilot_guard_enabled() -> bool:
    """Rollback switch for all paper-only guardrail checks (spec section 10).

    Set ``PILOT_GUARD_DISABLE=1`` to turn the guardrails off; default unset
    means the guards are active.
    """
    import os

    return os.environ.get("PILOT_GUARD_DISABLE") != "1"


def _enforce_paper_only(user_id: str, settings: dict, existing: dict) -> None:
    """G3: refuse to persist live-key columns or ``trading_mode='live'`` for a tester.

    Defense-in-depth when routers are bypassed — the check runs in the store
    itself, before the sync record is built.
    """
    if not pilot_guard_enabled():
        return
    if get_pilot_role(user_id) != "tester":
        return
    requested_mode = settings.get("trading_mode") or existing.get("trading_mode") or "paper"
    live_key = settings.get("alpaca_live_api_key")
    live_secret = settings.get("alpaca_live_api_secret")
    live_key_present = bool(live_key and "•" not in live_key)
    live_secret_present = bool(live_secret and "•" not in live_secret)
    if requested_mode == "live" or live_key_present or live_secret_present:
        raise PaperOnlyGuardError(
            "Paper-only pilot account: tester role cannot save live trading credentials or enable live trading mode."
        )


def _utcnow_iso() -> str:
    return datetime.datetime.now(tz=datetime.timezone.utc).isoformat()


def create_pilot_invite(
    created_by: str,
    max_uses: int = 1,
    expires_at: str | datetime.datetime | None = None,
    code: str | None = None,
) -> str:
    """Create a single-use pilot invite and return its code.

    ``expires_at`` defaults to 30 days from now; ``code`` defaults to an
    8-character URL-safe token. Collisions are retried.
    """
    _ensure_initialized()
    if expires_at is None:
        expires_at = (datetime.datetime.now(tz=datetime.timezone.utc) + datetime.timedelta(days=_INVITE_TTL_DAYS)).isoformat()
    elif isinstance(expires_at, datetime.datetime):
        expires_at = expires_at.isoformat()

    for _ in range(5):
        token = code or secrets.token_urlsafe(6)[:8]
        with _lock:
            conn = _connect()
            try:
                cur = conn.execute(
                    "INSERT OR IGNORE INTO pilot_invites (code, created_by, max_uses, uses, expires_at, created_at) "
                    "VALUES (?, ?, ?, 0, ?, ?)",
                    (token, created_by, max_uses, expires_at, _utcnow_iso()),
                )
                conn.commit()
                inserted = cur.rowcount == 1
            finally:
                conn.close()
        if inserted or code is not None:
            return token
    raise RuntimeError("Unable to allocate a unique pilot invite code")


def get_pilot_invite(code: str) -> dict | None:
    _ensure_initialized()
    with _lock:
        conn = _connect()
        try:
            row = conn.execute(
                "SELECT code, created_by, max_uses, uses, expires_at, created_at FROM pilot_invites WHERE code = ?",
                (code,),
            ).fetchone()
            return dict(row) if row else None
        finally:
            conn.close()


def list_pilot_invites() -> list[dict]:
    _ensure_initialized()
    with _lock:
        conn = _connect()
        try:
            return [dict(r) for r in conn.execute(
                "SELECT code, created_by, max_uses, uses, expires_at, created_at FROM pilot_invites ORDER BY created_at DESC"
            ).fetchall()]
        finally:
            conn.close()


def validate_invite_code(code: str) -> dict:
    """Validate an invite code (exists, unexpired, not used up).

    Returns ``{"valid": bool, "reason": str | None, "invite": dict | None}``.
    """
    if not code:
        return {"valid": False, "reason": "Invite code is required.", "invite": None}
    invite = get_pilot_invite(code)
    if invite is None:
        return {"valid": False, "reason": "Invalid invite code.", "invite": None}
    if invite["expires_at"] < _utcnow_iso():
        return {"valid": False, "reason": "Invite code has expired.", "invite": invite}
    if invite["uses"] >= invite["max_uses"]:
        return {"valid": False, "reason": "Invite code has already been used.", "invite": invite}
    return {"valid": True, "reason": None, "invite": invite}


def get_pilot_user(user_id: str) -> dict | None:
    _ensure_initialized()
    with _lock:
        conn = _connect()
        try:
            row = conn.execute("SELECT * FROM pilot_users WHERE user_id = ?", (user_id,)).fetchone()
            return dict(row) if row else None
        finally:
            conn.close()


def list_pilot_users() -> list[dict]:
    _ensure_initialized()
    with _lock:
        conn = _connect()
        try:
            return [dict(r) for r in conn.execute(
                "SELECT * FROM pilot_users ORDER BY created_at DESC"
            ).fetchall()]
        finally:
            conn.close()


def set_pilot_user_state(user_id: str, state: str, approved_by: str | None = None) -> None:
    """Advance a pilot user's lifecycle state ('pending' | 'active' | 'revoked')."""
    _ensure_initialized()
    with _lock:
        conn = _connect()
        try:
            conn.execute(
                "UPDATE pilot_users SET state = ?, approved_by = COALESCE(?, approved_by), updated_at = ? WHERE user_id = ?",
                (state, approved_by, _utcnow_iso(), user_id),
            )
            conn.commit()
        finally:
            conn.close()


def get_pilot_role(user_id: str) -> str | None:
    """Return the pilot role ('tester' | 'admin') or None when not a pilot user."""
    user = get_pilot_user(user_id)
    return user["role"] if user else None


def is_tester(user_id: str) -> bool:
    return get_pilot_role(user_id) == "tester"


def claim_pilot_invite(
    user_id: str,
    email: str,
    code: str,
    linkedin_url: str | None = None,
    notes: str | None = None,
) -> dict:
    """Validate a single-use invite and provision the caller as a pending tester.

    Idempotent: a user who already has a pilot_users row is returned as
    already-provisioned without consuming the code again. Rejected claims are
    logged to ``audit_logs`` (AC-4). Returns ``{"ok": bool, ...}``.
    """
    _ensure_initialized()
    from dashboard.api.db import log_audit_event

    existing = get_pilot_user(user_id)
    if existing is not None:
        return {"ok": True, "state": existing["state"], "already_provisioned": True}

    validation = validate_invite_code(code)
    if not validation["valid"]:
        log_audit_event(
            "INVITE_REJECTED",
            user_id,
            "user",
            f"Pilot invite claim rejected: {validation['reason']} (code={code!r})",
        )
        return {"ok": False, "reason": validation["reason"]}

    now = _utcnow_iso()
    with _lock:
        conn = _connect()
        try:
            conn.execute("UPDATE pilot_invites SET uses = uses + 1 WHERE code = ?", (code,))
            conn.execute(
                """
                INSERT INTO pilot_users (
                    user_id, email, role, state, invite_code, linkedin_url, notes, created_at, updated_at
                ) VALUES (?, ?, 'tester', 'pending', ?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    email = excluded.email,
                    state = 'pending',
                    updated_at = excluded.updated_at
                """,
                (user_id, email, code, linkedin_url, notes, now, now),
            )
            conn.commit()
        finally:
            conn.close()

    log_audit_event("INVITE_CLAIMED", user_id, "user", f"Pilot invite {code} claimed; state=pending")
    return {"ok": True, "state": "pending"}
