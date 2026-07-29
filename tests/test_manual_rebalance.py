import pytest
from unittest.mock import MagicMock, patch
from fastapi import Request
from fastapi.testclient import TestClient

from dashboard.api.main import app
from dashboard.api.deps import verify_auth
from shariah_algo_trader.config import Config
from shariah_algo_trader.execution.tenant_manager import trigger_single_tenant_rebalance


def test_manual_rebalance_unconfigured_user():
    cfg = Config()
    with patch("shariah_algo_trader.execution.tenant_manager.get_active_tenant_accounts", return_value=[]):
        with pytest.raises(ValueError, match="No active trading credentials"):
            trigger_single_tenant_rebalance("non_existent_user", cfg)


def test_manual_rebalance_endpoint_unauthorized():
    client = TestClient(app)
    app.dependency_overrides.clear()
    res = client.post("/api/rebalance/run")
    assert res.status_code == 401


def test_manual_rebalance_endpoint_success():
    def override_verify_auth(request: Request):
        request.state.user_id = "test_user_rebalance_123"
        return True

    mock_tenant_result = {
        "user_id": "test_user_rebalance_123",
        "rebalance_submitted": True,
        "accounts_processed": 1,
        "results": [{"trading_mode": "paper", "target_stocks": ["AAPL", "MSFT"]}],
        "executed_at": "2026-07-28T15:30:00Z",
    }

    app.dependency_overrides[verify_auth] = override_verify_auth
    client = TestClient(app)

    with patch("dashboard.api.routers.rebalance.trigger_single_tenant_rebalance", return_value=mock_tenant_result):
        res = client.post("/api/rebalance/run")
        assert res.status_code == 200
        data = res.json()
        assert data["rebalance_submitted"] is True
        assert data["accounts_processed"] == 1
        assert data["user_id"] == "test_user_rebalance_123"

    app.dependency_overrides.clear()
