import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from dashboard.api.main import app
from dashboard.api.deps import get_config
from shariah_algo_trader.config import Config
from dashboard.api.hardening import validate_alpaca_base_url

class MockConfig(Config):
    supabase_enabled = True
    enforce_mfa = False

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

def test_extreme_parameter_injection(client, auth_headers):
    """Task 5.1: Extreme Parameter Injection"""
    
    # 1. Negative top_n
    payload_1 = {"top_n": -1, "sector_cap": 0.20}
    res_1 = client.post("/api/settings", headers=auth_headers, json=payload_1)
    assert res_1.status_code in [400, 422], f"Failed to block negative top_n, got {res_1.status_code}"
    
    # 2. Too large sector_cap
    payload_2 = {"top_n": 20, "sector_cap": 2.0} # 200%
    res_2 = client.post("/api/settings", headers=auth_headers, json=payload_2)
    assert res_2.status_code in [400, 422], f"Failed to block sector_cap > 1.0, got {res_2.status_code}"
    
    # 3. Negative sector_cap
    payload_3 = {"top_n": 20, "sector_cap": -0.5} 
    res_3 = client.post("/api/settings", headers=auth_headers, json=payload_3)
    assert res_3.status_code in [400, 422], f"Failed to block negative sector_cap, got {res_3.status_code}"

def test_sql_injection_payload_escape(client, auth_headers):
    """Task 5.2: SQL Injection & Payload Escape"""
    
    # The application uses sqlite3 parameterized queries (?), which natively protects against SQLi.
    # We will test that injecting a SQL string into `etf_symbol` does not crash the server 
    # but gets saved cleanly (or gets rejected if validation fails).
    
    with patch("dashboard.api.user_store._connect") as mock_conn:
        mock_db = mock_conn.return_value
        
        # We also need to patch _enforce_paper_only, since this is a tester
        with patch("dashboard.api.user_store._enforce_paper_only"):
            payload = {"etf_symbol": "SPUS'); DROP TABLE user_settings;--"}
            # The pydantic model should reject this immediately because it's not a valid ticker symbol (length max 10, no special chars)
            res = client.post("/api/settings", headers=auth_headers, json=payload)
            
            # The API should reject it via Pydantic OR save it harmlessly as a literal string. 
            # Either 422 (validation error) or 200 (harmless string save).
            # We assert it does NOT return a 500 Error (which would indicate SQL syntax failure).
            assert res.status_code in [200, 422], f"Server crashed on SQL injection attempt: {res.status_code}"

def test_base_url_ssrf_bypass():
    """Task 5.3: Base URL SSRF Bypass via IP Spoofing"""
    # Test validate_alpaca_base_url from hardening.py
    
    # AWS Metadata
    assert validate_alpaca_base_url("http://169.254.169.254") is None, "SSRF Bypass: Allowed local IP"
    assert validate_alpaca_base_url("https://169.254.169.254") is None, "SSRF Bypass: Allowed local IP"
    
    # Localhost
    assert validate_alpaca_base_url("http://localhost:8000") is None, "SSRF Bypass: Allowed localhost"
    assert validate_alpaca_base_url("https://localhost:8000") is None, "SSRF Bypass: Allowed localhost"
    
    # Subdomain spoofing
    assert validate_alpaca_base_url("https://fake-alpaca.markets.attacker.com") is None, "SSRF Bypass: Allowed spoofed subdomain"
    assert validate_alpaca_base_url("https://attacker.com/alpaca.markets") is None, "SSRF Bypass: Allowed spoofed subdomain path"
    
    # Valid urls should pass
    assert validate_alpaca_base_url("https://api.alpaca.markets") == "https://api.alpaca.markets"
    assert validate_alpaca_base_url("https://paper-api.alpaca.markets") == "https://paper-api.alpaca.markets"
