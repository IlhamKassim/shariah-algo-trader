import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch

from dashboard.api.main import app as dashboard_app
from dashboard.api.deps import get_config
from admin_app.api.main import app as admin_app

class MockConfig:
    supabase_enabled = True
    enforce_mfa = False
    dashboard_password = None
    google_client_id = None
    google_client_secret = None
    clerk_enabled = False

@pytest.fixture
def dashboard_client():
    dashboard_app.dependency_overrides[get_config] = lambda: MockConfig()
    yield TestClient(dashboard_app)
    dashboard_app.dependency_overrides.clear()

@pytest.fixture
def admin_client():
    admin_app.dependency_overrides[get_config] = lambda: MockConfig()
    yield TestClient(admin_app)
    admin_app.dependency_overrides.clear()

def test_idor_cross_tenant_access_prevented(dashboard_client):
    """Task 1.1: Verify user cannot fetch another user's portfolio/settings by tampering with user_id params."""
    with patch("dashboard.api.deps._decode_supabase_jwt") as mock_decode:
        # Simulate User A logged in
        mock_decode.return_value = {"sub": "user_A", "aal": "aal1"}
        headers = {"Authorization": "Bearer fake_token"}
        
        # Test 1: For POST /api/settings, IDOR attempt
        with patch("dashboard.api.routers.settings.save_user_settings") as mock_save:
            # We must provide valid SettingsUpdateRequest fields so it doesn't fail 422
            res = dashboard_client.post("/api/settings", json={"etf_symbol": "SPUS"}, headers=headers)
            assert res.status_code == 200
            mock_save.assert_called_once()
            args = mock_save.call_args[0]
            assert args[0] == "user_A", "Settings saved to wrong tenant! IDOR vulnerability!"

def test_notification_feed_isolation(dashboard_client):
    """Task 1.2: Verify notification read-state is strictly owner-scoped."""
    with patch("dashboard.api.deps._decode_supabase_jwt") as mock_decode:
        mock_decode.return_value = {"sub": "user_A", "aal": "aal1"}
        headers = {"Authorization": "Bearer fake_token"}
        
        with patch("dashboard.api.routers.notifications.mark_all_read") as mock_mark:
            res = dashboard_client.patch("/api/notifications/read-all", headers=headers)
            assert res.status_code == 200
            mock_mark.assert_called_once_with(user_id="user_A", is_admin=False)
            
        with patch("dashboard.api.routers.notifications.mark_one_read") as mock_mark_one:
            res = dashboard_client.patch("/api/notifications/123/read", headers=headers)
            assert res.status_code == 200
            mock_mark_one.assert_called_once_with("123", user_id="user_A", is_admin=False)

def test_spectate_proxy_boundary_verification(admin_client):
    """Task 1.3: Verify non-admin testers are rejected from /api/admin/spectate/*"""
    with patch("dashboard.api.deps._decode_supabase_jwt") as mock_decode:
        # User is NOT admin (role is tester)
        mock_decode.return_value = {"sub": "user_tester", "app_metadata": {"role": "tester"}, "aal": "aal1"}
        headers = {"Authorization": "Bearer fake_token"}
        
        with patch("dashboard.api.routers.settings.get_user_settings", return_value={"trading_mode": "paper"}):
            res = admin_client.get("/api/admin/spectate/portfolio", headers=headers)
            assert res.status_code == 403
            assert res.json()["detail"] == "Admin privileges required"

        # User IS admin
        mock_decode.return_value = {"sub": "user_admin", "app_metadata": {"role": "admin"}, "aal": "aal1"}
        with patch("admin_app.api.routers.spectate._proxy") as mock_proxy:
            mock_proxy.return_value = []
            res = admin_client.get("/api/admin/spectate/portfolio", headers=headers)
            assert res.status_code == 200
