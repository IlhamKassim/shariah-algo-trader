import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from admin_app.api.main import app as admin_app
from dashboard.api.main import app as dashboard_app
from dashboard.api.deps import get_config
from shariah_algo_trader.config import Config

class MockConfig(Config):
    # Config.__init__ unconditionally sets these same names as *instance*
    # attributes from the environment, which would silently shadow plain
    # class-attribute overrides (instance __dict__ wins over class attrs for
    # non-descriptor values). Re-apply after super().__init__() so the mock
    # values actually stick.
    def __init__(self):
        super().__init__()
        self.supabase_enabled = True
        self.enforce_mfa = False
        self.dashboard_password = None
        self.google_client_id = None
        self.google_client_secret = None
        self.clerk_enabled = False
        self.admin_emails = {"aqilnazri9@gmail.com", "ilhamkassim2003@gmail.com"}

@pytest.fixture
def admin_client():
    admin_app.dependency_overrides[get_config] = lambda: MockConfig()
    yield TestClient(admin_app)
    admin_app.dependency_overrides.clear()

def test_jwt_claim_tampering(admin_client):
    """Task 3.1: JWT Claim Tampering - Forging user_metadata.role="admin" """
    # In Supabase JWTs, user_metadata can be modified by the user on the frontend,
    # but app_metadata can only be modified by a service role key.
    # We must ensure `is_admin` strictly checks `app_metadata.role` or relies on secure db values.
    
    with patch("dashboard.api.deps._decode_supabase_jwt") as mock_decode:
        # A malicious user modifies their user_metadata
        mock_decode.return_value = {
            "sub": "hacker_user_id",
            "aal": "aal1",
            "user_metadata": {"role": "admin"},
            "app_metadata": {"role": "tester"}  # The real verified role is tester
        }
        
        headers = {"Authorization": "Bearer fake_token"}
        
        # In a SaaS (Supabase) context, get_pilot_role may also be called.
        # But if it relies on JWT, it should use app_metadata.
        res = admin_client.get("/api/admin/testers", headers=headers)
        
        # They should be rejected!
        assert res.status_code == 403, "VULNERABILITY: API trusted user_metadata for admin check!"
        assert "Admin privileges required" in res.json().get("detail", "")

def test_admin_api_matrix_fuzzing(admin_client):
    """Task 3.2: Admin API Matrix Fuzzing"""
    # Test all /api/admin/* endpoints with anonymous and tester tokens
    endpoints = [
        ("GET", "/api/admin/testers"),
        ("GET", "/api/admin/invites"),
        ("GET", "/api/admin/audit"),
        ("GET", "/api/admin/spectate/portfolio?spectate_user_id=123"),
        ("POST", "/api/admin/invites"),
        ("POST", "/api/admin/testers/target_id/approve"),
        ("DELETE", "/api/admin/testers/target_id"),
    ]
    
    # 1. Anonymous Requests (No Authorization Header)
    for method, path in endpoints:
        res = admin_client.request(method, path)
        assert res.status_code == 401, f"Anonymous bypass on {method} {path}!"
        
    # 2. Tester Tokens
    with patch("dashboard.api.deps._decode_supabase_jwt") as mock_decode:
        mock_decode.return_value = {
            "sub": "tester_id",
            "aal": "aal1",
            "app_metadata": {"role": "tester"}
        }
        headers = {"Authorization": "Bearer fake_token"}
        
        for method, path in endpoints:
            res = admin_client.request(method, path, headers=headers)
            assert res.status_code == 403, f"Privilege escalation on {method} {path}!"

def test_self_deletion_and_super_admin_safeguards(admin_client):
    """Task 3.3: Self-Deletion & Super-Admin Safeguards"""
    # `DELETE /api/admin/testers/{user_id}` should block self-deletion and removing super admins
    
    with patch("dashboard.api.deps._decode_supabase_jwt") as mock_decode:
        mock_decode.return_value = {
            "sub": "admin_user_1",
            "email": "aqilnazri9@gmail.com",
            "aal": "aal1",
            "app_metadata": {"role": "admin"}
        }
        headers = {"Authorization": "Bearer fake_token"}
        
        with patch("admin_app.api.routers.admin._require_pilot_user") as mock_get_user:
            # 1. Self-deletion block
            res = admin_client.delete("/api/admin/testers/admin_user_1", headers=headers)
            assert res.status_code == 400
            assert "cannot delete your own" in res.json().get("detail", "").lower()
            
            # 2. Deleting another super admin is blocked
            # Mock the target user to be the other super admin
            mock_get_user.return_value = {"user_id": "admin_user_2", "email": "ilhamkassim2003@gmail.com", "role": "admin"}
            res = admin_client.delete("/api/admin/testers/admin_user_2", headers=headers)
            assert res.status_code == 403
            assert "platform administrator" in res.json().get("detail", "").lower()
            
            # 3. Deleting a normal tester succeeds
            mock_get_user.return_value = {"user_id": "some_tester", "email": "tester@example.com", "role": "tester"}
            with patch("admin_app.api.routers.admin.delete_pilot_user") as mock_delete:
                res = admin_client.delete("/api/admin/testers/some_tester", headers=headers)
                assert res.status_code == 200
                mock_delete.assert_called_once()
