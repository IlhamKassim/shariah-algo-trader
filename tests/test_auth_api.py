import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from dashboard.api.main import app
from dashboard.api.deps import get_config


@pytest.fixture
def client():
    return TestClient(app)


def test_auth_status_disabled_by_default(client):
    class MockConfig:
        def __init__(self):
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

    app.dependency_overrides[get_config] = lambda: MockConfig()

    response = client.get("/api/auth/status")
    assert response.status_code == 200
    data = response.json()
    assert data["auth_enabled"] is False
    assert data["password_auth_enabled"] is False
    assert data["google_auth_enabled"] is False
    assert data["authenticated"] is True

    app.dependency_overrides.clear()


def test_auth_flow(client):
    class MockConfigWithAuth:
        def __init__(self):
            self.alpaca_api_key = "test-key"
            self.alpaca_api_secret = "test-secret"
            self.alpaca_base_url = "https://paper-api.alpaca.markets"
            self.etf_symbol = "SPUS"
            self.top_n = 20
            self.dashboard_password = "securepassword123"
            self.dashboard_session_secret = "test-secret-key"
            self.google_client_id = None
            self.google_client_secret = None
            self.google_redirect_uri = None
            self.allowed_google_emails = set()

    app.dependency_overrides[get_config] = lambda: MockConfigWithAuth()

    # 1. Status should show auth is enabled and we are not authenticated
    response = client.get("/api/auth/status")
    assert response.status_code == 200
    data = response.json()
    assert data["auth_enabled"] is True
    assert data["password_auth_enabled"] is True
    assert data["google_auth_enabled"] is False
    assert data["authenticated"] is False

    # 2. Try logging in with incorrect password
    response = client.post("/api/auth/login", json={"password": "wrongpassword"})
    assert response.status_code == 401

    # 3. Accessing a secured route should return 401 (verify_auth dependency runs before controller logic)
    response = client.get("/api/status")
    assert response.status_code == 401

    # 4. Login with correct password
    response = client.post("/api/auth/login", json={"password": "securepassword123"})
    assert response.status_code == 200
    assert "session_token" in response.cookies

    # 5. Status should now show authenticated=True
    response = client.get("/api/auth/status")
    assert response.status_code == 200
    data = response.json()
    assert data["authenticated"] is True

    # 6. Logout should clear cookie
    response = client.post("/api/auth/logout")
    assert response.status_code == 200
    # Cookie should either be absent or empty/deleted
    assert response.cookies.get("session_token") is None or response.cookies.get("session_token") == ""

    # 7. Status should be back to authenticated=False
    response = client.get("/api/auth/status")
    assert response.status_code == 200
    data = response.json()
    assert data["authenticated"] is False

    app.dependency_overrides.clear()


def test_google_login_redirect(client):
    class MockConfigGoogleAuth:
        def __init__(self):
            self.alpaca_api_key = "test-key"
            self.alpaca_api_secret = "test-secret"
            self.alpaca_base_url = "https://paper-api.alpaca.markets"
            self.etf_symbol = "SPUS"
            self.top_n = 20
            self.dashboard_password = None
            self.dashboard_session_secret = "test-secret-key"
            self.google_client_id = "google-id"
            self.google_client_secret = "google-secret"
            self.google_redirect_uri = "http://localhost:8000/api/auth/google/callback"
            self.allowed_google_emails = {"allowed@example.com"}

    app.dependency_overrides[get_config] = lambda: MockConfigGoogleAuth()

    response = client.get("/api/auth/google/login", follow_redirects=False)
    assert response.status_code == 307
    location = response.headers.get("location")
    assert "accounts.google.com" in location
    assert "client_id=google-id" in location

    app.dependency_overrides.clear()


@patch("httpx.AsyncClient.post")
@patch("httpx.AsyncClient.get")
def test_google_callback(mock_get, mock_post, client):
    class MockConfigGoogleAuth:
        def __init__(self):
            self.alpaca_api_key = "test-key"
            self.alpaca_api_secret = "test-secret"
            self.alpaca_base_url = "https://paper-api.alpaca.markets"
            self.etf_symbol = "SPUS"
            self.top_n = 20
            self.dashboard_password = None
            self.dashboard_session_secret = "test-secret-key"
            self.google_client_id = "google-id"
            self.google_client_secret = "google-secret"
            self.google_redirect_uri = "http://localhost:8000/api/auth/google/callback"
            self.allowed_google_emails = {"allowed@example.com"}

    app.dependency_overrides[get_config] = lambda: MockConfigGoogleAuth()

    # Mock token response
    from unittest.mock import MagicMock
    mock_post_res = MagicMock()
    mock_post_res.status_code = 200
    mock_post_res.json.return_value = {"access_token": "mock-access-token"}
    mock_post.return_value = mock_post_res

    # Mock user info response
    mock_get_res = MagicMock()
    mock_get_res.status_code = 200
    mock_get_res.json.return_value = {"email": "allowed@example.com"}
    mock_get.return_value = mock_get_res

    # 1. Success path
    response = client.get("/api/auth/google/callback?code=mockcode", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers.get("location") == "/"
    assert "session_token" in response.cookies

    # 2. Email not whitelisted path
    mock_get_res.json.return_value = {"email": "unauthorized@example.com"}
    response = client.get("/api/auth/google/callback?code=mockcode", follow_redirects=False)
    assert response.status_code == 307
    assert "error=unauthorized_email" in response.headers.get("location")

    app.dependency_overrides.clear()


def test_verify_password_endpoint(client):
    class MockConfigVerify:
        def __init__(self):
            self.alpaca_api_key = "test-key"
            self.alpaca_api_secret = "test-secret"
            self.alpaca_base_url = "https://paper-api.alpaca.markets"
            self.etf_symbol = "SPUS"
            self.top_n = 20
            self.dashboard_password = "verifypassword"
            self.dashboard_session_secret = "test-secret-key"
            self.google_client_id = None
            self.google_client_secret = None
            self.google_redirect_uri = None
            self.allowed_google_emails = set()

    app.dependency_overrides[get_config] = lambda: MockConfigVerify()

    # 1. Verification with wrong password
    response = client.post("/api/auth/verify", json={"password": "wrongpassword"})
    assert response.status_code == 401

    # 2. Verification with correct password
    response = client.post("/api/auth/verify", json={"password": "verifypassword"})
    assert response.status_code == 200
    assert response.json() == {"status": "success"}

    app.dependency_overrides.clear()

