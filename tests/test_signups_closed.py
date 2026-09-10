"""Public registration is closed by default.

The platform no longer onboards self-service accounts. These tests pin the
server-side half of that: /api/auth/status must report signups as closed unless
SIGNUPS_ENABLED is explicitly set, on every auth backend.

They do NOT prove new accounts cannot be created. Supabase's /auth/v1/signup is
reachable directly with the anon key that ships in the browser bundle, so real
enforcement lives in the Supabase and Clerk consoles. This flag stops *this
application* from offering or accepting registration.
"""

import pytest
from fastapi.testclient import TestClient

from dashboard.api.main import app
from dashboard.api.deps import get_config
from shariah_algo_trader.config import Config


@pytest.fixture
def client():
    yield TestClient(app)
    app.dependency_overrides.clear()


class _BaseConfig:
    """Minimal config surface the auth status endpoint reads."""

    def __init__(self, **overrides):
        self.alpaca_api_key = "test-key"
        self.alpaca_api_secret = "test-secret"
        self.alpaca_base_url = "https://paper-api.alpaca.markets"
        self.etf_symbol = "SPUS"
        self.top_n = 20
        self.dashboard_password = None
        self.dashboard_session_secret = "test-secret-key"
        self.google_client_id = None
        self.google_client_secret = None
        self.google_redirect_uri = None
        self.allowed_google_emails = set()
        self.clerk_jwt_verification_key = None
        self.clerk_enabled = False
        self.supabase_enabled = False
        self.enforce_mfa = False
        self.signups_enabled = False
        for key, value in overrides.items():
            setattr(self, key, value)


def _status(client, **overrides) -> dict:
    app.dependency_overrides[get_config] = lambda: _BaseConfig(**overrides)
    response = client.get("/api/auth/status")
    assert response.status_code == 200
    return response.json()


# ---------------------------------------------------------------------------
# Config default
# ---------------------------------------------------------------------------


def test_signups_are_closed_by_default(monkeypatch):
    monkeypatch.delenv("SIGNUPS_ENABLED", raising=False)
    assert Config().signups_enabled is False


@pytest.mark.parametrize("value", ["true", "True", "1", "yes", "YES"])
def test_signups_can_be_reopened_explicitly(monkeypatch, value):
    monkeypatch.setenv("SIGNUPS_ENABLED", value)
    assert Config().signups_enabled is True


@pytest.mark.parametrize("value", ["false", "0", "no", "", "maybe"])
def test_only_affirmative_values_reopen_signups(monkeypatch, value):
    monkeypatch.setenv("SIGNUPS_ENABLED", value)
    assert Config().signups_enabled is False


# ---------------------------------------------------------------------------
# API surface, across every auth backend
# ---------------------------------------------------------------------------


def test_status_reports_signups_closed_with_no_auth_configured(client):
    assert _status(client)["signups_enabled"] is False


def test_status_reports_signups_closed_with_password_auth(client):
    data = _status(client, dashboard_password="hunter2hunter2")
    assert data["password_auth_enabled"] is True
    assert data["signups_enabled"] is False


def test_status_reports_signups_closed_with_supabase(client):
    data = _status(client, supabase_enabled=True)
    assert data["supabase_enabled"] is True
    assert data["signups_enabled"] is False


def test_status_reports_signups_closed_with_clerk(client):
    data = _status(client, clerk_enabled=True)
    assert data["clerk_enabled"] is True
    assert data["signups_enabled"] is False


@pytest.mark.parametrize("backend", [
    {},
    {"dashboard_password": "hunter2hunter2"},
    {"supabase_enabled": True},
    {"clerk_enabled": True},
])
def test_signups_flag_is_reported_on_every_code_path(client, backend):
    """Every branch of get_auth_status must carry the flag, not just some."""
    assert _status(client, signups_enabled=True, **backend)["signups_enabled"] is True


def test_missing_flag_on_a_config_object_is_treated_as_closed(client):
    """A config predating this flag must fail closed, not open."""

    class LegacyConfig(_BaseConfig):
        def __init__(self):
            super().__init__()
            del self.signups_enabled

    app.dependency_overrides[get_config] = lambda: LegacyConfig()
    response = client.get("/api/auth/status")
    assert response.status_code == 200
    assert response.json()["signups_enabled"] is False
