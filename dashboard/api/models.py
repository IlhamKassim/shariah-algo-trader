from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class StatusResponse(BaseModel):
    scheduler_running: bool
    last_started_at: Optional[str]
    next_fire_at: Optional[str]
    etf_symbol: str
    top_n: int
    broker_url: str


class AccountResponse(BaseModel):
    equity: float
    cash: float
    buying_power: float
    portfolio_value: float
    dayl_pl: float
    dayl_pl_pct: float


class PositionResponse(BaseModel):
    symbol: str
    qty: float
    market_value: float
    avg_entry_price: float
    unrealized_pl: float
    unrealized_pl_pct: float
    current_price: float


class StockScore(BaseModel):
    symbol: str
    momentum_score: float
    quality_score: float
    volatility_score: float
    value_score: float
    factor_score: float
    rank: int
    in_portfolio: bool
    in_top_n: bool


class UniverseResponse(BaseModel):
    computing: bool
    last_computed_at: Optional[str]
    stocks: list[StockScore]


class ActivityEntry(BaseModel):
    timestamp: str
    level: str
    type: str
    message: str
    tickers: list[str]


class ActivityResponse(BaseModel):
    entries: list[ActivityEntry]


class PerformanceResponse(BaseModel):
    dates: list[str]
    portfolio_cumulative: list[float]
    benchmark_cumulative: list[float]
