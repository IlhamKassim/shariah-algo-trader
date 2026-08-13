"""Tests for the paper-only guardrails G1-G4 + G6 (SPEC-BETA-PILOT.md section 8).

Pilot testers are STRICTLY paper trading. The invariant is enforced in three
independent layers: API (G1/G2, 403), persistence (G3, refuse in the store)
and engine (G4/G6, never emit a live tenant + log the violation). All
guardrail checks are feature-flagged off by ``PILOT_GUARD_DISABLE=1``
(rollback path, spec section 10) — default unset, guards active.
"""

import logging
import sqlite3

import pytest
from fastapi.testclient import TestClient

from dashboard.api import user_store
from dashboard.api.db import fetch_audit_logs
from dashboard.api.main import app
from dashboard.api.user_store import (
    PaperOnlyGuardError,
    claim_pilot_invite,
    create_pilot_invite,
    get_user_settings,
    init_user_store,
    save_user_settings,
)
from shariah_algo_trader.execution import tenant_manager
from shariah_algo_trader.execution.tenant_manager import get_active_tenant_accounts


@pytest.fixture
def guard_store(tmp_path, monkeypatch):
    """Throwaway user store with pilot tables; live sync silenced."""
    db_path = tmp_path / "user_settings.db"
    monkeypatch.setattr(user_store, "_DB_PATH", db_path)
    monkeypatch.setattr(user_store, "_sync_to_supabase", lambda *a, **k: None)
    init_user_store()
    return db_path


# ── API-level helpers ────────────────────────────────────────────────────────

class _MockConfig:
    alpaca_api_key = "test-key"
    alpaca_api_secret = "test-secret"
    alpaca_base_url = "https://paper-api.alpaca.markets"
    etf_symbol = "SPUS"
    top_n = 20
    etf_symbols = ["SPUS", "HLAL"]
    sector_cap = 0.20
    drift_threshold = 0.03
    dashboard_password = "securepassword"
    google_client_id = None
    google_client_secret = None
    google_redirect_uri = None
    allowed_google_emails = {"aqilnazri9@gmail.com"}


@pytest.fixture
def api_client(guard_store, monkeypatch):
    from dashboard.api.deps import get_config, verify_auth

    def _make(user_id: str = "tester-uid", role: str | None = "tester"):
        from fastapi import Request

        def _verify(request: Request):
            request.state.user_id = user_id
            request.state.user_email = "tester@example.com"
            payload: dict = {"sub": user_id, "email": "tester@example.com"}
            if role:
                payload["app_metadata"] = {"role": role}
            request.state.user = payload
            return True

        app.dependency_overrides.clear()
        app.dependency_overrides[verify_auth] = _verify
        app.dependency_overrides[get_config] = lambda: _MockConfig()
        return TestClient(app)

    yield _make
    app.dependency_overrides.clear()


# ── G1: POST /api/settings rejects live keys for testers ─────────────────────

def test_g1_rejects_live_keys_for_tester(api_client, monkeypatch):
    client = api_client()
    called = {"save": False}

    def _fail_if_saved(*a, **k):
        called["save"] = True

    monkeypatch.setattr("dashboard.api.routers.settings.save_user_settings", _fail_if_saved)

    res = client.post(
        "/api/settings",
        json={"alpaca_live_api_key": "LIVE-KEY", "alpaca_live_api_secret": "LIVE-SECRET"},
    )

    assert res.status_code == 403
    assert "paper" in res.json()["detail"].lower()
    assert called["save"] is False, "nothing may be persisted for a rejected tester write"


def test_g1_allows_paper_keys_for_tester(api_client, guard_store, monkeypatch):
    client = api_client()
    captured = {}

    def _capture(user_id, settings):
        captured["user_id"] = user_id
        captured["settings"] = settings

    monkeypatch.setattr("dashboard.api.routers.settings.save_user_settings", _capture)

    res = client.post(
        "/api/settings",
        json={"alpaca_api_key": "PAPER-KEY", "alpaca_api_secret": "PAPER-SECRET"},
    )

    assert res.status_code == 200
    assert captured["settings"]["alpaca_api_key"] == "PAPER-KEY"


# ── G2: POST /api/settings/mode rejects live for testers ─────────────────────

def test_g2_rejects_live_mode_for_tester(api_client):
    client = api_client()
    res = client.post("/api/settings/mode", json={"mode": "live", "riskAcknowledged": True})
    assert res.status_code == 403
    assert "paper" in res.json()["detail"].lower()


def test_g2_allows_paper_mode_for_tester(api_client, guard_store, monkeypatch):
    client = api_client()
    captured = {}

    def _capture(user_id, settings):
        captured["settings"] = settings

    monkeypatch.setattr("dashboard.api.routers.settings.save_user_settings", _capture)

    res = client.post("/api/settings/mode", json={"mode": "paper"})
    assert res.status_code == 200
    assert captured["settings"]["trading_mode"] == "paper"


def test_g2_tester_role_falls_back_to_pilot_users_row(api_client, guard_store):
    """JWT predates approval (no app_metadata role) — local pilot_users.role is the fallback."""
    code = create_pilot_invite("admin-uid")
    claim_pilot_invite("tester-uid", "tester@example.com", code)

    client = api_client(role=None)
    res = client.post("/api/settings/mode", json={"mode": "live"})
    assert res.status_code == 403


def test_g2_audits_guardrail_violation(api_client):
    client = api_client()
    client.post("/api/settings/mode", json={"mode": "live"})

    events = [e for e in fetch_audit_logs(limit=100) if e["event_type"] == "PAPER_ONLY_GUARD" and e["actor"] == "tester-uid"]
    assert events, "tester live-mode rejection must be logged to audit_logs"


def test_guard_disable_flag_opens_rollback_path(api_client, monkeypatch):
    monkeypatch.setenv("PILOT_GUARD_DISABLE", "1")
    client = api_client()
    res = client.post("/api/settings/mode", json={"mode": "live", "riskAcknowledged": True})
    assert res.status_code == 200  # rollback: guardrails feature-flagged off (spec section 10)


# ── G3: store refuses to persist live state for testers ──────────────────────

def _provision_tester(uid: str, email: str) -> None:
    code = create_pilot_invite("admin-uid")
    claim_pilot_invite(uid, email, code)


def test_g3_refuses_live_key_persistence_for_tester(guard_store):
    _provision_tester("tester-g3", "t3@example.com")

    with pytest.raises(PaperOnlyGuardError):
        save_user_settings("tester-g3", {"alpaca_live_api_key": "LK", "alpaca_live_api_secret": "LS"})

    with pytest.raises(PaperOnlyGuardError):
        save_user_settings("tester-g3", {"trading_mode": "live"})

    # nothing was written by the refused saves
    assert get_user_settings("tester-g3") is None


def test_g3_allows_paper_persistence_for_tester(guard_store):
    _provision_tester("tester-g3b", "t3b@example.com")

    save_user_settings("tester-g3b", {"alpaca_api_key": "PK", "alpaca_api_secret": "PS", "trading_mode": "paper"})

    data = get_user_settings("tester-g3b")
    assert data is not None
    assert data["trading_mode"] == "paper"
    assert data["alpaca_api_key"] == "PK"


def test_g3_does_not_affect_non_testers(guard_store):
    save_user_settings("5b7fb8dd-admin", {"trading_mode": "live", "alpaca_live_api_key": "LK", "alpaca_live_api_secret": "LS"})
    data = get_user_settings("5b7fb8dd-admin")
    assert data["trading_mode"] == "live"
    assert data["alpaca_live_api_key"] == "LK"


# ── G4/G6 + AC-12: engine tenant discovery ───────────────────────────────────

_ENGINE_INSERT = """
INSERT INTO user_settings (
    user_id, alpaca_api_key_encrypted, alpaca_api_secret_encrypted,
    alpaca_live_api_key_encrypted, alpaca_live_api_secret_encrypted,
    trading_mode, alpaca_base_url, etf_symbol, top_n, sector_cap,
    drift_threshold, shariah_trader_enabled, day_trader_enabled,
    risk_acknowledged_at, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, 'https://paper-api.alpaca.markets', 'SPUS', 20, 0.2, 0.03, 1, 0, NULL, ?, ?)
"""


def _enc(value: str) -> str | None:
    from dashboard.api.crypto import encrypt_credential

    return encrypt_credential(value)


def _seed_engine_row(db_path, user_id, *, mode, paper=None, live=None):
    conn = sqlite3.connect(str(db_path))
    try:
        now = "2026-08-13T00:00:00+00:00"
        paper_key = _enc(paper[0]) if paper is not None else None
        paper_secret = _enc(paper[1]) if paper is not None else None
        live_key = _enc(live[0]) if live is not None else None
        live_secret = _enc(live[1]) if live is not None else None
        conn.execute(
            _ENGINE_INSERT,
            (
                user_id,
                paper_key,
                paper_secret,
                live_key,
                live_secret,
                mode,
                now,
                now,
            ),
        )
        conn.commit()
    finally:
        conn.close()


def _seed_pilot_role(db_path, user_id, role):
    conn = sqlite3.connect(str(db_path))
    try:
        now = "2026-08-13T00:00:00+00:00"
        conn.execute(
            "INSERT INTO pilot_users (user_id, email, role, state, created_at, updated_at) VALUES (?, ?, ?, 'pending', ?, ?)",
            (user_id, f"{user_id}@example.com", role, now, now),
        )
        conn.commit()
    finally:
        conn.close()


@pytest.fixture
def engine_db(tmp_path, monkeypatch):
    db_path = tmp_path / "user_settings.db"
    monkeypatch.setattr(user_store, "_DB_PATH", db_path)
    monkeypatch.setattr(user_store, "_sync_to_supabase", lambda *a, **k: None)
    monkeypatch.setattr(tenant_manager, "_DB_PATH", db_path)
    init_user_store()
    return db_path


def test_g4_tester_row_with_live_mode_emits_only_paper(engine_db, caplog):
    _seed_engine_row(engine_db, "tester-eng", mode="live", paper=("PK", "PS"), live=("LK", "LS"))
    _seed_pilot_role(engine_db, "tester-eng", "tester")

    with caplog.at_level(logging.WARNING):
        accounts = get_active_tenant_accounts(engine="shariah_trader")

    tester_entries = [a for a in accounts if a["raw_user_id"] == "tester-eng"]
    assert tester_entries, "tester with paper keys must still get a paper tenant"
    assert all(a["trading_mode"] == "paper" for a in tester_entries)
    assert all("live" not in a["alpaca_base_url"] for a in tester_entries)
    assert any("PAPER_ONLY_GUARD" in r.message for r in caplog.records), "G6: live-key presence must be logged"


def test_g6_tester_with_only_live_keys_yields_zero_entries(engine_db, caplog):
    _seed_engine_row(engine_db, "tester-live-only", mode="live", live=("LK", "LS"))
    _seed_pilot_role(engine_db, "tester-live-only", "tester")

    with caplog.at_level(logging.WARNING):
        accounts = get_active_tenant_accounts(engine="shariah_trader")

    assert not any(a["raw_user_id"] == "tester-live-only" for a in accounts), (
        "G6: a tester row with live keys must produce ZERO live tenant entries"
    )
    assert any("PAPER_ONLY_GUARD" in r.message for r in caplog.records)


def test_ac12_admin_entries_unchanged_by_guardrails(engine_db):
    """AC-12: aqil-like live+paper admin produces identical live AND paper entries."""
    _seed_engine_row(engine_db, "5b7fb8dd-admin", mode="live", paper=("PK", "PS"), live=("LK", "LS"))
    # no pilot_users row → not a tester

    accounts = get_active_tenant_accounts(engine="shariah_trader")

    entries = {a["trading_mode"]: a for a in accounts if a["raw_user_id"] == "5b7fb8dd-admin"}
    assert set(entries) == {"live", "paper"}
    assert entries["live"]["alpaca_base_url"] == "https://api.alpaca.markets"
    assert entries["paper"]["alpaca_base_url"] == "https://paper-api.alpaca.markets"


def test_engine_survives_missing_pilot_table(tmp_path, monkeypatch):
    """Pre-pilot DBs have no pilot_users table — discovery must not break."""
    db_path = tmp_path / "user_settings.db"
    monkeypatch.setattr(tenant_manager, "_DB_PATH", db_path)
    conn = sqlite3.connect(str(db_path))
    conn.execute(
        "CREATE TABLE user_settings (user_id TEXT PRIMARY KEY, shariah_trader_enabled INTEGER, trading_mode TEXT, "
        "alpaca_api_key_encrypted TEXT, alpaca_api_secret_encrypted TEXT, alpaca_live_api_key_encrypted TEXT, "
        "alpaca_live_api_secret_encrypted TEXT, alpaca_base_url TEXT, etf_symbol TEXT, top_n INTEGER, "
        "sector_cap REAL, drift_threshold REAL, day_trader_enabled INTEGER, risk_acknowledged_at TEXT, "
        "created_at TEXT, updated_at TEXT)"
    )
    conn.commit()
    conn.close()

    accounts = get_active_tenant_accounts(engine="shariah_trader")
    assert isinstance(accounts, list)
