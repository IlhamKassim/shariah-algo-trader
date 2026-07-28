import pytest
from fastapi import Request
from fastapi.testclient import TestClient
from dashboard.api.main import app
from dashboard.api.deps import verify_auth
from dashboard.api.sanity_check import (
    run_performance_sanity_check,
    MAX_DAILY_RETURN_THRESHOLD,
    MAX_DAILY_ALPHA_DRIFT_THRESHOLD,
)

def test_sanity_check_unconfigured_user():
    result = run_performance_sanity_check("non_existent_user_123")
    assert result["status"] == "NO_SETTINGS"
    assert result["is_realistic"] is True

def test_sanity_check_endpoint_integration():
    def override_verify_auth(request: Request):
        request.state.user_id = "5b7fb8dd-5f45-4225-a62e-5c908be06279"
        request.state.user_email = "aqilnazri9@gmail.com"
        return True

    app.dependency_overrides[verify_auth] = override_verify_auth
    client = TestClient(app)

    # Test POST /api/sanity-check
    response = client.post("/api/sanity-check")
    if response.status_code != 200:
        print("SANITY CHECK ERROR DETAIL:", response.json())
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "is_realistic" in data
    assert data["user_id"] == "5b7fb8dd-5f45-4225-a62e-5c908be06279"

    # Test GET /api/sanity-check/status
    status_resp = client.get("/api/sanity-check/status")
    assert status_resp.status_code == 200
    status_data = status_resp.json()
    assert status_data["has_run"] is True
    assert status_data["last_check"] is not None

    app.dependency_overrides.clear()
