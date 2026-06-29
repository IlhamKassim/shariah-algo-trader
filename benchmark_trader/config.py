import os
from dotenv import load_dotenv

load_dotenv()

_REQUIRED = ["BENCH_ALPACA_API_KEY", "BENCH_ALPACA_API_SECRET"]


class BenchmarkConfig:
    def __init__(self):
        missing = [k for k in _REQUIRED if not os.environ.get(k)]
        if missing:
            raise EnvironmentError(
                f"Missing required benchmark-trader env vars: {', '.join(missing)}"
            )

        self.api_key: str = os.environ["BENCH_ALPACA_API_KEY"]
        self.api_secret: str = os.environ["BENCH_ALPACA_API_SECRET"]
        self.base_url: str = os.environ.get(
            "BENCH_ALPACA_BASE_URL", "https://paper-api.alpaca.markets"
        )
        self.data_url: str = os.environ.get(
            "BENCH_ALPACA_DATA_URL", "https://data.alpaca.markets"
        )

        self.max_positions: int = int(os.environ.get("BENCH_MAX_POSITIONS", "5"))
        self.position_size_pct: float = float(os.environ.get("BENCH_POSITION_SIZE_PCT", "0.10"))
        self.stop_loss_pct: float = float(os.environ.get("BENCH_STOP_LOSS_PCT", "0.02"))
        self.trailing_stop_pct: float = float(os.environ.get("BENCH_TRAILING_STOP_PCT", "0.015"))
        # Minimum gap from prior close required to enter (fraction, e.g. 0.03 = 3%)
        self.gap_threshold: float = float(os.environ.get("BENCH_GAP_PCT", "0.03"))
        # Minimum RVOL in the first minute to confirm real participation
        self.rvol_threshold: float = float(os.environ.get("BENCH_RVOL_THRESHOLD", "1.5"))
        # Profit target = entry + mult × gap_amount
        self.profit_target_mult: float = float(os.environ.get("BENCH_PROFIT_TARGET_MULT", "2.0"))
