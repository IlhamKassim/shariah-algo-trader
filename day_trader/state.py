import datetime
import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class ORBData:
    high: float
    low: float
    open_volume: int          # total volume in the opening range window
    avg_daily_volume: float   # 30-day average daily volume
    rvol: float = 0.0         # open_volume / (adv * orb_minutes/390)
    vwap: float = 0.0         # VWAP of the opening range window
    gap_pct: float = 0.0      # (today_open - prev_close) / prev_close


@dataclass
class ActivePosition:
    symbol: str
    entry_price: float
    stop_loss: float       # hard floor — sell immediately if breached
    highest_price: float   # tracks peak for trailing stop
    qty: float


@dataclass
class DayTraderState:
    """In-memory state for a single trading day. Resets at each market open."""

    date: datetime.date = field(default_factory=datetime.date.today)
    orb: dict[str, ORBData] = field(default_factory=dict)
    positions: dict[str, ActivePosition] = field(default_factory=dict)
    traded_today: set[str] = field(default_factory=set)   # symbols already entered today

    def reset(self) -> None:
        new_date = datetime.date.today()
        logger.info("DayTraderState reset for %s (was %s)", new_date, self.date)
        self.date = new_date
        self.orb.clear()
        self.positions.clear()
        self.traded_today.clear()

    def is_stale(self) -> bool:
        return self.date != datetime.date.today()

    def open_position_count(self) -> int:
        return len(self.positions)


# Module-level singleton shared across all jobs in the same process
state = DayTraderState()
