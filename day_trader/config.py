import os
from dotenv import load_dotenv

load_dotenv()

_REQUIRED = ["DAY_ALPACA_API_KEY", "DAY_ALPACA_API_SECRET"]


class DayTraderConfig:
    def __init__(self):
        missing = [k for k in _REQUIRED if not os.environ.get(k)]
        if missing:
            raise EnvironmentError(
                f"Missing required day-trader env vars: {', '.join(missing)}"
            )

        self.api_key: str = os.environ["DAY_ALPACA_API_KEY"]
        self.api_secret: str = os.environ["DAY_ALPACA_API_SECRET"]
        self.base_url: str = os.environ.get(
            "DAY_ALPACA_BASE_URL", "https://paper-api.alpaca.markets"
        )
        self.data_url: str = os.environ.get(
            "DAY_ALPACA_DATA_URL", "https://data.alpaca.markets"
        )

        # Strategy parameters
        self.max_positions: int = int(os.environ.get("DAY_MAX_POSITIONS", "5"))
        self.position_size_pct: float = float(os.environ.get("DAY_POSITION_SIZE_PCT", "0.10"))
        self.stop_loss_pct: float = float(os.environ.get("DAY_STOP_LOSS_PCT", "0.02"))
        self.trailing_stop_pct: float = float(os.environ.get("DAY_TRAILING_STOP_PCT", "0.015"))
        self.orb_minutes: int = int(os.environ.get("DAY_ORB_MINUTES", "30"))
        # Minimum fraction of avg daily volume required in opening range to confirm signal
        self.volume_confirm_pct: float = float(os.environ.get("DAY_VOLUME_CONFIRM_PCT", "0.20"))
