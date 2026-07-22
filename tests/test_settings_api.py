import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient

from dashboard.api.main import app
from dashboard.api.deps import get_config

@pytest.fixture
def client():
    return TestClient(app)

class MockConfig:
    def __init__(self):
        self.alpaca_api_key = "test-key"
        self.alpaca_api_secret = "test-secret"
        self.alpaca_base_url = "https://paper-api.alpaca.markets"
        self.etf_symbol = "SPUS"
        self.top_n = 20
        self.etf_symbols = ["SPUS", "HLAL"]
        self.sector_cap = 0.20
        self.drift_threshold = 0.03
        self.dashboard_password = "securepassword"
        self.google_client_id = None
        self.google_client_secret = None
        self.google_redirect_uri = None
        self.allowed_google_emails = set()

def test_get_settings(client, monkeypatch):
    # get_settings() reads secrets straight from os.environ (not cfg) so it never
    # trusts a possibly-already-masked value on the Config object — mock the real
    # environment here so this test doesn't depend on the local machine's .env.
    monkeypatch.setenv("ALPACA_API_SECRET", "test-secret")
    monkeypatch.setenv("DASHBOARD_PASSWORD", "securepassword")
    monkeypatch.delenv("GOOGLE_CLIENT_SECRET", raising=False)

    app.dependency_overrides[get_config] = lambda: MockConfig()

    from dashboard.api.deps import verify_auth
    app.dependency_overrides[verify_auth] = lambda: True

    response = client.get("/api/settings")
    assert response.status_code == 200
    data = response.json()
    assert data["alpaca_api_key_masked"] == "••••••••••••"
    assert data["alpaca_api_secret_masked"] == "••••••••••••"
    assert data["top_n"] == 20
    assert data["dashboard_password_masked"] == "••••••••••••"

    app.dependency_overrides.clear()

def test_update_settings(client):
    from dashboard.api.deps import verify_auth
    app.dependency_overrides[verify_auth] = lambda: True
    app.dependency_overrides[get_config] = lambda: MockConfig()

    # 1. Test update fails without current_password (SUDO mode)
    payload_no_sudo = {"alpaca_api_key": "new-key"}
    response = client.post("/api/settings", json=payload_no_sudo)
    assert response.status_code == 401
    assert "SUDO mode" in response.json()["detail"]

    # 2. Test update succeeds with correct current_password
    with patch("dashboard.api.routers.settings.update_env_file") as mock_update:
        payload = {
            "current_password": "securepassword",
            "alpaca_api_key": "new-key",
            "top_n": 25,
            "sector_cap": 0.25,
            "drift_threshold": 0.05
        }
        response = client.post("/api/settings", json=payload)
        assert response.status_code == 200
        assert response.json() == {"status": "success"}
        mock_update.assert_called_once()
        args, _ = mock_update.call_args
        updates = args[1]
        assert updates["ALPACA_API_KEY"] == "new-key"
        assert updates["TOP_N"] == "25"
        assert updates["SECTOR_CAP"] == "0.25"
        assert updates["DRIFT_THRESHOLD"] == "0.0500"

    app.dependency_overrides.clear()


def test_update_settings_error_sanitized(client):
    from dashboard.api.deps import verify_auth
    app.dependency_overrides[verify_auth] = lambda: True
    app.dependency_overrides[get_config] = lambda: MockConfig()

    with patch("dashboard.api.routers.settings.update_env_file", side_effect=ValueError("SecretDiskError: /home/ubuntu/.env permission denied")):
        payload = {"current_password": "securepassword", "alpaca_api_key": "new-key"}
        response = client.post("/api/settings", json=payload)
        assert response.status_code == 500
        # Ensure internal exception details like file path or SecretDiskError are NOT exposed
        assert "SecretDiskError" not in response.json()["detail"]
        assert response.json()["detail"] == "Failed to save settings due to an internal error."

    app.dependency_overrides.clear()


def test_update_settings_crlf_sanitization(client):
    from dashboard.api.deps import verify_auth
    app.dependency_overrides[verify_auth] = lambda: True
    app.dependency_overrides[get_config] = lambda: MockConfig()

    with patch("dashboard.api.routers.settings.update_env_file") as mock_update:
        payload = {
            "current_password": "securepassword",
            "alpaca_api_key": "injected-key\nINJECTED_VAR=hacked\r",
            "etf_symbol": "spus\n"
        }
        response = client.post("/api/settings", json=payload)
        assert response.status_code == 200
        args, _ = mock_update.call_args
        updates = args[1]
        # Verify newlines and carriage returns were stripped
        assert "\n" not in updates["ALPACA_API_KEY"]
        assert "\r" not in updates["ALPACA_API_KEY"]
        assert updates["ALPACA_API_KEY"] == "injected-keyINJECTED_VAR=hacked"
        assert updates["ETF_SYMBOL"] == "SPUS"

    app.dependency_overrides.clear()



def test_audit_log_record(client):
    from dashboard.api.db import init_db, log_audit_event, fetch_audit_logs
    init_db()

    # Log a test audit event directly
    event_id = log_audit_event("TEST_EVENT", "test_user", "127.0.0.1", "Test audit event log")
    assert event_id is not None

    logs = fetch_audit_logs(limit=10)
    assert len(logs) > 0
    recent = logs[0]
    assert recent["event_type"] in ["TEST_EVENT", "SETTINGS_UPDATE", "AUTH_LOGIN_SUCCESS", "AUTH_LOGIN_FAILURE"]


