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
