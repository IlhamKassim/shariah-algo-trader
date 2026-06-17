import os
from dotenv import load_dotenv

load_dotenv()

_REQUIRED = [
    "ALPACA_API_KEY",
    "ALPACA_API_SECRET",
    "ALPACA_BASE_URL",
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
        self.etf_symbol: str = os.environ["ETF_SYMBOL"]
        self.top_n: int = int(os.environ["TOP_N"])

        # Comma-separated list of Shariah ETFs whose holdings form the universe.
        # Defaults to [ETF_SYMBOL, HLAL] if ETF_SYMBOLS is not set.
        etf_symbols_env = os.environ.get("ETF_SYMBOLS", "").strip()
        if etf_symbols_env:
            self.etf_symbols: list[str] = [
                s.strip().upper() for s in etf_symbols_env.split(",") if s.strip()
            ]
        else:
            self.etf_symbols = list({self.etf_symbol.upper(), "HLAL"})

        # Max fraction of the portfolio from a single GICS sector (default 20 %)
        self.sector_cap: float = float(os.environ.get("SECTOR_CAP", "0.20"))

        # Absolute weight-drift threshold that triggers an intra-month rebalance
        self.drift_threshold: float = float(os.environ.get("DRIFT_THRESHOLD", "0.03"))
