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
};
