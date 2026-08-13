"""Scaffold tests for the standalone admin app (admin-app/, port 8002).

Covers the Phase 2 contract from SPEC-BETA-PILOT.md sections 5.1-5.4:

- GET /api/health is public (200, no auth).
- The /api/admin/* router is gated by dashboard auth imported from
  ``dashboard.api.deps`` (verify_auth + is_admin — never copied): anonymous
  401, tester-role JWT 403, admin JWT 200 (AC-7).
- The SPA static mount serves ``web/dist`` at "/".

The backend package lives at ``admin-app/admin_app/`` and is made importable
by the sys.path shim in ``tests/conftest.py`` (uvicorn reaches it the same
way via ``--app-dir admin-app``). The SPA mount is conditional on
``web/dist`` existing at app-import time; conftest.py materializes a
placeholder dist/ before any test module imports the app, so the mount
contract is exercised deterministically on a fresh checkout.
"""

import sqlite3
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from dashboard.api import db as audit_db
from dashboard.api import user_store
from dashboard.api.crypto import encrypt_credential
from dashboard.api.user_store import init_user_store
from shariah_algo_trader.execution import tenant_manager

from admin_app.api.main import app
from dashboard.api.deps import get_config


class _MockSupabaseConfig:
    """Minimal Config stand-in: Supabase JWT mode on, no email allowlist."""

    supabase_enabled = True
    enforce_mfa = False
    allowed_google_emails = set()


_NOW = "2026-08-13T00:00:00+00:00"
_PAPER_BASE_URL = "https://paper-api.alpaca.markets"


@pytest.fixture
def admin_store(tmp_path, monkeypatch):
    """Throwaway user store + audit store + engine DB, all in tmp_path.

    Same isolation pattern as test_admin_api.py: the module-global _DB_PATH
    (and _initialized, so init calls re-run for this file) is monkeypatched,
    so the admin routes read ONLY this fixture's DB — never ambient state in
    the gitignored data/ directory.
    """
    user_db = tmp_path / "user_settings.db"
    audit_path = tmp_path / "notifications.db"
    monkeypatch.setattr(user_store, "_DB_PATH", user_db)
    monkeypatch.setattr(user_store, "_initialized", False)
    monkeypatch.setattr(user_store, "_sync_to_supabase", lambda *a, **k: None)
    monkeypatch.setattr(tenant_manager, "_DB_PATH", user_db)
    monkeypatch.setattr(audit_db, "_DB_PATH", audit_path)
    monkeypatch.setattr(audit_db, "_initialized", False)
    init_user_store()
    audit_db.init_db()
    return {"user_db": user_db, "audit_db": audit_path}


def _seed_pilot_user(db_path, user_id, email, state="pending", role="tester"):
    conn = sqlite3.connect(str(db_path))
    try:
        conn.execute(
            "INSERT OR REPLACE INTO pilot_users (user_id, email, role, state, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, email, role, state, _NOW, _NOW),
        )
        conn.commit()
    finally:
        conn.close()


def _seed_user_settings(db_path, user_id, *, enabled=1, paper=None, live=None):
    """Insert a user_settings row with optionally encrypted paper/live creds."""
    conn = sqlite3.connect(str(db_path))
    try:
        paper_key = encrypt_credential(paper[0]) if paper else None
        paper_secret = encrypt_credential(paper[1]) if paper else None
        live_key = encrypt_credential(live[0]) if live else None
        live_secret = encrypt_credential(live[1]) if live else None
        conn.execute(
            """INSERT OR REPLACE INTO user_settings (
                user_id, alpaca_api_key_encrypted, alpaca_api_secret_encrypted,
                alpaca_live_api_key_encrypted, alpaca_live_api_secret_encrypted,
                trading_mode, alpaca_base_url, etf_symbol, top_n, sector_cap,
                drift_threshold, shariah_trader_enabled, day_trader_enabled,
                risk_acknowledged_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 'paper', ?, 'SPUS', 20, 0.2, 0.03, ?, 0, NULL, ?, ?)""",
            (user_id, paper_key, paper_secret, live_key, live_secret,
             _PAPER_BASE_URL, int(enabled), _NOW, _NOW),
        )
        conn.commit()
    finally:
        conn.close()


@pytest.fixture
def client():
    app.dependency_overrides[get_config] = lambda: _MockSupabaseConfig()
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_health_ok_anonymous(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["service"] == "shariah-admin-app"


def test_admin_testers_401_anonymous(client):
    res = client.get("/api/admin/testers")
    assert res.status_code == 401


def test_admin_testers_403_for_tester_role(client):
    with patch("dashboard.api.deps._decode_supabase_jwt") as mock_decode:
        mock_decode.return_value = {
            "sub": "tester-user-1",
            "email": "tester@example.com",
            "app_metadata": {"role": "tester"},
            "aal": "aal1",
        }
        res = client.get("/api/admin/testers", headers={"Authorization": "Bearer tester-jwt"})
    assert res.status_code == 403


def test_admin_testers_200_for_admin(client, admin_store):
    _seed_pilot_user(admin_store["user_db"], "tester-1", "t1@example.com", state="active")
    _seed_user_settings(admin_store["user_db"], "tester-1", enabled=1, paper=("PK", "PS"))

    with patch("dashboard.api.deps._decode_supabase_jwt") as mock_decode:
        mock_decode.return_value = {
            "sub": "admin-user-1",
            "email": "aqilnazri9@gmail.com",
            "app_metadata": {"role": "admin"},
            "aal": "aal1",
        }
        res = client.get("/api/admin/testers", headers={"Authorization": "Bearer admin-jwt"})
    assert res.status_code == 200
    body = res.json()
    assert body["count"] == 1
    assert body["testers"][0]["user_id"] == "tester-1"
    assert body["testers"][0]["state"] == "active"


def test_index_html_served_at_root(client):
    res = client.get("/")
    assert res.status_code == 200
    assert 'id="root"' in res.text
