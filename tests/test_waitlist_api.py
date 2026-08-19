import pytest
from fastapi.testclient import TestClient
import sqlite3
from pathlib import Path
from unittest.mock import patch

from dashboard.api.main import app
from dashboard.api.deps import get_config
from dashboard.api import db


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def mock_config():
    """Mock config for tests."""
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
            self.clerk_jwt_verification_key = None
            self.clerk_enabled = False
    return MockConfig()


def test_waitlist_signup_valid_email(client, mock_config):
    """Test successful waitlist signup with valid email."""
    app.dependency_overrides[get_config] = lambda: mock_config
    
    try:
        response = client.post(
            "/api/public/waitlist",
            json={"email": "test@example.com"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
    finally:
        app.dependency_overrides.clear()


def test_waitlist_signup_duplicate_email_idempotent(client, mock_config):
    """Test that duplicate emails don't error (idempotent)."""
    app.dependency_overrides[get_config] = lambda: mock_config
    
    try:
        # First signup
        response1 = client.post(
            "/api/public/waitlist",
            json={"email": "duplicate@example.com"}
        )
        assert response1.status_code == 200
        assert response1.json()["status"] == "ok"
        
        # Second signup with same email should also return OK
        response2 = client.post(
            "/api/public/waitlist",
            json={"email": "duplicate@example.com"}
        )
        assert response2.status_code == 200
        assert response2.json()["status"] == "ok"
    finally:
        app.dependency_overrides.clear()


def test_waitlist_signup_invalid_email(client, mock_config):
    """Test that invalid emails still return OK (don't leak validation)."""
    app.dependency_overrides[get_config] = lambda: mock_config
    
    try:
        # Use a different client with different IP to avoid rate limiting
        test_client = TestClient(app, base_url="http://testserver", headers={"X-Forwarded-For": "192.168.1.100"})
        response = test_client.post(
            "/api/public/waitlist",
            json={"email": "not-an-email"}
        )
        # Should still return 200 OK for security (don't leak validation)
        assert response.status_code == 200
        assert response.json()["status"] == "ok"
    finally:
        app.dependency_overrides.clear()


def test_waitlist_signup_email_stored(client, mock_config):
    """Test that valid email is actually stored in database."""
    app.dependency_overrides[get_config] = lambda: mock_config
    
    try:
        # Use different IP to avoid rate limiting
        test_client = TestClient(app, base_url="http://testserver", headers={"X-Forwarded-For": "192.168.1.101"})
        # Submit a waitlist signup
        response = test_client.post(
            "/api/public/waitlist",
            json={"email": "stored@example.com"}
        )
        assert response.status_code == 200
        
        # Check that email was stored in database
        db.init_db()
        signups = db.list_waitlist_signups(limit=100)
        emails = [row["email"] for row in signups]
        assert "stored@example.com" in emails
    finally:
        app.dependency_overrides.clear()


def test_waitlist_email_normalized(client, mock_config):
    """Test that emails are normalized (lowercased and trimmed)."""
    app.dependency_overrides[get_config] = lambda: mock_config
    
    try:
        # Use different IP to avoid rate limiting
        test_client = TestClient(app, base_url="http://testserver", headers={"X-Forwarded-For": "192.168.1.102"})
        # Submit with uppercase and whitespace
        response = test_client.post(
            "/api/public/waitlist",
            json={"email": "  TEST@EXAMPLE.COM  "}
        )
        assert response.status_code == 200
        
        # Check that it was normalized in database
        db.init_db()
        signups = db.list_waitlist_signups(limit=100)
        emails = [row["email"] for row in signups]
        # Should be stored as lowercase
        assert "test@example.com" in emails
        # Should not have uppercase version
        assert "TEST@EXAMPLE.COM" not in emails
    finally:
        app.dependency_overrides.clear()
