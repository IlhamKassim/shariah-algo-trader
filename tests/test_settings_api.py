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
    assert data["alpaca_api_key"] == "test-key"
    assert data["alpaca_api_secret_masked"] == "••••••••••••"
    assert data["top_n"] == 20
    assert data["dashboard_password_masked"] == "••••••••••••"

    app.dependency_overrides.clear()

def test_update_settings(client):
    from dashboard.api.deps import verify_auth
    app.dependency_overrides[verify_auth] = lambda: True
    app.dependency_overrides[get_config] = lambda: MockConfig()

    with patch("dashboard.api.routers.settings.update_env_file") as mock_update:
        payload = {
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
