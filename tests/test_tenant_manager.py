import pytest
import sqlite3
from pathlib import Path
from unittest.mock import MagicMock, patch

from shariah_algo_trader.config import Config
from shariah_algo_trader.execution.tenant_manager import (
    execute_multi_tenant_job,
    get_active_tenant_accounts,
)


def test_tenant_manager_fallback_when_db_empty():
    cfg = Config()
    cfg.alpaca_api_key = "PKTEST123456"
    cfg.alpaca_api_secret = "SKTEST123456"
    cfg.alpaca_base_url = "https://paper-api.alpaca.markets"

    with patch("shariah_algo_trader.execution.tenant_manager._DB_PATH", Path("/tmp/non_existent_db.db")):
        tenants = get_active_tenant_accounts(cfg)
        assert len(tenants) == 1
        assert tenants[0]["user_id"] == "server_primary"
        assert tenants[0]["alpaca_api_key"] == "PKTEST123456"
        assert tenants[0]["trading_mode"] == "paper"


def test_execute_multi_tenant_job_fault_isolation():
    cfg = Config()
    cfg.alpaca_api_key = "PKTEST123456"
    cfg.alpaca_api_secret = "SKTEST123456"

    executed_users = []

    def mock_job(tenant):
        user_id = tenant["user_id"]
        executed_users.append(user_id)
        if user_id == "user_failing":
            raise ValueError("Simulated tenant execution failure")

    mock_tenants = [
        {"user_id": "user_a", "trading_mode": "paper", "alpaca_api_key": "k1", "alpaca_api_secret": "s1", "alpaca_base_url": "url", "etf_symbol": "SPUS", "top_n": 10, "sector_cap": 0.2, "drift_threshold": 0.03},
        {"user_id": "user_failing", "trading_mode": "paper", "alpaca_api_key": "k2", "alpaca_api_secret": "s2", "alpaca_base_url": "url", "etf_symbol": "SPUS", "top_n": 10, "sector_cap": 0.2, "drift_threshold": 0.03},
        {"user_id": "user_b", "trading_mode": "paper", "alpaca_api_key": "k3", "alpaca_api_secret": "s3", "alpaca_base_url": "url", "etf_symbol": "SPUS", "top_n": 10, "sector_cap": 0.2, "drift_threshold": 0.03},
    ]

    with patch("shariah_algo_trader.execution.tenant_manager.get_active_tenant_accounts", return_value=mock_tenants):
        summary = execute_multi_tenant_job("unit_test_job", mock_job, cfg)

        assert summary["total_tenants"] == 3
        assert summary["successful_tenants"] == 2
        assert summary["failed_tenants"] == 1
        assert summary["tenant_results"]["user_a"] == "SUCCESS"
        assert summary["tenant_results"]["user_b"] == "SUCCESS"
        assert "FAILED" in summary["tenant_results"]["user_failing"]
        assert executed_users == ["user_a", "user_failing", "user_b"]
