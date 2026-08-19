import pytest
from dashboard.api.user_store import get_user_settings, save_user_settings, init_user_store

def test_user_store_isolation(tmp_path):
    init_user_store()

    user_a = "user_111"
    user_b = "user_222"

    save_user_settings(user_a, {
        "alpaca_api_key": "KEY_AAA",
        "alpaca_api_secret": "SECRET_AAA",
        "etf_symbol": "SPUS",
        "top_n": 15,
    })

    save_user_settings(user_b, {
        "alpaca_api_key": "KEY_BBB",
        "alpaca_api_secret": "SECRET_BBB",
        "etf_symbol": "HLAL",
        "top_n": 10,
    })

    data_a = get_user_settings(user_a)
    data_b = get_user_settings(user_b)

    assert data_a is not None
    assert data_a["alpaca_api_key"] == "KEY_AAA"
    assert data_a["alpaca_api_secret"] == "SECRET_AAA"
    assert data_a["etf_symbol"] == "SPUS"
    assert data_a["top_n"] == 15

    assert data_b is not None
    assert data_b["alpaca_api_key"] == "KEY_BBB"
    assert data_b["alpaca_api_secret"] == "SECRET_BBB"
    assert data_b["etf_symbol"] == "HLAL"
    assert data_b["top_n"] == 10


def test_user_profile_identity_saved_and_synced(tmp_path, monkeypatch):
    from dashboard.api import user_store
    captured_sync = {}

    def _mock_sync(user_id: str, record: dict):
        captured_sync[user_id] = record

    monkeypatch.setattr(user_store, "_sync_to_supabase", _mock_sync)
    init_user_store()

    user_id = "user_quant_999"
    profile_data = {
        "first_name": "John",
        "last_name": "Cena",
        "quant_handle": "@john_trader",
        "country": "Malaysia",
        "investor_type": "individual",
        "paper_capital": 100000.0,
        "onboarding_completed_at": "2026-08-16T13:00:00Z",
        "etf_symbol": "SPUS",
        "top_n": 20,
    }

    save_user_settings(user_id, profile_data)
    stored = get_user_settings(user_id)

    assert stored is not None
    assert stored["first_name"] == "John"
    assert stored["last_name"] == "Cena"
    assert stored["quant_handle"] == "@john_trader"
    assert stored["country"] == "Malaysia"
    assert stored["investor_type"] == "individual"
    assert stored["paper_capital"] == 100000.0
    assert stored["onboarding_completed_at"] == "2026-08-16T13:00:00Z"

    # Verify sync payload sent to Supabase
    assert user_id in captured_sync
    sync_rec = captured_sync[user_id]
    assert sync_rec["first_name"] == "John"
    assert sync_rec["last_name"] == "Cena"
    assert sync_rec["quant_handle"] == "@john_trader"
    assert sync_rec["country"] == "Malaysia"
    assert sync_rec["investor_type"] == "individual"
    assert sync_rec["paper_capital"] == 100000.0
    assert sync_rec["onboarding_completed_at"] == "2026-08-16T13:00:00Z"

