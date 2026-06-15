import os
import pytest
from shariah_algo_trader.config import Config


def make_env(**overrides):
    base = {
        "ALPACA_API_KEY": "test-key",
        "ALPACA_API_SECRET": "test-secret",
        "ALPACA_BASE_URL": "https://paper-api.alpaca.markets",
        "ETF_SYMBOL": "SPUS",
        "TOP_N": "20",
    }
    return {**base, **overrides}


class TestConfigLoads:
    def test_exposes_all_values_when_env_is_complete(self, monkeypatch):
        for k, v in make_env().items():
            monkeypatch.setenv(k, v)

        cfg = Config()

        assert cfg.alpaca_api_key == "test-key"
        assert cfg.alpaca_api_secret == "test-secret"
        assert cfg.alpaca_base_url == "https://paper-api.alpaca.markets"
        assert cfg.etf_symbol == "SPUS"
        assert cfg.top_n == 20

    def test_top_n_is_int(self, monkeypatch):
        for k, v in make_env().items():
            monkeypatch.setenv(k, v)

        cfg = Config()

        assert isinstance(cfg.top_n, int)


class TestConfigMissingVars:
    @pytest.mark.parametrize("missing_var", [
        "ALPACA_API_KEY",
        "ALPACA_API_SECRET",
        "ALPACA_BASE_URL",
        "ETF_SYMBOL",
        "TOP_N",
    ])
    def test_raises_on_missing_required_var(self, monkeypatch, missing_var):
        env = make_env()
        env.pop(missing_var)
        for k, v in env.items():
            monkeypatch.setenv(k, v)
        monkeypatch.delenv(missing_var, raising=False)

        with pytest.raises(EnvironmentError, match=missing_var):
            Config()
