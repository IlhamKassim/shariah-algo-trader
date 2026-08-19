"""Tests for the public /health endpoint (uptime monitoring)."""

import pytest
from fastapi.testclient import TestClient

from dashboard.api.main import app


@pytest.fixture(autouse=True)
def _ensure_store_db():
    """The /health db check reports 503 when data/user_settings.db is absent.

    A fresh worktree has no data/ dir until a user-store test creates it, so
    make the store DB exist before the health assertions run — otherwise these
    tests depend on pytest's file ordering.
    """
    from dashboard.api.user_store import init_user_store

    init_user_store()


def _client():
    return TestClient(app)


def test_health_ok_when_db_reachable():
    response = _client().get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "shariah-trader-dashboard"
    assert data["version"] == "0.1.0"
    assert data["checks"]["db"] == "ok"
    assert data["uptime_seconds"] >= 0
    assert "time" in data


def test_health_public_no_auth_required():
    # No verify_auth override is applied here — the request must succeed
    # unauthenticated because uptime monitors cannot log in.
    response = _client().get("/health")
    assert response.status_code == 200


def test_health_503_when_db_down(monkeypatch):
    monkeypatch.setattr(
        "dashboard.api.routers.health._db_reachable", lambda: False
    )
    response = _client().get("/health")
    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "degraded"
    assert data["checks"]["db"] == "fail"
