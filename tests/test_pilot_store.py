"""Tests for the pilot store: pilot_users + pilot_invites tables and helpers.

Deliverable 3: pilot tables are created idempotently by ``init_user_store()``
(same pattern as the user_settings DDL) and exposed through CRUD helpers.
Deliverable 5 (Q2=A): invite codes are single-use, validated at the first
authenticated call — ``POST /api/settings/claim-invite`` provisions a
``pilot_users`` row with ``state='pending'`` (AC-3) and rejects + audits
invalid/expired codes (AC-4).
"""

import datetime

import pytest
from fastapi.testclient import TestClient

from dashboard.api import user_store
from dashboard.api.db import fetch_audit_logs
from dashboard.api.main import app
from dashboard.api.user_store import (
    claim_pilot_invite,
    create_pilot_invite,
    get_pilot_invite,
    get_pilot_role,
    get_pilot_user,
    init_user_store,
    is_tester,
    list_pilot_invites,
    list_pilot_users,
    set_pilot_user_state,
    validate_invite_code,
)

PILOT_DB = "pilot.db"


@pytest.fixture
def pilot_store(tmp_path, monkeypatch):
    db_path = tmp_path / PILOT_DB
    monkeypatch.setattr(user_store, "_DB_PATH", db_path)
    monkeypatch.setattr(user_store, "_sync_to_supabase", lambda *a, **k: None)
    init_user_store()
    return db_path


def _tables(db_path):
    import sqlite3

    conn = sqlite3.connect(str(db_path))
    try:
        rows = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('pilot_users','pilot_invites')"
        ).fetchall()
        return {r[0] for r in rows}
    finally:
        conn.close()


# ── tables ───────────────────────────────────────────────────────────────────

def test_init_user_store_creates_pilot_tables(pilot_store):
    assert {"pilot_users", "pilot_invites"} <= _tables(pilot_store)


def test_init_user_store_is_idempotent_for_pilot_tables(pilot_store):
    init_user_store()  # second run must not raise
    assert {"pilot_users", "pilot_invites"} <= _tables(pilot_store)


# ── invites ──────────────────────────────────────────────────────────────────

def test_create_invite_defaults(pilot_store):
    code = create_pilot_invite("admin-uid")

    assert code and len(code) >= 8
    invite = get_pilot_invite(code)
    assert invite is not None
    assert invite["created_by"] == "admin-uid"
    assert invite["max_uses"] == 1
    assert invite["uses"] == 0
    expires = datetime.datetime.fromisoformat(invite["expires_at"])
    assert expires > datetime.datetime.now(datetime.timezone.utc)


def test_validate_invite_code_valid(pilot_store):
    code = create_pilot_invite("admin-uid", max_uses=2)
    result = validate_invite_code(code)
    assert result["valid"] is True
    assert result["reason"] is None


def test_validate_invite_code_unknown(pilot_store):
    result = validate_invite_code("nope-nope")
    assert result["valid"] is False
    assert "invalid" in result["reason"].lower()


def test_validate_invite_code_expired(pilot_store):
    past = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=1)).isoformat()
    code = create_pilot_invite("admin-uid", expires_at=past)
    result = validate_invite_code(code)
    assert result["valid"] is False
    assert "expired" in result["reason"].lower()


def test_validate_invite_code_used_up(pilot_store):
    code = create_pilot_invite("admin-uid", max_uses=1)
    claim_pilot_invite("user-a", "a@example.com", code)
    result = validate_invite_code(code)
    assert result["valid"] is False
    assert "used" in result["reason"].lower()


# ── pilot_users CRUD ─────────────────────────────────────────────────────────

def test_claim_provisions_pending_pilot_user(pilot_store):
    code = create_pilot_invite("admin-uid")

    result = claim_pilot_invite("new-tester", "tester@example.com", code, linkedin_url="https://linkedin.com/in/tester", notes="via LinkedIn")

    assert result["ok"] is True
    assert result["state"] == "pending"

    user = get_pilot_user("new-tester")
    assert user is not None
    assert user["email"] == "tester@example.com"
    assert user["role"] == "tester"
    assert user["state"] == "pending"
    assert user["invite_code"] == code
    assert user["linkedin_url"] == "https://linkedin.com/in/tester"

    # single-use: uses incremented to 1
    assert get_pilot_invite(code)["uses"] == 1


def test_claim_rejects_invalid_code_and_audits(pilot_store):
    result = claim_pilot_invite("bad-tester", "bad@example.com", "wrong-code")

    assert result["ok"] is False
    assert result["reason"]
    assert get_pilot_user("bad-tester") is None

    events = [e for e in fetch_audit_logs(limit=100) if e["event_type"] == "INVITE_REJECTED" and e["actor"] == "bad-tester"]
    assert events, "invalid invite claim must be logged to audit_logs (AC-4)"


def test_claim_is_idempotent_for_same_user(pilot_store):
    code = create_pilot_invite("admin-uid")
    first = claim_pilot_invite("user-a", "a@example.com", code)
    second = claim_pilot_invite("user-a", "a@example.com", code)

    assert first["ok"] is True
    assert second["ok"] is True
    assert second.get("already_provisioned") is True
    # uses not double-incremented by the second (already-provisioned) claim
    assert get_pilot_invite(code)["uses"] == 1


def test_claim_is_single_use_across_users(pilot_store):
    code = create_pilot_invite("admin-uid", max_uses=1)
    assert claim_pilot_invite("user-a", "a@example.com", code)["ok"] is True

    second = claim_pilot_invite("user-b", "b@example.com", code)
    assert second["ok"] is False
    assert "used" in second["reason"].lower()
    assert get_pilot_user("user-b") is None


def test_set_state_and_role_helpers(pilot_store):
    # provision directly via claim, then advance the lifecycle
    code = create_pilot_invite("admin-uid")
    claim_pilot_invite("user-a", "a@example.com", code)
    set_pilot_user_state("user-a", "active", approved_by="admin-uid")

    user = get_pilot_user("user-a")
    assert user["state"] == "active"
    assert user["approved_by"] == "admin-uid"

    assert get_pilot_role("user-a") == "tester"
    assert is_tester("user-a") is True
    assert get_pilot_role("5b7fb8dd-not-a-tester") is None
    assert is_tester("5b7fb8dd-not-a-tester") is False


def test_list_pilot_users_and_invites(pilot_store):
    create_pilot_invite("admin-uid")
    create_pilot_invite("admin-uid")
    assert len(list_pilot_invites()) == 2

    code = create_pilot_invite("admin-uid")
    claim_pilot_invite("user-a", "a@example.com", code)
    assert len(list_pilot_users()) == 1
    assert list_pilot_users()[0]["user_id"] == "user-a"


# ── claim endpoint (Q2=A: validated at first authenticated call) ─────────────

class _MockConfig:
    allowed_google_emails = {"aqilnazri9@gmail.com"}
    supabase_enabled = True


def _fake_auth(user_id: str, email: str, role: str | None = None):
    from fastapi import Request

    def _verify(request: Request):
        request.state.user_id = user_id
        request.state.user_email = email
        payload: dict = {"sub": user_id, "email": email}
        if role:
            payload["app_metadata"] = {"role": role}
        request.state.user = payload
        return True

    return _verify


def _claim_client(monkeypatch, user_id: str, email: str, role: str | None = None, tmp_path=None):
    from dashboard.api.deps import get_config, verify_auth

    app.dependency_overrides.clear()
    app.dependency_overrides[verify_auth] = _fake_auth(user_id, email, role)
    app.dependency_overrides[get_config] = lambda: _MockConfig()
    return TestClient(app)


def test_claim_endpoint_provisions_pending(pilot_store, monkeypatch):
    code = create_pilot_invite("admin-uid")
    client = _claim_client(monkeypatch, "tester-uid-1", "tester1@example.com", tmp_path=pilot_store)

    res = client.post("/api/settings/claim-invite", json={"code": code})

    assert res.status_code == 200
    assert res.json()["state"] == "pending"
    user = get_pilot_user("tester-uid-1")
    assert user is not None
    assert user["state"] == "pending"
    assert user["email"] == "tester1@example.com"


def test_claim_endpoint_rejects_invalid_code_403(pilot_store, monkeypatch):
    client = _claim_client(monkeypatch, "tester-uid-2", "tester2@example.com", tmp_path=pilot_store)

    res = client.post("/api/settings/claim-invite", json={"code": "wrong-code"})

    assert res.status_code == 403
    assert get_pilot_user("tester-uid-2") is None
    events = [e for e in fetch_audit_logs(limit=100) if e["event_type"] == "INVITE_REJECTED" and e["actor"] == "tester-uid-2"]
    assert events, "rejected claim must be logged to audit_logs (AC-4)"


def test_claim_endpoint_rejects_used_code_403(pilot_store, monkeypatch):
    code = create_pilot_invite("admin-uid", max_uses=1)
    claim_pilot_invite("tester-uid-1", "tester1@example.com", code)
    client = _claim_client(monkeypatch, "tester-uid-2", "tester2@example.com", tmp_path=pilot_store)

    res = client.post("/api/settings/claim-invite", json={"code": code})

    assert res.status_code == 403
    assert "used" in res.json()["detail"].lower()
