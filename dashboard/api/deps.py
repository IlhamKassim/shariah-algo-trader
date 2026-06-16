from functools import lru_cache

from shariah_algo_trader.config import Config
from shariah_algo_trader.execution.alpaca_client import AlpacaClient


@lru_cache
def get_config() -> Config:
    return Config()


@lru_cache
def get_alpaca() -> AlpacaClient:
    cfg = get_config()
    return AlpacaClient(cfg.alpaca_api_key, cfg.alpaca_api_secret, cfg.alpaca_base_url)
