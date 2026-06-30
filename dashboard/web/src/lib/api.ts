export interface StatusResponse {
  scheduler_running: boolean;
  last_started_at: string | null;
  next_fire_at: string | null;
  etf_symbol: string;
  top_n: number;
  broker_url: string;
}

export interface AccountResponse {
  equity: number;
  cash: number;
  buying_power: number;
  portfolio_value: number;
  dayl_pl: number;
  dayl_pl_pct: number;
}

export interface PositionResponse {
  symbol: string;
  qty: number;
  market_value: number;
  avg_entry_price: number;
  unrealized_pl: number;
  unrealized_pl_pct: number;
  current_price: number;
}

export interface StockScore {
  symbol: string;
  momentum_score: number;
  quality_score: number;
  volatility_score: number;
  value_score: number;
  factor_score: number;
  rank: number;
  in_portfolio: boolean;
  in_top_n: boolean;
}

export interface UniverseResponse {
  computing: boolean;
  last_computed_at: string | null;
  stocks: StockScore[];
}

export interface ActivityEntry {
  timestamp: string;
  level: string;
  type: string;
  message: string;
  tickers: string[];
}

export interface ActivityResponse {
  entries: ActivityEntry[];
}

export interface PerformanceResponse {
  dates: string[];
  portfolio_cumulative: number[];
  benchmark_cumulative: number[];
  sp500_cumulative: number[];
}

export interface StrategyMetrics {
  name: string;
  total_return_pct: number;
  sharpe_ratio: number;
  max_drawdown_pct: number;
  current_equity: number;
  win_rate_pct: number;
}

export interface CompareResponse {
  dates: string[];
  shariah_equity: number[];
  daytrader_equity: number[];
  shariah: StrategyMetrics;
  daytrader: StrategyMetrics;
  daytrader_available: boolean;
}

export interface ComplianceResponse {
  compliant: boolean;
  violations: string[];
  held_count: number;
  universe_size: number;
  last_checked: string | null;
}

export interface DayTraderAccountResponse {
  equity: number;
  cash: number;
  buying_power: number;
  dayl_pl: number;
  dayl_pl_pct: number;
  available: boolean;
}

export interface DayTraderPositionResponse {
  symbol: string;
  qty: number;
  market_value: number;
  avg_entry_price: number;
  unrealized_pl: number;
  unrealized_pl_pct: number;
  current_price: number;
  side: string;
}

export interface DayTraderTradeEntry {
  timestamp: string;
  symbol: string;
  side: string;
  qty: number;
  price: number;
  notional: number;
}

export interface DayTraderResponse {
  account: DayTraderAccountResponse;
  positions: DayTraderPositionResponse[];
  trades_today: DayTraderTradeEntry[];
  max_positions: number;
  gap_threshold_pct: number;
  rvol_threshold: number;
  stop_loss_pct: number;
  min_price: number;
  min_adv: number;
  watchlist_size: number;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) throw new Error(`API ${path} returned ${res.status}`);
  return res.json();
}

export const api = {
  status: () => apiFetch<StatusResponse>("/api/status"),
  account: () => apiFetch<AccountResponse>("/api/account"),
  portfolio: () => apiFetch<PositionResponse[]>("/api/portfolio"),
  universe: () => apiFetch<UniverseResponse>("/api/universe"),
  refreshUniverse: () =>
    apiFetch<{ status: string }>("/api/universe/refresh", { method: "POST" }),
  activity: (type?: string, date?: string) => {
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (date) params.set("date", date);
    const qs = params.toString();
    return apiFetch<ActivityResponse>(`/api/activity${qs ? `?${qs}` : ""}`);
  },
  performance: () => apiFetch<PerformanceResponse>("/api/performance"),
  compare: () => apiFetch<CompareResponse>("/api/compare"),
  compliance: () => apiFetch<ComplianceResponse>("/api/compliance"),
  dayTrader: () => apiFetch<DayTraderResponse>("/api/day-trader"),
};
