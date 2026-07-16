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
    company_name: Optional[str] = None
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
    sp500_cumulative: list[float]


class StrategyMetrics(BaseModel):
    name: str
    total_return_pct: float
    sharpe_ratio: float
    max_drawdown_pct: float
    current_equity: float
    win_rate_pct: float


class CompareResponse(BaseModel):
    dates: list[str]
    shariah_equity: list[float]
    daytrader_equity: list[float]
    shariah: StrategyMetrics
    daytrader: StrategyMetrics
    daytrader_available: bool


class ComplianceResponse(BaseModel):
    compliant: bool
    violations: list[str]
    held_count: int
    universe_size: int
    last_checked: Optional[str]


class DayTraderAccountResponse(BaseModel):
    equity: float
    cash: float
    buying_power: float
    dayl_pl: float
    dayl_pl_pct: float
    available: bool


class DayTraderPositionResponse(BaseModel):
    symbol: str
    qty: float
    market_value: float
    avg_entry_price: float
    unrealized_pl: float
    unrealized_pl_pct: float
    current_price: float
    side: str


class DayTraderTradeEntry(BaseModel):
    timestamp: str
    symbol: str
    side: str
    qty: float
    price: float
    notional: float


class DayTraderResponse(BaseModel):
    account: DayTraderAccountResponse
    positions: list[DayTraderPositionResponse]
    trades_today: list[DayTraderTradeEntry]
    max_positions: int
    gap_threshold_pct: float
    rvol_threshold: float
    stop_loss_pct: float
    min_price: float
    min_adv: float
    watchlist_size: int


class SettingsResponse(BaseModel):
    alpaca_api_key: str
    alpaca_api_secret_masked: str
    alpaca_base_url: str
    etf_symbol: str
    top_n: int
    etf_symbols: list[str]
    sector_cap: float
    drift_threshold: float
    dashboard_password_masked: str
    google_client_id: Optional[str] = None
    google_client_secret_masked: Optional[str] = None
    google_redirect_uri: Optional[str] = None
    allowed_google_emails: list[str] = []



class SettingsUpdateRequest(BaseModel):
    alpaca_api_key: Optional[str] = None
    alpaca_api_secret: Optional[str] = None
    alpaca_base_url: Optional[str] = None
    etf_symbol: Optional[str] = None
    top_n: Optional[int] = None
    etf_symbols: Optional[list[str]] = None
    sector_cap: Optional[float] = None
    drift_threshold: Optional[float] = None
    dashboard_password: Optional[str] = None
    google_client_id: Optional[str] = None
    google_client_secret: Optional[str] = None
    google_redirect_uri: Optional[str] = None
    allowed_google_emails: Optional[list[str]] = None


class NotificationItem(BaseModel):
    id: str
    source: str       # "shariah_trader" | "day_trader" | "platform"
    category: str     # "trade" | "compliance" | "platform"
    severity: str     # "info" | "warning" | "critical"
    title: str
    body: str
    read: bool
    created_at: str   # ISO-8601 UTC


class NotificationsResponse(BaseModel):
    items: list[NotificationItem]
    unread_count: int


