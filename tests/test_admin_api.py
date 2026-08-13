"""Tests for the standalone admin app API (SPEC-BETA-PILOT.md section 5.2).

Covers the Phase 3 contract for endpoints A1-A7 on the standalone admin app
(:8002, admin-app/admin_app/api/routers/admin.py):

- Authz matrix (AC-7): anonymous 401 / tester-role JWT 403 / admin JWT 200 on
  every /api/admin/* route.
- A1 tester list: lifecycle state, key status, last activity.
- A2 approve: activates engine visibility (local user_settings row ensured),
  idempotent.
- A3 revoke: state='revoked' + shariah_trader_enabled=0; AC-8: the revoked
  user disappears from engine tenant discovery on the next cycle.
- A4/A5 paper-only (G5): the Alpaca client is built with the tester's PAPER
  creds and the hard-coded https://paper-api.alpaca.markets base URL only.
- A5 reuses the shared compute_compliance helper (DRY with routers/compliance).
- A6 per-tester activity feed from audit_logs (actor = user_id).
- A7 invites: create / list / expiry.

All store + engine + audit DBs are isolated per test via tmp_path monkeypatching
(same pattern as tests/test_paper_only_guard.py).
"""

import datetime
import sqlite3

import pytest
from fastapi.testclient import TestClient

from admin_app.api.main import app as admin_app
from admin_app.api.routers import admin as admin_router
from dashboard.api import db as audit_db
from dashboard.api import user_store
from dashboard.api.crypto import encrypt_credential
from dashboard.api.db import fetch_audit_logs, log_audit_event
from dashboard.api.user_store import (
    create_pilot_invite,
    get_paper_credentials,
    get_pilot_invite,
    get_pilot_user,
    get_user_settings_meta,
    init_user_store,
)
from shariah_algo_trader.execution import tenant_manager
from shariah_algo_trader.execution.alpaca_client import AlpacaClient, AlpacaError
from shariah_algo_trader.execution.tenant_manager import get_active_tenant_accounts

PAPER_BASE_URL = "https://paper-api.alpaca.markets"
NOW = "2026-08-13T00:00:00+00:00"


# ── Isolation fixtures ────────────────────────────────────────────────────────

@pytest.fixture
def admin_store(tmp_path, monkeypatch):
    """Throwaway user store + audit store + engine DB, all in tmp_path.

    ``_initialized=False`` is patched along with the path (same isolation
    pattern as test_strix_fixes.supabase_env) so this fixture's init_db /
    init_user_store calls never leave the module-global flags set for other
    test files sharing the worker process.
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


class _MockAdminConfig:
    supabase_enabled = True
    enforce_mfa = False
    allowed_google_emails = set()


@pytest.fixture
def admin_client(admin_store):
    """TestClient factory for the standalone admin app.

    role=None keeps the REAL verify_auth (anonymous -> 401); role='tester' or
    'admin' overrides verify_auth to stamp a JWT-shaped payload on the request.
    """
    from dashboard.api.deps import get_config, verify_auth

    def _make(role: str | None = "admin", user_id: str = "admin-uid",
              email: str = "aqilnazri9@gmail.com") -> TestClient:
        admin_app.dependency_overrides.clear()
        admin_app.dependency_overrides[get_config] = lambda: _MockAdminConfig()
        if role is not None:
            from fastapi import Request

            def _verify(request: Request):
                request.state.user_id = user_id
                request.state.user_email = email
                payload: dict = {"sub": user_id, "email": email}
                if role:
                    payload["app_metadata"] = {"role": role}
                request.state.user = payload
                return True

            admin_app.dependency_overrides[verify_auth] = _verify
        return TestClient(admin_app)

    yield _make
    admin_app.dependency_overrides.clear()


@pytest.fixture
def eligible_universe():
    """Prime the shared UniverseCache with an eligible universe (A5)."""
    from datetime import datetime, timezone

    from dashboard.api.cache import get_universe_cache

    cache = get_universe_cache()
    cache.stocks = [{"symbol": "SPUS"}, {"symbol": "HLAL"}]
    cache.raw_universe = {"SPUS", "HLAL"}
    cache.last_computed_at = datetime(2026, 8, 13, tzinfo=timezone.utc)
    yield cache
    cache.stocks = []
    cache.raw_universe = set()
    cache.last_computed_at = None


# ── Seeding helpers ──────────────────────────────────────────────────────────

def _seed_pilot_user(db_path, user_id, email, state="pending", role="tester"):
    conn = sqlite3.connect(str(db_path))
    try:
        conn.execute(
            "INSERT OR REPLACE INTO pilot_users (user_id, email, role, state, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, email, role, state, NOW, NOW),
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
             PAPER_BASE_URL, int(enabled), NOW, NOW),
        )
        conn.commit()
    finally:
        conn.close()


class _FakeAlpaca:
    """Scripted AlpacaClient stand-in that records constructor args + calls."""

    instances: list["_FakeAlpaca"] = []

    def __init__(self, api_key: str, api_secret: str, base_url: str, session=None):
        self.api_key = api_key
        self.api_secret = api_secret
        self.base_url = base_url
        self.calls: list[str] = []
        _FakeAlpaca.instances.append(self)

    def get(self, path: str):
        self.calls.append(path)
        if path == "/v2/account":
            return {"equity": "10000.00", "cash": "2500.00", "buying_power": "5000.00", "currency": "USD"}
        if path == "/v2/positions":
            return [
                {"symbol": "SPUS", "qty": "100", "market_value": "4000.00", "unrealized_pl": "120.50"},
                {"symbol": "AAPL", "qty": "10", "market_value": "2500.00", "unrealized_pl": "-30.00"},
            ]
        return {}

    def post(self, path: str, body: dict):
        self.calls.append(path)
        return {}

    def delete(self, path: str):
        self.calls.append(path)
        return {}


@pytest.fixture
def fake_alpaca(monkeypatch):
    _FakeAlpaca.instances = []
    monkeypatch.setattr(admin_router, "AlpacaClient", _FakeAlpaca)
    return _FakeAlpaca


# ── Authz matrix (AC-7) ──────────────────────────────────────────────────────

def test_admin_api_anon_401(admin_client):
    res = admin_client(role=None).get("/api/admin/testers")
    assert res.status_code == 401


def test_admin_api_tester_403(admin_client):
    res = admin_client(role="tester", email="tester@example.com").get("/api/admin/testers")
    assert res.status_code == 403


def test_admin_api_admin_200(admin_client, admin_store):
    res = admin_client(role="admin").get("/api/admin/testers")
    assert res.status_code == 200
    assert res.json() == {"testers": [], "count": 0}


def test_admin_api_tester_403_on_invites(admin_client):
    res = admin_client(role="tester", email="tester@example.com").get("/api/admin/invites")
    assert res.status_code == 403


def test_admin_api_anon_401_on_approve(admin_client):
    res = admin_client(role=None).post("/api/admin/testers/someone/approve")
    assert res.status_code == 401


# ── A1: tester list ──────────────────────────────────────────────────────────

def test_a1_lists_testers_with_state_keys_and_activity(admin_client, admin_store):
    _seed_pilot_user(admin_store["user_db"], "tester-1", "t1@example.com", state="active")
    _seed_user_settings(admin_store["user_db"], "tester-1", enabled=1, paper=("PK", "PS"))
    _seed_pilot_user(admin_store["user_db"], "tester-2", "t2@example.com", state="pending")
    log_audit_event("INVITE_CLAIMED", "tester-1", "10.0.0.1", "claimed code")
    log_audit_event("LOGIN", "tester-1", "10.0.0.2", "signed in")

    res = admin_client().get("/api/admin/testers")

    assert res.status_code == 200
    body = res.json()
    assert body["count"] == 2
    by_id = {t["user_id"]: t for t in body["testers"]}

    t1 = by_id["tester-1"]
    assert t1["state"] == "active"
    assert t1["email"] == "t1@example.com"
    assert t1["role"] == "tester"
    assert t1["has_paper_keys"] is True
    assert t1["shariah_trader_enabled"] == 1
    assert t1["trading_mode"] == "paper"
    assert t1["last_activity_at"] is not None

    t2 = by_id["tester-2"]
    assert t2["state"] == "pending"
    assert t2["has_paper_keys"] is False
    assert t2["last_activity_at"] is None


# ── A2: approve ──────────────────────────────────────────────────────────────

def test_a2_approve_activates_pending_tester(admin_client, admin_store):
    _seed_pilot_user(admin_store["user_db"], "tester-1", "t1@example.com", state="pending")

    res = admin_client().post("/api/admin/testers/tester-1/approve")

    assert res.status_code == 200
    assert res.json() == {"user_id": "tester-1", "state": "active"}
    pilot = get_pilot_user("tester-1")
    assert pilot["state"] == "active"
    assert pilot["approved_by"] == "admin-uid"
    # engine visibility: local user_settings row ensured and enabled
    meta = get_user_settings_meta("tester-1")
    assert meta is not None
    assert meta["shariah_trader_enabled"] == 1
    events = [e for e in fetch_audit_logs(limit=100) if e["event_type"] == "TESTER_APPROVED"]
    assert events and events[0]["actor"] == "admin-uid"


def test_a2_approve_is_idempotent(admin_client, admin_store):
    _seed_pilot_user(admin_store["user_db"], "tester-1", "t1@example.com", state="pending")

    res1 = admin_client().post("/api/admin/testers/tester-1/approve")
    res2 = admin_client().post("/api/admin/testers/tester-1/approve")

    assert res1.status_code == 200
    assert res1.json() == {"user_id": "tester-1", "state": "active"}
    assert res2.status_code == 200
    assert res2.json() == {"user_id": "tester-1", "state": "active", "already_active": True}
    assert get_pilot_user("tester-1")["state"] == "active"
    events = [e for e in fetch_audit_logs(limit=100) if e["event_type"] == "TESTER_APPROVED"]
    assert len(events) == 1, "already-active approval must not re-audit"


def test_a2_approve_unknown_user_404(admin_client, admin_store):
    res = admin_client().post("/api/admin/testers/ghost/approve")
    assert res.status_code == 404


# ── A3: revoke + AC-8 engine visibility ──────────────────────────────────────

def test_a3_revoke_disables_engine_visibility_and_keeps_data(admin_client, admin_store):
    _seed_pilot_user(admin_store["user_db"], "tester-1", "t1@example.com", state="active")
    _seed_user_settings(admin_store["user_db"], "tester-1", enabled=1, paper=("PK", "PS"))

    res = admin_client().post("/api/admin/testers/tester-1/revoke")

    assert res.status_code == 200
    assert res.json() == {"user_id": "tester-1", "state": "revoked"}
    assert get_pilot_user("tester-1")["state"] == "revoked"
    meta = get_user_settings_meta("tester-1")
    assert meta["shariah_trader_enabled"] == 0
    # "keeps data": paper creds survive revocation
    assert get_paper_credentials("tester-1") == {"alpaca_api_key": "PK", "alpaca_api_secret": "PS"}
    events = [e for e in fetch_audit_logs(limit=100) if e["event_type"] == "TESTER_REVOKED"]
    assert events and events[0]["actor"] == "admin-uid"


def test_ac8_revoked_tester_absent_from_tenant_discovery(admin_client, admin_store):
    _seed_pilot_user(admin_store["user_db"], "tester-ac8", "ac8@example.com", state="active")
    _seed_user_settings(admin_store["user_db"], "tester-ac8", enabled=1, paper=("PK", "PS"))

    before = get_active_tenant_accounts(engine="shariah_trader")
    assert any(a["raw_user_id"] == "tester-ac8" for a in before), "active tester must be discovered"

    res = admin_client().post("/api/admin/testers/tester-ac8/revoke")
    assert res.status_code == 200

    after = get_active_tenant_accounts(engine="shariah_trader")
    assert not any(a["raw_user_id"] == "tester-ac8" for a in after), (
        "AC-8: revoke must take effect within one engine cycle"
    )


def test_a3_revoke_unknown_user_404(admin_client, admin_store):
    res = admin_client().post("/api/admin/testers/ghost/revoke")
    assert res.status_code == 404


# ── A4: per-tester paper portfolio (G5) ──────────────────────────────────────

def test_a4_portfolio_uses_paper_creds_and_paper_base_url(admin_client, admin_store, fake_alpaca):
    _seed_pilot_user(admin_store["user_db"], "tester-1", "t1@example.com", state="active")
    _seed_user_settings(admin_store["user_db"], "tester-1", enabled=1, paper=("PAPER-KEY", "PAPER-SECRET"))

    res = admin_client().get("/api/admin/testers/tester-1/portfolio")

    assert res.status_code == 200
    body = res.json()
    assert body["paper_base_url"] == PAPER_BASE_URL
    assert body["user_id"] == "tester-1"
    assert body["account"]["equity"] == "10000.00"
    assert len(body["positions"]) == 2
    assert body["unrealized_pl"] == 90.5

    client = fake_alpaca.instances[-1]
    assert client.base_url == PAPER_BASE_URL, "G5: hard-coded paper base URL only"
    assert client.api_key == "PAPER-KEY", "G5: paper creds, never live"
    assert client.calls == ["/v2/account", "/v2/positions"]


def test_a4_no_paper_creds_409(admin_client, admin_store, fake_alpaca):
    _seed_pilot_user(admin_store["user_db"], "tester-1", "t1@example.com", state="active")

    res = admin_client().get("/api/admin/testers/tester-1/portfolio")

    assert res.status_code == 409
    assert "paper credentials" in res.json()["detail"].lower()
    assert fake_alpaca.instances == [], "no Alpaca call may be attempted without creds"


def test_a4_unknown_tester_404(admin_client, admin_store, fake_alpaca):
    res = admin_client().get("/api/admin/testers/ghost/portfolio")
    assert res.status_code == 404
    assert fake_alpaca.instances == []


def test_a4_alpaca_error_502(admin_client, admin_store, monkeypatch):
    _seed_pilot_user(admin_store["user_db"], "tester-1", "t1@example.com", state="active")
    _seed_user_settings(admin_store["user_db"], "tester-1", enabled=1, paper=("PK", "PS"))

    class _BrokenAlpaca:
        def __init__(self, api_key, api_secret, base_url, session=None):
            self.base_url = base_url

        def get(self, path):
            raise AlpacaError("paper account unreachable")

    monkeypatch.setattr(admin_router, "AlpacaClient", _BrokenAlpaca)

    res = admin_client().get("/api/admin/testers/tester-1/portfolio")
    assert res.status_code == 502


# ── A5: per-tester compliance (shared helper, G5) ────────────────────────────

def test_a5_compliance_reuses_shared_logic(admin_client, admin_store, fake_alpaca, eligible_universe):
    _seed_pilot_user(admin_store["user_db"], "tester-1", "t1@example.com", state="active")
    _seed_user_settings(admin_store["user_db"], "tester-1", enabled=1, paper=("PAPER-KEY", "PAPER-SECRET"))

    res = admin_client().get("/api/admin/testers/tester-1/compliance")

    assert res.status_code == 200
    body = res.json()
    assert body["compliant"] is False  # AAPL held, not in eligible universe
    assert body["violations"] == ["AAPL"]
    assert body["held_count"] == 2
    assert body["universe_size"] == 2
    assert body["last_checked"] == "2026-08-13T00:00:00+00:00"
    assert body["paper_base_url"] == PAPER_BASE_URL

    client = fake_alpaca.instances[-1]
    assert client.base_url == PAPER_BASE_URL, "G5 applies to A5 as well"
    assert client.api_key == "PAPER-KEY"
    assert client.calls == ["/v2/positions"]


def test_compute_compliance_helper_contract():
    """The shared helper (dashboard.api.compliance_core) used by both the
    dashboard /api/compliance router and admin A5."""
    from dashboard.api.compliance_core import compute_compliance

    result = compute_compliance(["AAPL", "MSFT"], {"AAPL"}, universe_size=1, last_checked=None)
    assert result == {
        "compliant": False,
        "violations": ["MSFT"],
        "held_count": 2,
        "universe_size": 1,
        "last_checked": None,
    }

    # empty eligible universe => can't determine violations => compliant (router semantics)
    empty = compute_compliance([], set(), universe_size=0, last_checked=None)
    assert empty["compliant"] is True
    assert empty["violations"] == []
    assert empty["held_count"] == 0
    assert empty["universe_size"] == 0


def test_compliance_router_unchanged_after_shared_helper_refactor(eligible_universe):
    """The dashboard /api/compliance handler still behaves identically now that
    it delegates to compute_compliance (behavior-preserving DRY refactor).

    The handler is invoked directly (it is a plain function returning a
    ComplianceResponse) because the dashboard app's route layer has a
    pre-existing FastAPI 0.137 lazy-router quirk (router-level dependency
    overrides are not honoured — a 422 unrelated to this refactor).
    """
    from dashboard.api.routers.compliance import get_compliance

    class _Fake(AlpacaClient):
        def __init__(self, api_key="K", api_secret="S", base_url=PAPER_BASE_URL, session=None):
            self._base_url = base_url

        def get(self, path):
            return [{"symbol": "SPUS"}, {"symbol": "AAPL"}]  # AAPL violates

    result = get_compliance(client=_Fake(), cache=eligible_universe)
    assert result.compliant is False
    assert result.violations == ["AAPL"]
    assert result.held_count == 2
    assert result.universe_size == 2
    assert result.last_checked == "2026-08-13T00:00:00+00:00"

    # no client (anonymous/legacy fallback) -> can't check -> compliant
    no_client = get_compliance(client=None, cache=eligible_universe)
    assert no_client.compliant is True
    assert no_client.violations == []
    assert no_client.universe_size == 2


def test_compliance_router_empty_cache_semantics(eligible_universe):
    """Empty eligible universe -> compliant=True, held positions still counted."""
    from dashboard.api.routers.compliance import get_compliance

    class _Fake(AlpacaClient):
        def __init__(self, api_key="K", api_secret="S", base_url=PAPER_BASE_URL, session=None):
            self._base_url = base_url

        def get(self, path):
            return [{"symbol": "SPUS"}, {"symbol": "AAPL"}]

    eligible_universe.stocks = []
    eligible_universe.raw_universe = set()
    eligible_universe.last_computed_at = None

    result = get_compliance(client=_Fake(), cache=eligible_universe)
    assert result.compliant is True
    assert result.held_count == 2
    assert result.universe_size == 0
    assert result.last_checked is None


# ── A6: per-tester activity feed ─────────────────────────────────────────────

def test_a6_activity_feed_filters_by_actor(admin_client, admin_store):
    _seed_pilot_user(admin_store["user_db"], "tester-1", "t1@example.com", state="active")
    log_audit_event("INVITE_CLAIMED", "tester-1", "10.0.0.1", "claimed code")
    log_audit_event("LOGIN", "tester-1", "10.0.0.2", "signed in")
    log_audit_event("LOGIN", "someone-else", "10.0.0.9", "other actor")

    res = admin_client().get("/api/admin/testers/tester-1/activity")

    assert res.status_code == 200
    body = res.json()
    assert body["user_id"] == "tester-1"
    assert body["count"] == 2
    assert all(e["actor"] == "tester-1" for e in body["events"])
    assert {e["event_type"] for e in body["events"]} == {"INVITE_CLAIMED", "LOGIN"}
    assert all("details" in e and "created_at" in e for e in body["events"])


def test_a6_activity_unknown_tester_404(admin_client, admin_store):
    res = admin_client().get("/api/admin/testers/ghost/activity")
    assert res.status_code == 404


# ── A7 + invites list ────────────────────────────────────────────────────────

def test_a7_create_invite(admin_client, admin_store):
    res = admin_client().post("/api/admin/invites", json={})

    assert res.status_code == 200
    body = res.json()
    assert body["code"] and len(body["code"]) >= 8
    assert body["max_uses"] == 1
    assert body["uses"] == 0
    assert body["expired"] is False
    assert body["created_by"] == "admin-uid"
    stored = get_pilot_invite(body["code"])
    assert stored is not None and stored["max_uses"] == 1
    events = [e for e in fetch_audit_logs(limit=100) if e["event_type"] == "INVITE_CREATED"]
    assert events and events[0]["actor"] == "admin-uid"


def test_a7_create_invite_custom_options(admin_client, admin_store):
    expires = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=7)).isoformat()

    res = admin_client().post(
        "/api/admin/invites",
        json={"max_uses": 3, "expires_at": expires, "code": "CUSTOM-1"},
    )

    assert res.status_code == 200
    body = res.json()
    assert body["code"] == "CUSTOM-1"
    assert body["max_uses"] == 3
    assert body["expires_at"] == expires


def test_a7_invite_max_uses_must_be_positive(admin_client, admin_store):
    res = admin_client().post("/api/admin/invites", json={"max_uses": 0})
    assert res.status_code == 422


def test_invites_list_and_expiry(admin_client, admin_store):
    future = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=5)).isoformat()
    past = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=1)).isoformat()
    live_code = create_pilot_invite("admin-uid", max_uses=1, expires_at=future)
    expired_code = create_pilot_invite("admin-uid", max_uses=1, expires_at=past)

    res = admin_client().get("/api/admin/invites")

    assert res.status_code == 200
    body = res.json()
    assert body["count"] == 2
    by_code = {i["code"]: i for i in body["invites"]}
    assert by_code[live_code]["expired"] is False
    assert by_code[expired_code]["expired"] is True
    assert by_code[live_code]["max_uses"] == 1
    assert by_code[expired_code]["uses"] == 0


# ── pilot store helpers used by the admin API ────────────────────────────────

def test_get_paper_credentials_never_touches_live_columns(admin_store):
    """G5: the helper returns ONLY decrypted paper creds; live values ignored."""
    _seed_user_settings(
        admin_store["user_db"], "tester-1", enabled=1,
        paper=("PK", "PS"), live=("LK", "LS"),
    )

    creds = get_paper_credentials("tester-1")

    assert creds == {"alpaca_api_key": "PK", "alpaca_api_secret": "PS"}
    assert "LK" not in str(creds) and "LS" not in str(creds)


def test_get_paper_credentials_none_when_missing(admin_store):
    assert get_paper_credentials("tester-1") is None
    _seed_user_settings(admin_store["user_db"], "tester-1", enabled=1)
    assert get_paper_credentials("tester-1") is None
