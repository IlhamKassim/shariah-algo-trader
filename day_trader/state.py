import datetime
import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class GapData:
    prev_close: float
    gap_pct: float    # (open_price - prev_close) / prev_close
    gap_amount: float # open_price - prev_close in dollars
    rvol: float       # first-minute volume / (ADV / 390)


@dataclass
class ActivePosition:
    symbol: str
    entry_price: float
    stop_loss: float       # hard floor — sell immediately if breached
    highest_price: float   # tracks peak for trailing stop
    qty: float
    gap_amount: float      # used to compute profit target


@dataclass
class DayTraderState:
    """In-memory state for a single trading day. Resets at each market open."""

    date: datetime.date = field(default_factory=datetime.date.today)
    gaps: dict[str, GapData] = field(default_factory=dict)
    positions: dict[str, ActivePosition] = field(default_factory=dict)
    traded_today: set[str] = field(default_factory=set)
    starting_equity: float | None = None  # recorded at first scan of the day
    circuit_broken: bool = False          # True once daily loss limit is hit

    def reset(self) -> None:
        new_date = datetime.date.today()
        logger.info("DayTraderState reset for %s (was %s)", new_date, self.date)
        self.date = new_date
        self.gaps.clear()
        self.positions.clear()
        self.traded_today.clear()
        self.starting_equity = None
        self.circuit_broken = False

    def is_stale(self) -> bool:
        return self.date != datetime.date.today()

    def open_position_count(self) -> int:
        return len(self.positions)


# Module-level singleton shared across all jobs in the same process
state = DayTraderState()
