import os
from dotenv import load_dotenv

load_dotenv()

_REQUIRED = [
    "ALPACA_API_KEY",
    "ALPACA_API_SECRET",
    "ALPACA_BASE_URL",
    "FMP_API_KEY",
    "ETF_SYMBOL",
    "TOP_N",
]


class Config:
    def __init__(self):
        missing = [k for k in _REQUIRED if not os.environ.get(k)]
        if missing:
            raise EnvironmentError(
                f"Missing required environment variables: {', '.join(missing)}"
            )

        self.alpaca_api_key: str = os.environ["ALPACA_API_KEY"]
        self.alpaca_api_secret: str = os.environ["ALPACA_API_SECRET"]
        self.alpaca_base_url: str = os.environ["ALPACA_BASE_URL"]
        self.fmp_api_key: str = os.environ["FMP_API_KEY"]
        self.etf_symbol: str = os.environ["ETF_SYMBOL"]
        self.top_n: int = int(os.environ["TOP_N"])
