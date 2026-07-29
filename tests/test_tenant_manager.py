import pytest
from shariah_algo_trader.execution.tenant_manager import get_active_tenant_accounts
from dashboard.api.user_store import save_user_settings

def test_day_trader_benchmark_isolation():
    user_id = "test_user_account_isolation"
    
    save_user_settings(user_id, {
        "shariah_trader_enabled": True,
        "trading_mode": "paper",
        "alpaca_api_key": "PKTEST123",
        "alpaca_api_secret": "SKTEST123",
    })
    
    # Day Trader engine MUST NEVER return user accounts
    day_accounts = get_active_tenant_accounts(engine="day_trader")
    day_ids = [t["raw_user_id"] for t in day_accounts]
    
    assert user_id not in day_ids
    for account in day_accounts:
        assert account["raw_user_id"] == "server_primary"

    # Shariah Algo Trader engine MUST return registered user accounts
    shariah_accounts = get_active_tenant_accounts(engine="shariah_trader")
    shariah_ids = [t["raw_user_id"] for t in shariah_accounts]
    assert user_id in shariah_ids
