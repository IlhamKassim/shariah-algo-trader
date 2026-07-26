import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from dashboard.api.main import app
from dashboard.api.deps import get_config

@pytest.fixture
def client():
    return TestClient(app)

@patch("dashboard.api.deps._decode_supabase_jwt")
def test_multi_tenant_user_settings_isolation(mock_decode, client):
    class MockConfig:
        def __init__(self):
            self.alpaca_api_key = "SERVER_DEFAULT_KEY"
            self.alpaca_api_secret = "SERVER_DEFAULT_SECRET"
            self.alpaca_base_url = "https://paper-api.alpaca.markets"
            self.etf_symbol = "SPUS"
            self.top_n = 20
            self.etf_symbols = ["SPUS", "HLAL"]
            self.sector_cap = 0.20
            self.drift_threshold = 0.03
            self.dashboard_password = None
            self.google_client_id = None
            self.google_client_secret = None
            self.google_redirect_uri = None
            self.allowed_google_emails = set()
            self.clerk_enabled = False
            self.supabase_enabled = True
            self.enforce_mfa = False

    app.dependency_overrides[get_config] = lambda: MockConfig()

    # User 1 saves custom settings
    mock_decode.return_value = {"sub": "user_tenant_1", "aal": "aal1"}
    headers_1 = {"Authorization": "Bearer token_user_1"}

    res = client.post("/api/settings", json={
        "alpaca_api_key": "USER1_ALPACA_KEY",
        "alpaca_api_secret": "USER1_ALPACA_SECRET",
        "etf_symbol": "HLAL",
        "top_n": 10,
    }, headers=headers_1)
    assert res.status_code == 200

    # User 2 saves custom settings
    mock_decode.return_value = {"sub": "user_tenant_2", "aal": "aal1"}
    headers_2 = {"Authorization": "Bearer token_user_2"}

    res = client.post("/api/settings", json={
        "alpaca_api_key": "USER2_ALPACA_KEY",
        "alpaca_api_secret": "USER2_ALPACA_SECRET",
        "etf_symbol": "SPSK",
        "top_n": 5,
    }, headers=headers_2)
    assert res.status_code == 200

    # Fetch User 1 settings
    mock_decode.return_value = {"sub": "user_tenant_1", "aal": "aal1"}
    res1 = client.get("/api/settings", headers=headers_1)
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["etf_symbol"] == "HLAL"
    assert data1["top_n"] == 10

    # Fetch User 2 settings
    mock_decode.return_value = {"sub": "user_tenant_2", "aal": "aal1"}
    res2 = client.get("/api/settings", headers=headers_2)
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["etf_symbol"] == "SPSK"
    assert data2["top_n"] == 5

    # Fetch Account for new unconfigured User 3
    mock_decode.return_value = {"sub": "user_tenant_new_3", "aal": "aal1"}
    headers_3 = {"Authorization": "Bearer token_user_3"}
    res3 = client.get("/api/account", headers=headers_3)
    assert res3.status_code == 200
    data3 = res3.json()
    assert data3["equity"] == 0.0
    assert data3["cash"] == 0.0
    assert data3["fee_status_label"] == "Connect Alpaca API in Settings"

    # Fetch Portfolio for unconfigured User 3
    res3_port = client.get("/api/portfolio", headers=headers_3)
    assert res3_port.status_code == 200
    assert res3_port.json() == []

    app.dependency_overrides.clear()
