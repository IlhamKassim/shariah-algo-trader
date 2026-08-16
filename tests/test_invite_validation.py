import pytest
from fastapi.testclient import TestClient
from dashboard.api.main import app
from dashboard.api.user_store import create_pilot_invite, _ensure_initialized, _connect, _lock


@pytest.fixture
def client():
    return TestClient(app)


def test_validate_invite_endpoint_empty_code(client):
    res = client.get("/api/auth/validate-invite?code=")
    assert res.status_code == 200
    data = res.json()
    assert data["valid"] is False
    assert "required" in data["reason"].lower()


def test_validate_invite_endpoint_invalid_code(client):
    res = client.get("/api/auth/validate-invite?code=NONEXISTENT_CODE_123")
    assert res.status_code == 200
    data = res.json()
    assert data["valid"] is False
    assert "Invalid invite code" in data["reason"]


def test_validate_invite_endpoint_valid_code(client, tmp_path, monkeypatch):
    code = create_pilot_invite(created_by="admin", max_uses=1)
    res = client.get(f"/api/auth/validate-invite?code={code}")
    assert res.status_code == 200
    data = res.json()
    assert data["valid"] is True
    assert data["code"] == code
    assert data["max_uses"] == 1
    assert data["uses"] == 0
    assert "expires_at" in data


def test_validate_invite_endpoint_expired_code(client):
    code = create_pilot_invite(created_by="admin", max_uses=1, expires_at="2020-01-01T00:00:00Z")
    res = client.get(f"/api/auth/validate-invite?code={code}")
    assert res.status_code == 200
    data = res.json()
    assert data["valid"] is False
    assert "expired" in data["reason"].lower()


def test_validate_invite_endpoint_used_up_code(client):
    code = create_pilot_invite(created_by="admin", max_uses=1)
    # Simulate use
    _ensure_initialized()
    with _lock:
        conn = _connect()
        try:
            conn.execute("UPDATE pilot_invites SET uses = 1 WHERE code = ?", (code,))
            conn.commit()
        finally:
            conn.close()

    res = client.get(f"/api/auth/validate-invite?code={code}")
    assert res.status_code == 200
    data = res.json()
    assert data["valid"] is False
    assert "already been used" in data["reason"].lower()
