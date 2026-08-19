"""Tests for admin endpoints B1, B2, and B3.

Covers:
- B1: GET /api/admin/customers/{user_id}/profile (graceful degradation without keys/portfolio)
- B2: GET /api/admin/analytics/risk (KPIs, risk distribution, alerts, flagged accounts)
- B3: GET /api/admin/audit (filtered audit logs, search, pagination, event types)
"""

import sqlite3
import pytest
from fastapi import Request
from fastapi.testclient import TestClient

from admin_app.api.main import app as admin_app
from admin_app.api.routers import admin as admin_router
from dashboard.api import db as audit_db
from dashboard.api import user_store
from dashboard.api.db import log_audit_event
from dashboard.api.deps import get_config, verify_auth
from dashboard.api.user_store import (
    claim_pilot_invite,
    create_pilot_invite,
    ensure_user_settings_row,
    get_trading_prefs,
    init_user_store,
)


class _MockAdminConfig:
    supabase_enabled = True
    enforce_mfa = False
    allowed_google_emails = set()


@pytest.fixture
def admin_store(tmp_path, monkeypatch):
    """Throwaway user store + audit store in tmp_path."""
    db_path = tmp_path / "test_user_store.db"
    audit_path = tmp_path / "test_audit.db"

    monkeypatch.setattr(user_store, "_DB_PATH", db_path)
    monkeypatch.setattr(user_store, "_initialized", False)
    monkeypatch.setattr(user_store, "_sync_to_supabase", lambda *a, **k: None)
    monkeypatch.setattr(audit_db, "_DB_PATH", audit_path)
    monkeypatch.setattr(audit_db, "_initialized", False)

    init_user_store()
    audit_db.init_db()

    # Reset in-memory risk cache
    admin_router._risk_cache["generated_at"] = None
    admin_router._risk_cache["payload"] = None

    return {"user_db": db_path, "audit_db": audit_path}


@pytest.fixture
def admin_client(admin_store):
    """TestClient that injects an admin user via dependency overrides."""
    admin_app.dependency_overrides.clear()
    admin_app.dependency_overrides[get_config] = lambda: _MockAdminConfig()

    def _verify(request: Request):
        request.state.user_id = "admin-1"
        request.state.user_email = "admin@example.com"
        request.state.user = {
            "sub": "admin-1",
            "email": "admin@example.com",
            "app_metadata": {"role": "admin"},
        }
        return True

    admin_app.dependency_overrides[verify_auth] = _verify
    client = TestClient(admin_app)
    yield client
    admin_app.dependency_overrides.clear()


def test_b1_customer_profile_no_keys(admin_store, admin_client):
    code = create_pilot_invite(created_by="admin-1")
    res = claim_pilot_invite("user-1", "tester1@example.com", code)
    assert res["ok"] is True

    # User has no paper keys -> portfolio and compliance return status="no_keys"
    resp = admin_client.get("/api/admin/customers/user-1/profile")
    assert resp.status_code == 200
    data = resp.json()
    assert data["user_id"] == "user-1"
    assert data["email"] == "tester1@example.com"
    assert data["portfolio"]["status"] == "no_keys"
    assert data["compliance"]["status"] == "no_keys"
    assert data["prefs"]["etf_symbol"] == "SPUS"


def test_b1_customer_profile_not_found(admin_store, admin_client):
    resp = admin_client.get("/api/admin/customers/unknown-user/profile")
    assert resp.status_code == 404


def test_b2_analytics_risk(admin_store, admin_client):
    code1 = create_pilot_invite(created_by="admin-1")
    code2 = create_pilot_invite(created_by="admin-1")
    claim_pilot_invite("user-1", "tester1@example.com", code1)
    claim_pilot_invite("user-2", "tester2@example.com", code2)

    # Approve user-1
    admin_client.post("/api/admin/testers/user-1/approve")

    resp = admin_client.get("/api/admin/analytics/risk")
    assert resp.status_code == 200
    data = resp.json()
    assert data["kpis"]["total_customers"] == 2
    assert "low" in data["risk_distribution"]
    assert "med" in data["risk_distribution"]
    assert "high" in data["risk_distribution"]
    assert isinstance(data["alerts"], list)
    assert isinstance(data["flagged"], list)


def test_b3_audit_filtering(admin_store, admin_client):
    log_audit_event("TESTER_APPROVED", "admin-1", "127.0.0.1", "Approved user-1")
    log_audit_event("INVITE_CREATED", "admin-1", "127.0.0.1", "Created invite")
    log_audit_event("SETTINGS_UPDATE", "user-1", "127.0.0.1", "Updated trading settings")

    # Fetch all
    resp = admin_client.get("/api/admin/audit")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 3
    assert len(data["events"]) == 3
    assert "TESTER_APPROVED" in data["event_types"]

    # Filter by event_type
    resp_filtered = admin_client.get("/api/admin/audit?event_type=TESTER_APPROVED")
    assert resp_filtered.status_code == 200
    data_filtered = resp_filtered.json()
    assert data_filtered["total"] == 1
    assert data_filtered["events"][0]["event_type"] == "TESTER_APPROVED"

    # Search substring
    resp_search = admin_client.get("/api/admin/audit?q=user-1")
    assert resp_search.status_code == 200
    data_search = resp_search.json()
    assert data_search["total"] == 2
