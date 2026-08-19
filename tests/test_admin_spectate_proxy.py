"""Tests for the admin spectate proxy (SPEC-ADMIN-SPECTATE.md §5, AC-S3/S6/S7/S10).

The spectate proxy is a GET-only, JWT-forwarding passthrough from the admin app
(:8002) to the main dashboard (:8000). Authz is inherited from the SAME
``/api/admin`` mount as admin.py — anonymous → 401, tester-role JWT → 403,
admin JWT → 200 (AC-S7). The proxy never mints/caches/persists tokens; it
forwards the caller's ``Authorization`` header verbatim so S2/S3/S5 resolve to
the calling founder's own tenant.

All dashboard HTTP traffic is mocked (requests.get) — no live :8000 calls in
tests (guardrail: never call live services in tests).
"""

from unittest.mock import MagicMock

import pytest
import requests
from fastapi import Request
from fastapi.testclient import TestClient

from admin_app.api.main import app as admin_app
from admin_app.api.routers import spectate as spectate_router
from dashboard.api.deps import get_config, verify_auth

# S1-S5 route table: admin spectate path -> dashboard path on :8000.
SPECTATE_TARGETS = [
    ("status", "/api/status"),
    ("account", "/api/account"),
    ("portfolio", "/api/portfolio"),
    ("universe", "/api/universe"),
    ("compliance", "/api/compliance"),
]
S_PATHS = [f"/api/admin/spectate/{name}" for name, _ in SPECTATE_TARGETS]
# (full admin path, dashboard path) pairs for the passthrough tests.
SPECTATE_PARAMS = [(f"/api/admin/spectate/{name}", target)
                   for name, target in SPECTATE_TARGETS]

# Zeroed account payload shape from dashboard/api/routers/account.py:17-33 —
# returned when the founder has no Alpaca keys / the connection failed. The
# proxy must pass it through untouched (the frontend renders fee_status_label
# as the empty state, never the zeros as real numbers — SPEC §3.3 Section B).
ZEROED_ACCOUNT = {
    "equity": 0.0,
    "cash": 0.0,
    "buying_power": 0.0,
    "portfolio_value": 0.0,
    "dayl_pl": 0.0,
    "dayl_pl_pct": 0.0,
    "estimated_fees": 0.0,
    "fee_drag_pct": 0.0,
    "fee_status_label": "Connect Alpaca API in Settings",
}


class _MockAdminConfig:
    supabase_enabled = True
    enforce_mfa = False
    allowed_google_emails = set()


@pytest.fixture
def admin_client():
    """Same authz fixture as tests/test_admin_api.py.

    role=None keeps the REAL verify_auth (anonymous -> 401); role='tester' or
    'admin' overrides verify_auth to stamp a JWT-shaped payload on the request
    (tester -> 403 via require_admin, admin -> 200).
    """

    def _make(role: str | None = "admin", user_id: str = "admin-uid",
              email: str = "aqilnazri9@gmail.com") -> TestClient:
        admin_app.dependency_overrides.clear()
        admin_app.dependency_overrides[get_config] = lambda: _MockAdminConfig()
        if role is not None:
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
def fake_dashboard(monkeypatch):
    """Scripted requests.get stand-in recording calls, returning a canned payload.

    Returns an installer ``fake(payload, status_code=200)`` whose returned list
    accumulates every proxied call as {"url", "headers", "timeout"}.
    """
    calls: list[dict] = []

    def _install(payload, status_code: int = 200) -> list:
        resp = MagicMock()
        resp.status_code = status_code
        resp.json.return_value = payload

        def _get(url, headers=None, timeout=None):
            calls.append({"url": url, "headers": headers, "timeout": timeout})
            return resp

        monkeypatch.setattr(spectate_router.requests, "get", _get)
        return calls

    return _install


# ── S1-S5: 200 passthrough (AC-S3) ───────────────────────────────────────────

@pytest.mark.parametrize("s_path,target", SPECTATE_PARAMS,
                         ids=[name for name, _ in SPECTATE_TARGETS])
def test_spectate_200_passthrough(admin_client, fake_dashboard, s_path, target):
    payload = {"ok": True, "source": target}
    calls = fake_dashboard(payload)

    res = admin_client().get(s_path)

    assert res.status_code == 200
    assert res.json() == payload
    assert len(calls) == 1
    assert calls[0]["url"] == f"{spectate_router.DASHBOARD_BASE}{target}"
    assert calls[0]["timeout"] == 5.0


def test_spectate_authorization_header_forwarded_verbatim(admin_client, fake_dashboard):
    """The proxy forwards the caller's Authorization header UNCHANGED — this is
    what makes S2/S3/S5 resolve to the calling founder's own tenant (§2.2)."""
    calls = fake_dashboard({"equity": 1.0})
    token = "Bearer eyJhbGciOiJIUzI1NiJ9.some-supabase-token.sig"

    admin_client().get("/api/admin/spectate/account", headers={"Authorization": token})

    assert len(calls) == 1
    assert calls[0]["headers"] == {"Authorization": token}


def test_spectate_zeroed_account_passthrough(admin_client, fake_dashboard):
    """The zeroed 'Connect Alpaca API in Settings' payload (account.py:17-33)
    passes through untouched so the frontend can render the label as the
    empty state instead of zeros as real numbers (§3.3 Section B)."""
    calls = fake_dashboard(ZEROED_ACCOUNT)

    res = admin_client().get("/api/admin/spectate/account")

    assert res.status_code == 200
    assert res.json() == ZEROED_ACCOUNT
    assert calls[0]["url"] == f"{spectate_router.DASHBOARD_BASE}/api/account"


# ── Failure paths (AC-S6: dashboard down -> 502, human-readable) ─────────────

def test_spectate_502_on_request_exception(admin_client, monkeypatch):
    def _boom(url, headers=None, timeout=None):
        raise requests.ConnectionError("connection refused")

    monkeypatch.setattr(spectate_router.requests, "get", _boom)

    res = admin_client().get("/api/admin/spectate/status")

    assert res.status_code == 502
    assert "unreachable" in res.json()["detail"].lower()


@pytest.mark.parametrize("s_path,target", SPECTATE_PARAMS,
                         ids=[name for name, _ in SPECTATE_TARGETS])
def test_spectate_502_on_non_200(admin_client, fake_dashboard, s_path, target):
    calls = fake_dashboard({"error": "boom"}, status_code=500)

    res = admin_client().get(s_path)

    assert res.status_code == 502
    assert "500" in res.json()["detail"]
    assert len(calls) == 1


# ── Authz matrix (AC-S7) ─────────────────────────────────────────────────────

@pytest.mark.parametrize("s_path", S_PATHS)
def test_spectate_anon_401(admin_client, s_path):
    res = admin_client(role=None).get(s_path)
    assert res.status_code == 401


@pytest.mark.parametrize("s_path", S_PATHS)
def test_spectate_tester_403(admin_client, s_path):
    res = admin_client(role="tester", email="tester@example.com").get(s_path)
    assert res.status_code == 403


# ── Read-only surface (§5 rules) ─────────────────────────────────────────────

def test_spectate_is_get_only(admin_client):
    """The proxy exposes GET only — the dashboard's write paths must never be
    reachable through the admin app (§5: 'the admin app stays a spectator')."""
    res = admin_client().post("/api/admin/spectate/status")
    assert res.status_code == 405


def test_spectate_rejects_client_path_params(admin_client):
    """Fixed path allowlist only — no client-supplied path component, so the
    proxy cannot be pointed at arbitrary dashboard endpoints."""
    res = admin_client().get("/api/admin/spectate/status/extra")
    assert res.status_code == 404
