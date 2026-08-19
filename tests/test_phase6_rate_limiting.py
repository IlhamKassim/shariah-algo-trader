import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from dashboard.api.main import app
from dashboard.api.deps import get_config
from shariah_algo_trader.config import Config

class MockConfig(Config):
    # See tests/test_phase3_rbac.py's MockConfig for why __init__ is needed:
    # Config.__init__ would otherwise silently overwrite these as instance attrs.
    def __init__(self):
        super().__init__()
        self.supabase_enabled = True
        self.enforce_mfa = False

@pytest.fixture
def client():
    app.dependency_overrides[get_config] = lambda: MockConfig()
    yield TestClient(app)
    app.dependency_overrides.clear()

@pytest.fixture
def auth_headers():
    with patch("dashboard.api.deps._decode_supabase_jwt") as mock_decode:
        mock_decode.return_value = {
            "sub": "tester_id",
            "aal": "aal1",
            "app_metadata": {"role": "tester"}
        }
        yield {"Authorization": "Bearer fake_token"}

def test_public_waitlist_flooding(client):
    """Task 6.1: Public Waitlist Flooding"""
    # Rate limit on waitlist is typically 5/minute
    # We will loop 10 times to hit the rate limit.
    
    payload = {"email": "test@example.com", "name": "Test User"}
    
    # We may hit 429 after a few requests.
    hit_429 = False
    for _ in range(10):
        # We patch db so we don't actually write to DB during tests
        with patch("dashboard.api.routers.waitlist.db.add_waitlist_signup"):
            res = client.post("/api/public/waitlist", json=payload)
            if res.status_code == 429:
                hit_429 = True
                break
                
    assert hit_429 is True, "Failed to rate limit waitlist flooding!"

def test_universe_refresh_exhaustion(client):
    """Task 6.2: Universe Refresh Exhaustion"""
    # /api/universe/refresh is computationally heavy and should be rate limited per minute.
    
    # We must be an admin to hit the refresh endpoint
    with patch("dashboard.api.deps._decode_supabase_jwt") as mock_decode:
        mock_decode.return_value = {
            "sub": "admin_id",
            "aal": "aal1",
            "app_metadata": {"role": "admin"}
        }
        headers = {"Authorization": "Bearer fake_token"}

        hit_429 = False
        for _ in range(20):
            with patch("dashboard.api.routers.universe._refresh_background") as mock_refresh:
                res = client.post("/api/universe/refresh", headers=headers)
                if res.status_code == 429:
                    hit_429 = True
                    break
                
    assert hit_429 is True, "Failed to rate limit universe refresh!"

def test_auth_rate_limiting(client):
    """Task 6.3: Auth Rate Limiting"""
    # Assuming there's a login or signup endpoint, we want to see it rate-limited.
    # The /api/auth/* routes should have stricter limits.
    
    payload = {"email": "attacker@example.com", "password": "password"}
    hit_429 = False
    for _ in range(15):
        # Even if login fails, rate limiting should kick in.
        res = client.post("/api/auth/login", json=payload)
        if res.status_code == 429:
            hit_429 = True
            break
            
    assert hit_429 is True, "Failed to rate limit auth login!"
