import pytest
from unittest.mock import patch, MagicMock

from dashboard.api.user_store import save_user_settings, PaperOnlyGuardError
from shariah_algo_trader.execution.tenant_manager import get_active_tenant_accounts
from dashboard.api.crypto import encrypt_credential
from shariah_algo_trader.config import Config

class MockConfig(Config):
    pass

def test_storage_level_paper_invariant_bypass():
    """Task 2.1: Storage-Level Paper Invariant Bypass"""
    # A tester tries to save live trading credentials.
    # _enforce_paper_only() inside save_user_settings should raise PaperOnlyGuardError.
    
    with patch("dashboard.api.user_store.get_pilot_role", return_value="tester"):
        # We need to simulate that `save_user_settings` is called with live credentials
        user_updates = {
            "trading_mode": "live",
            "alpaca_live_api_key": "LIVE_KEY",
            "alpaca_live_api_secret": "LIVE_SECRET"
        }
        
        with pytest.raises(PaperOnlyGuardError):
            save_user_settings("tester_user_id", user_updates)
            
def test_server_side_risk_acknowledgment_check():
    """Task 2.2: Server-Side Risk Acknowledgment Check"""
    
    cfg = MockConfig()
    
    with patch("shariah_algo_trader.execution.tenant_manager.sqlite3.connect") as mock_conn:
        mock_db = mock_conn.return_value
        
        def execute_side_effect(query, *args, **kwargs):
            mock_cursor = MagicMock()
            if "user_settings" in query:
                mock_cursor.fetchall.return_value = [
                    {
                        "user_id": "unacknowledged_user",
                        "alpaca_api_key_encrypted": encrypt_credential("PAPER_KEY"),
                        "alpaca_api_secret_encrypted": encrypt_credential("PAPER_SEC"),
                        "alpaca_live_api_key_encrypted": encrypt_credential("LIVE_KEY"),
                        "alpaca_live_api_secret_encrypted": encrypt_credential("LIVE_SEC"),
                        "trading_mode": "live",
                        "alpaca_base_url": "https://api.alpaca.markets",
                        "etf_symbol": "SPUS",
                        "top_n": 20,
                        "sector_cap": 0.20,
                        "drift_threshold": 0.03,
                        "shariah_trader_enabled": 1,
                        "risk_acknowledged_at": None,
                    }
                ]
            else:
                mock_cursor.fetchall.return_value = [{"user_id": "unacknowledged_user", "role": "admin"}]
            return mock_cursor
            
        mock_db.execute.side_effect = execute_side_effect
        
        tenants = get_active_tenant_accounts(cfg, engine="all")
        # Because risk_acknowledged_at is None, the live tenant account should NOT be spawned
        for t in tenants:
            assert t.get("trading_mode") != "live", "Unacknowledged user was permitted live trading!"
                        
def test_broker_base_url_execution_hardening():
    """Task 2.3: Broker Base URL Execution Hardening"""
    # Background trading loops strictly bind paper accounts to https://paper-api.alpaca.markets
    
    cfg = MockConfig()
    
    with patch("shariah_algo_trader.execution.tenant_manager.sqlite3.connect") as mock_conn:
        mock_db = mock_conn.return_value
        
        def execute_side_effect(query, *args, **kwargs):
            mock_cursor = MagicMock()
            if "user_settings" in query:
                mock_cursor.fetchall.return_value = [
                    {
                        "user_id": "paper_user_id",
                        "alpaca_api_key_encrypted": encrypt_credential("PAPER_KEY"),
                        "alpaca_api_secret_encrypted": encrypt_credential("PAPER_SEC"),
                        "alpaca_live_api_key_encrypted": encrypt_credential("LIVE_KEY"),
                        "alpaca_live_api_secret_encrypted": encrypt_credential("LIVE_SEC"),
                        "trading_mode": "paper",
                        "alpaca_base_url": "https://api.alpaca.markets", # Malicious base url for paper
                        "etf_symbol": "SPUS",
                        "top_n": 20,
                        "sector_cap": 0.20,
                        "drift_threshold": 0.03,
                        "shariah_trader_enabled": 1,
                        "risk_acknowledged_at": "2024-01-01T00:00:00Z",
                    }
                ]
            else:
                mock_cursor.fetchall.return_value = [{"user_id": "paper_user_id", "role": "admin"}]
            return mock_cursor
            
        mock_db.execute.side_effect = execute_side_effect
        
        tenants = get_active_tenant_accounts(cfg, engine="all")
        
        paper_tenants = [t for t in tenants if t["trading_mode"] == "paper"]
        assert len(paper_tenants) == 1
        # Tenant manager MUST override or have paper_base_url fixed for paper modes
        assert paper_tenants[0]["alpaca_base_url"] == "https://paper-api.alpaca.markets"
