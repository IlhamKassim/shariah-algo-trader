export interface StatusResponse {
  scheduler_running: boolean;
  last_started_at: string | null;
  next_fire_at: string | null;
  etf_symbol: string;
  top_n: number;
  broker_url: string;
  trading_mode?: string;
  is_live?: boolean;
}

export interface AccountResponse {
  equity: number;
  cash: number;
  buying_power: number;
  portfolio_value: number;
  dayl_pl: number;
  dayl_pl_pct: number;
  estimated_fees?: number;
  fee_drag_pct?: number;
  fee_status_label?: string;
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
  company_name?: string;
  /** GICS sector, when the ranking pass resolved one. */
  sector?: string | null;
  /** Set when the stock ranked high enough but the sector cap passed it over. */
  exclusion_reason?: string | null;
  /** Percentile of this stock's Factor Score within the scored universe (0-100). */
  percentile?: number | null;
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
  /** Structured fill detail — present for Alpaca FILL activities. */
  symbol?: string | null;
  side?: string | null;
  qty?: number | null;
  price?: number | null;
  notional?: number | null;
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

export interface AuthStatus {
  auth_enabled: boolean;
  password_auth_enabled: boolean;
  google_auth_enabled: boolean;
  clerk_enabled: boolean;
  supabase_enabled?: boolean;
  mfa_required?: boolean;
  mfa_verified?: boolean;
  authenticated: boolean;
  user_id?: string;
  user_email?: string;
}



export interface SettingsResponse {
  trading_mode?: "paper" | "live";
  alpaca_api_key_masked: string;
  alpaca_api_secret_masked: string;
  alpaca_live_api_key_masked?: string;
  alpaca_live_api_secret_masked?: string;
  alpaca_base_url: string;
  etf_symbol: string;
  top_n: number;
  etf_symbols: string[];
  sector_cap: number;
  drift_threshold: number;
  shariah_trader_enabled?: boolean;
  day_trader_enabled?: boolean;
  first_name?: string;
  last_name?: string;
  quant_handle?: string;
  country?: string;
  investor_type?: string;
  paper_capital?: number;
  onboarding_completed_at?: string;
  dashboard_password_masked: string;
  google_client_id_masked: string | null;
  google_client_secret_masked: string | null;
  google_redirect_uri: string | null;
  allowed_google_emails: string[];
}


export interface SettingsUpdateRequest {
  current_password?: string;
  trading_mode?: "paper" | "live";
  alpaca_api_key?: string;
  alpaca_api_secret?: string;
  alpaca_live_api_key?: string;
  alpaca_live_api_secret?: string;
  alpaca_base_url?: string;
  etf_symbol?: string;
  top_n?: number;
  etf_symbols?: string[];
  sector_cap?: number;
  drift_threshold?: number;
  shariah_trader_enabled?: boolean;
  day_trader_enabled?: boolean;
  first_name?: string;
  last_name?: string;
  quant_handle?: string;
  country?: string;
  investor_type?: string;
  paper_capital?: number;
  onboarding_completed_at?: string;
  dashboard_password?: string;
  google_client_id?: string | null;
  google_client_secret?: string | null;
  google_redirect_uri?: string | null;
  allowed_google_emails?: string[];
}




export interface NotificationItem {
  id: string;
  source: string;
  category: string;
  severity: "info" | "warning" | "critical";
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

export interface NotificationsResponse {
  items: NotificationItem[];
  unread_count: number;
}

export interface SanityCheckResponse {
  user_id: string;
  status: string;
  is_realistic: boolean;
  trading_mode?: string;
  latest_date?: string;
  strategy_cumulative_return?: number;
  spus_cumulative_return?: number;
  sp500_cumulative_return?: number;
  total_alpha?: number;
  latest_strategy_daily_return?: number;
  latest_spus_daily_return?: number;
  latest_sp500_daily_return?: number;
  daily_alpha_drift?: number;
  anomalies: string[];
  checked_at: string;
}



// Helper to detect demo mode
const isDemo = () => localStorage.getItem("shariah_demo_mode") === "true";

// Simulated in-memory states for Demo mode
let isMockComputing = false;
let demoSettings: SettingsResponse = {
  alpaca_api_key_masked: "••••••••••••",
  alpaca_api_secret_masked: "************DEMO",

  alpaca_base_url: "https://paper-api.alpaca.markets",
  etf_symbol: "SPUS",
  top_n: 15,
  etf_symbols: ["SPUS", "HLAL", "SPSK"],
  sector_cap: 0.25,
  drift_threshold: 0.05,
  dashboard_password_masked: "********",
  google_client_id_masked: null,
  google_client_secret_masked: null,

  google_redirect_uri: null,
  allowed_google_emails: [],
};

let demoNotifications: NotificationItem[] = [
  {
    id: "demo-notif-1",
    source: "compliance",
    category: "check",
    severity: "info",
    title: "Compliance Verified",
    body: "All portfolio assets are 100% Shariah-compliant according to AAOIFI standard criteria.",
    read: false,
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
  {
    id: "demo-notif-2",
    source: "system",
    category: "update",
    severity: "info",
    title: "System Booted in Demo Mode",
    body: "Welcome to Shariah Algo Trader! You are observing a simulated showcase of the dashboard.",
    read: true,
    created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
];

const MOCK_STOCKS: StockScore[] = [
  { symbol: "NVDA", company_name: "NVIDIA Corporation", sector: "Technology", momentum_score: 1.5, quality_score: 1.75, volatility_score: 0.33, value_score: -1.0, factor_score: 0.65, percentile: 95.0, rank: 1, in_portfolio: true, in_top_n: true },
  { symbol: "MSFT", company_name: "Microsoft Corporation", sector: "Technology", momentum_score: 0.75, quality_score: 1.5, volatility_score: 1.0, value_score: -0.67, factor_score: 0.65, percentile: 90.0, rank: 2, in_portfolio: true, in_top_n: true },
  { symbol: "AAPL", company_name: "Apple Inc.", sector: "Technology", momentum_score: 0.58, quality_score: 1.58, volatility_score: 1.17, value_score: -0.83, factor_score: 0.62, percentile: 85.0, rank: 3, in_portfolio: true, in_top_n: true },
  { symbol: "AMZN", company_name: "Amazon.com, Inc.", sector: "Consumer Cyclical", momentum_score: 1.0, quality_score: 0.83, volatility_score: 0.67, value_score: -0.42, factor_score: 0.52, percentile: 80.0, rank: 4, in_portfolio: true, in_top_n: true },
  { symbol: "GOOGL", company_name: "Alphabet Inc.", sector: "Communication Services", momentum_score: 0.67, quality_score: 1.08, volatility_score: 0.92, value_score: -0.17, factor_score: 0.62, percentile: 75.0, rank: 5, in_portfolio: true, in_top_n: true },
  { symbol: "META", company_name: "Meta Platforms, Inc.", sector: "Communication Services", momentum_score: 1.08, quality_score: 1.0, volatility_score: 0.25, value_score: -0.75, factor_score: 0.4, percentile: 70.0, rank: 6, in_portfolio: true, in_top_n: true },
  { symbol: "AVGO", company_name: "Broadcom Inc.", sector: "Technology", momentum_score: 1.25, quality_score: 1.17, volatility_score: -0.17, value_score: -1.5, factor_score: 0.19, percentile: 65.0, rank: 7, in_portfolio: false, in_top_n: false, exclusion_reason: "Technology already at its cap of 3 — a lower-ranked stock from another sector took the slot" },
  { symbol: "LLY", company_name: "Eli Lilly and Company", sector: "Healthcare", momentum_score: 1.58, quality_score: 1.33, volatility_score: -0.42, value_score: -2.08, factor_score: 0.1, percentile: 60.0, rank: 8, in_portfolio: false, in_top_n: true },
  { symbol: "TSLA", company_name: "Tesla, Inc.", sector: "Consumer Cyclical", momentum_score: 0.17, quality_score: 0.33, volatility_score: 0.0, value_score: -1.25, factor_score: -0.19, percentile: 55.0, rank: 9, in_portfolio: true, in_top_n: true },
  { symbol: "COST", company_name: "Costco Wholesale Corporation", sector: "Consumer Defensive", momentum_score: 0.5, quality_score: 1.25, volatility_score: 1.33, value_score: -1.83, factor_score: 0.31, percentile: 50.0, rank: 10, in_portfolio: false, in_top_n: true },
  { symbol: "NFLX", company_name: "Netflix, Inc.", sector: "Communication Services", momentum_score: 0.83, quality_score: 0.75, volatility_score: 0.17, value_score: -1.42, factor_score: 0.08, percentile: 45.0, rank: 11, in_portfolio: false, in_top_n: true },
  { symbol: "ADBE", company_name: "Adobe Inc.", sector: "Technology", momentum_score: -0.17, quality_score: 1.0, volatility_score: 0.83, value_score: -1.0, factor_score: 0.16, percentile: 40.0, rank: 12, in_portfolio: false, in_top_n: false, exclusion_reason: "Technology already at its cap of 3 — a lower-ranked stock from another sector took the slot" },
  { symbol: "CRM", company_name: "Salesforce, Inc.", sector: "Technology", momentum_score: 0.0, quality_score: 0.92, volatility_score: 0.75, value_score: -0.83, factor_score: 0.21, percentile: 35.0, rank: 13, in_portfolio: false, in_top_n: false, exclusion_reason: "Technology already at its cap of 3 — a lower-ranked stock from another sector took the slot" },
  { symbol: "AMD", company_name: "Advanced Micro Devices, Inc.", sector: "Technology", momentum_score: 0.42, quality_score: 0.17, volatility_score: -0.33, value_score: -1.67, factor_score: -0.35, percentile: 30.0, rank: 14, in_portfolio: false, in_top_n: false, exclusion_reason: "Technology already at its cap of 3 — a lower-ranked stock from another sector took the slot" },
  { symbol: "INTC", company_name: "Intel Corporation", sector: "Technology", momentum_score: -1.25, quality_score: -0.42, volatility_score: 0.42, value_score: -0.08, factor_score: -0.33, percentile: 25.0, rank: 15, in_portfolio: false, in_top_n: false, exclusion_reason: "Technology already at its cap of 3 — a lower-ranked stock from another sector took the slot" },
  { symbol: "QCOM", company_name: "QUALCOMM Incorporated", sector: "Technology", momentum_score: 0.25, quality_score: 0.67, volatility_score: 0.33, value_score: -0.58, factor_score: 0.17, percentile: 20.0, rank: 16, in_portfolio: false, in_top_n: false, exclusion_reason: "Technology already at its cap of 3 — a lower-ranked stock from another sector took the slot" },
  { symbol: "TXN", company_name: "Texas Instruments Incorporated", sector: "Technology", momentum_score: -0.42, quality_score: 0.83, volatility_score: 1.08, value_score: -1.08, factor_score: 0.1, percentile: 15.0, rank: 17, in_portfolio: false, in_top_n: false, exclusion_reason: "Technology already at its cap of 3 — a lower-ranked stock from another sector took the slot" },
  { symbol: "AMAT", company_name: "Applied Materials, Inc.", sector: "Technology", momentum_score: 0.08, quality_score: 0.5, volatility_score: 0.08, value_score: -0.92, factor_score: -0.07, percentile: 10.0, rank: 18, in_portfolio: false, in_top_n: false, exclusion_reason: "Technology already at its cap of 3 — a lower-ranked stock from another sector took the slot" },
  { symbol: "MU", company_name: "Micron Technology, Inc.", sector: "Technology", momentum_score: 0.5, quality_score: -0.5, volatility_score: -0.83, value_score: -1.5, factor_score: -0.58, percentile: 5.0, rank: 19, in_portfolio: false, in_top_n: false, exclusion_reason: "Technology already at its cap of 3 — a lower-ranked stock from another sector took the slot" },
  { symbol: "LRCX", company_name: "Lam Research Corporation", sector: "Technology", momentum_score: -0.08, quality_score: 0.58, volatility_score: 0.17, value_score: -1.17, factor_score: -0.12, percentile: 0.0, rank: 20, in_portfolio: false, in_top_n: false, exclusion_reason: "Technology already at its cap of 3 — a lower-ranked stock from another sector took the slot" },
];

// Helper to construct performance dates (last 30 days)
const getPerformanceDates = (): string[] => {
  const dates = [];
  const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  for (let i = 0; i <= 30; i++) {
    const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    // skip weekends for realistic stock chart
    const day = d.getDay();
    if (day !== 0 && day !== 6) {
      dates.push(d.toISOString().slice(0, 10));
    }
  }
  return dates;
};

import { supabase } from "./supabaseClient";

let getAuthToken: (() => Promise<string | null>) | null = supabase
  ? async () => {
      try {
        const { data } = await supabase!.auth.getSession();
        return data.session?.access_token || null;
      } catch {
        return null;
      }
    }
  : null;

export const setTokenProvider = (fn: () => Promise<string | null>) => {
  getAuthToken = fn;
};

async function apiFetch<T>(path: string, init?: RequestInit, isRetry = false): Promise<T> {
  const headers = new Headers(init?.headers);
  let token: string | null = null;

  if (getAuthToken) {
    token = await getAuthToken();
  }
  if (!token && supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token || null;
    } catch {
      // ignore session fetch error
    }
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(path, {
    ...init,
    headers,
  });

  // Handle 401 Unauthorized due to expired token after returning to tab
  if (res.status === 401 && !isRetry && supabase) {
    try {
      const { data: refreshData } = await supabase.auth.refreshSession();
      if (refreshData?.session?.access_token) {
        // Token refreshed successfully — retry the API request once with new token
        return apiFetch<T>(path, init, true);
      }
    } catch {
      // Refresh failed — proceed to throw error
    }
  }

  if (!res.ok) {
    let detail = `API ${path} returned ${res.status}`;
    try {
      const body = await res.json();
      if (body && typeof body.detail === "string") {
        detail = body.detail;
      }
    } catch {
      // non-JSON error body — keep the generic message
    }
    throw new Error(detail);
  }
  return res.json();
}


export const api = {
  status: () => {
    if (isDemo()) {
      return Promise.resolve<StatusResponse>({
        scheduler_running: true,
        last_started_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
        next_fire_at: new Date(Date.now() + 19 * 3600 * 1000).toISOString(),
        etf_symbol: "SPUS",
        top_n: 15,
        broker_url: "https://paper-api.alpaca.markets",
      });
    }
    return apiFetch<StatusResponse>("/api/status");
  },
  account: () => {
    if (isDemo()) {
      return Promise.resolve<AccountResponse>({
        equity: 130507.75,
        cash: 4550.25,
        buying_power: 9100.50,
        portfolio_value: 130507.75,
        dayl_pl: 1245.50,
        dayl_pl_pct: 0.0096,
      });
    }
    return apiFetch<AccountResponse>("/api/account");
  },
  portfolio: () => {
    if (isDemo()) {
      return Promise.resolve<PositionResponse[]>([
        { symbol: "NVDA", qty: 150, current_price: 125.50, avg_entry_price: 118.20, market_value: 18825.00, unrealized_pl: 1095.00, unrealized_pl_pct: 0.0618 },
        { symbol: "MSFT", qty: 45, current_price: 420.10, avg_entry_price: 410.50, market_value: 18904.50, unrealized_pl: 432.00, unrealized_pl_pct: 0.0234 },
        { symbol: "AAPL", qty: 90, current_price: 210.30, avg_entry_price: 198.80, market_value: 18927.00, unrealized_pl: 1035.00, unrealized_pl_pct: 0.0579 },
        { symbol: "AMZN", qty: 100, current_price: 185.40, avg_entry_price: 180.20, market_value: 18540.00, unrealized_pl: 520.00, unrealized_pl_pct: 0.0289 },
        { symbol: "GOOGL", qty: 110, current_price: 175.20, avg_entry_price: 168.50, market_value: 19272.00, unrealized_pl: 737.00, unrealized_pl_pct: 0.0398 },
        { symbol: "META", qty: 40, current_price: 490.50, avg_entry_price: 482.00, market_value: 19620.00, unrealized_pl: 340.00, unrealized_pl_pct: 0.0176 },
        { symbol: "TSLA", qty: 55, current_price: 215.80, avg_entry_price: 220.40, market_value: 11869.00, unrealized_pl: -253.00, unrealized_pl_pct: -0.0209 },
      ]);
    }
    return apiFetch<PositionResponse[]>("/api/portfolio");
  },
  universe: () => {
    if (isDemo()) {
      return Promise.resolve<UniverseResponse>({
        computing: isMockComputing,
        last_computed_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
        stocks: MOCK_STOCKS,
      });
    }
    return apiFetch<UniverseResponse>("/api/universe");
  },
  publicUniverse: () => {
    return apiFetch<{
      computing: boolean;
      is_live: boolean;
      last_computed_at: string | null;
      stocks: Array<{
        ticker: string;
        name: string;
        status: string;
        change?: string;
        price?: string;
        compliant: boolean;
        reason?: string;
        spark?: number[];
      }>;
    }>("/api/public/universe");
  },
  refreshUniverse: () => {
    if (isDemo()) {
      isMockComputing = true;
      setTimeout(() => {
        isMockComputing = false;
      }, 3000);
      return Promise.resolve({ status: "ok" });
    }
    return apiFetch<{ status: string }>("/api/universe/refresh", { method: "POST" });
  },
  activity: (type?: string, date?: string) => {
    if (isDemo()) {
      const allEntries: ActivityEntry[] = [
        { timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), level: "INFO", type: "order", message: "BUY NVDA — 5 shares @ $125.5", tickers: ["NVDA"], symbol: "NVDA", side: "BUY", qty: 5, price: 125.5, notional: 627.5 },
        { timestamp: new Date(Date.now() - 5 * 3600 * 1000).toISOString(), level: "INFO", type: "order", message: "SELL AAPL — 12 shares @ $210.3", tickers: ["AAPL"], symbol: "AAPL", side: "SELL", qty: 12, price: 210.3, notional: 2523.6 },
        { timestamp: new Date(Date.now() - 74 * 3600 * 1000).toISOString(), level: "INFO", type: "order", message: "BUY MSFT — 8 shares @ $420.1", tickers: ["MSFT"], symbol: "MSFT", side: "BUY", qty: 8, price: 420.1, notional: 3360.8 },
        { timestamp: new Date(Date.now() - 75 * 3600 * 1000).toISOString(), level: "INFO", type: "order", message: "BUY GOOGL — 15 shares @ $175.2", tickers: ["GOOGL"], symbol: "GOOGL", side: "BUY", qty: 15, price: 175.2, notional: 2628.0 },
        { timestamp: new Date(Date.now() - 98 * 3600 * 1000).toISOString(), level: "INFO", type: "order", message: "SELL META — 4 shares @ $490.5", tickers: ["META"], symbol: "META", side: "SELL", qty: 4, price: 490.5, notional: 1962.0 },
        { timestamp: new Date(Date.now() - 122 * 3600 * 1000).toISOString(), level: "INFO", type: "order", message: "BUY AMZN — 22 shares @ $185.4", tickers: ["AMZN"], symbol: "AMZN", side: "BUY", qty: 22, price: 185.4, notional: 4078.8 },
        { timestamp: new Date(Date.now() - 123 * 3600 * 1000).toISOString(), level: "INFO", type: "order", message: "BUY TSLA — 9 shares @ $215.8", tickers: ["TSLA"], symbol: "TSLA", side: "BUY", qty: 9, price: 215.8, notional: 1942.2 },
        { timestamp: new Date(Date.now() - 170 * 3600 * 1000).toISOString(), level: "INFO", type: "order", message: "BUY NVDA — 30 shares @ $118.2", tickers: ["NVDA"], symbol: "NVDA", side: "BUY", qty: 30, price: 118.2, notional: 3546.0 },
      ];
      const filtered = allEntries.filter(e => {
        if (type && e.type !== type) return false;
        if (date && !e.timestamp.startsWith(date)) return false;
        return true;
      });
      return Promise.resolve<ActivityResponse>({ entries: filtered });
    }
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (date) params.set("date", date);
    const qs = params.toString();
    return apiFetch<ActivityResponse>(`/api/activity${qs ? `?${qs}` : ""}`);
  },
  performance: () => {
    if (isDemo()) {
      const dates = getPerformanceDates();
      const portfolio_cumulative = [];
      const benchmark_cumulative = [];
      const sp500_cumulative = [];
      let pSum = 0;
      let bSum = 0;
      let sSum = 0;
      for (let i = 0; i < dates.length; i++) {
        const dayFactor = i / dates.length;
        pSum = dayFactor * 8.4 + (Math.sin(i * 0.7) * 0.8) + (Math.cos(i * 1.3) * 0.4);
        bSum = dayFactor * 7.1 + (Math.sin(i * 0.6) * 1.1) + (Math.cos(i * 1.1) * 0.3);
        sSum = dayFactor * 6.2 + (Math.sin(i * 0.5) * 1.3) + (Math.cos(i * 0.9) * 0.2);
        portfolio_cumulative.push(pSum / 100);
        benchmark_cumulative.push(bSum / 100);
        sp500_cumulative.push(sSum / 100);
      }
      return Promise.resolve<PerformanceResponse>({
        dates,
        portfolio_cumulative,
        benchmark_cumulative,
        sp500_cumulative,
      });
    }
    return apiFetch<PerformanceResponse>("/api/performance");
  },
  compare: () => {
    if (isDemo()) {
      const dates = getPerformanceDates();
      const shariah_equity = [];
      const daytrader_equity = [];
      for (let i = 0; i < dates.length; i++) {
        const factor = i / dates.length;
        shariah_equity.push(120000 + factor * 10507.75 + Math.sin(i * 0.8) * 1500);
        daytrader_equity.push(95000 + factor * 4500 + Math.sin(i * 1.2) * 2500);
      }
      return Promise.resolve<CompareResponse>({
        dates,
        shariah_equity,
        daytrader_equity,
        shariah: {
          name: "Shariah Algo",
          total_return_pct: 8.75,
          sharpe_ratio: 2.15,
          max_drawdown_pct: 3.42,
          current_equity: 130507.75,
          win_rate_pct: 68.2,
        },
        daytrader: {
          name: "Day Trader",
          total_return_pct: 4.73,
          sharpe_ratio: 1.25,
          max_drawdown_pct: 8.95,
          current_equity: 99500.00,
          win_rate_pct: 54.5,
        },
        daytrader_available: true,
      });
    }
    return apiFetch<CompareResponse>("/api/compare");
  },
  compliance: () => {
    if (isDemo()) {
      return Promise.resolve<ComplianceResponse>({
        compliant: true,
        violations: [],
        held_count: 7,
        universe_size: 150,
        last_checked: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      });
    }
    return apiFetch<ComplianceResponse>("/api/compliance");
  },
  dayTrader: () => {
    if (isDemo()) {
      return Promise.resolve<DayTraderResponse>({
        account: {
          equity: 99500.00,
          cash: 12500.00,
          buying_power: 50000.00,
          dayl_pl: 450.00,
          dayl_pl_pct: 0.0045,
          available: true,
        },
        positions: [
          { symbol: "GME", qty: 300, market_value: 8400.00, avg_entry_price: 27.50, unrealized_pl: 150.00, unrealized_pl_pct: 0.0182, current_price: 28.00, side: "LONG" },
          { symbol: "AMC", qty: 1000, market_value: 5200.00, avg_entry_price: 5.40, unrealized_pl: -200.00, unrealized_pl_pct: -0.0370, current_price: 5.20, side: "LONG" },
        ],
        trades_today: [
          { timestamp: "10:14:22", symbol: "GME", side: "BUY", qty: 300, price: 27.50, notional: 8250.00 },
          { timestamp: "09:35:10", symbol: "AMC", side: "BUY", qty: 1000, price: 5.40, notional: 5400.00 },
          { timestamp: "09:42:01", symbol: "NVDA", side: "SELL", qty: 50, price: 126.00, notional: 6300.00 },
        ],
        max_positions: 5,
        gap_threshold_pct: 4.0,
        rvol_threshold: 2.0,
        stop_loss_pct: 2.0,
        min_price: 5.0,
        min_adv: 5000000,
        watchlist_size: 18,
      });
    }
    return apiFetch<DayTraderResponse>("/api/day-trader");
  },
  authStatus: () => {
    if (isDemo()) {
      return Promise.resolve<AuthStatus>({
        auth_enabled: true,
        password_auth_enabled: true,
        google_auth_enabled: false,
        clerk_enabled: false,
        authenticated: true,
      });
    }
    return apiFetch<AuthStatus>("/api/auth/status");
  },
  login: (password: string) => {
    return apiFetch<{ status: string }>("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
  },
  logout: async () => {
    if (isDemo()) {
      localStorage.removeItem("shariah_demo_mode");
      return { status: "ok" };
    }
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore signout error if session already invalid
      }
    }
    return apiFetch<{ status: string }>("/api/auth/logout", { method: "POST" });
  },
  getSettings: () => {
    if (isDemo()) {
      return Promise.resolve<SettingsResponse>(demoSettings);
    }
    return apiFetch<SettingsResponse>("/api/settings");
  },
  updateSettings: (settings: SettingsUpdateRequest) => {
    if (isDemo()) {
      demoSettings = {
        ...demoSettings,
        ...settings,
      } as SettingsResponse;
      return Promise.resolve({ status: "ok" });
    }
    return apiFetch<{ status: string }>("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
  },
  claimInvite: (code: string, linkedinUrl?: string, notes?: string) => {
    if (isDemo()) {
      return Promise.resolve<{ status: string; state: string }>({ status: "success", state: "pending" });
    }
    return apiFetch<{ status: string; state: string }>("/api/settings/claim-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, linkedin_url: linkedinUrl, notes }),
    });
  },
  validateInvite: (code: string) => {
    if (isDemo()) {
      return Promise.resolve<{ valid: boolean; code: string; expires_at?: string; max_uses?: number; uses?: number; reason?: string }>({
        valid: true,
        code,
        expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        max_uses: 1,
        uses: 0,
      });
    }
    return apiFetch<{ valid: boolean; code: string; expires_at?: string; max_uses?: number; uses?: number; reason?: string }>(
      `/api/auth/validate-invite?code=${encodeURIComponent(code)}`
    );
  },

  verifyPassword: (password: string) => {
    if (isDemo()) {
      return Promise.resolve({ status: "ok" });
    }
    return apiFetch<{ status: string }>("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
  },
  notifications: () => {
    if (isDemo()) {
      return Promise.resolve<NotificationsResponse>({
        items: demoNotifications,
        unread_count: demoNotifications.filter(n => !n.read).length,
      });
    }
    return apiFetch<NotificationsResponse>("/api/notifications");
  },
  markAllRead: () => {
    if (isDemo()) {
      demoNotifications = demoNotifications.map(n => ({ ...n, read: true }));
      return Promise.resolve({ status: "ok" });
    }
    return apiFetch<{ status: string }>("/api/notifications/read-all", { method: "PATCH" });
  },
  markRead: (id: string) => {
    if (isDemo()) {
      demoNotifications = demoNotifications.map(n => n.id === id ? { ...n, read: true } : n);
      return Promise.resolve({ status: "ok" });
    }
    return apiFetch<{ status: string }>(`/api/notifications/${id}/read`, { method: "PATCH" });
  },
  switchTradingMode: (mode: "paper" | "live", riskAcknowledged?: boolean) => {
    if (isDemo()) {
      demoSettings = {
        ...demoSettings,
        trading_mode: mode,
        alpaca_base_url: mode === "live" ? "https://api.alpaca.markets" : "https://paper-api.alpaca.markets",
      };
      return Promise.resolve({ status: "ok", trading_mode: mode });
    }
    return apiFetch<{ status: string; trading_mode: string; alpaca_base_url: string }>("/api/settings/mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(riskAcknowledged ? { mode, riskAcknowledged } : { mode }),
    });
  },
  runSanityCheck: () => {
    if (isDemo()) {
      return Promise.resolve<SanityCheckResponse>({
        user_id: "demo_user",
        status: "REALISTIC",
        is_realistic: true,
        trading_mode: "paper",
        latest_date: new Date().toISOString().split("T")[0],
        strategy_cumulative_return: 0.0495,
        spus_cumulative_return: -0.0321,
        sp500_cumulative_return: 0.012,
        total_alpha: 0.0816,
        latest_strategy_daily_return: 0.0408,
        latest_spus_daily_return: 0.001,
        latest_sp500_daily_return: 0.002,
        daily_alpha_drift: 0.0398,
        anomalies: [],
        checked_at: new Date().toISOString(),
      });
    }
    return apiFetch<SanityCheckResponse>("/api/sanity-check", { method: "POST" });
  },
  getSanityStatus: () => {
    if (isDemo()) {
      return Promise.resolve({
        has_run: true,
        last_check: new Date().toISOString(),
        details: "Mode: paper | Strategy Cum: +4.95% | SPUS Cum: -3.21% | Alpha: +8.16 pts",
      });
    }
    return apiFetch<{ has_run: boolean; last_check: string | null; details?: string }>("/api/sanity-check/status");
  },
  runManualRebalance: () => {
    if (isDemo()) {
      return Promise.resolve({
        user_id: "demo_user",
        rebalance_submitted: true,
        status: "completed",
        accounts_processed: 1,
        results: [{ trading_mode: "paper", target_stocks: ["AAPL", "MSFT", "PG", "JNJ", "NVDA"] }],
        executed_at: new Date().toISOString(),
        message: "Demo rebalance submitted.",
      });
    }
    return apiFetch<{
      user_id: string;
      rebalance_submitted: boolean;
      status: string;
      accounts_processed: number;
      results: Array<{ trading_mode: string; target_stocks: string[]; diff_summary?: any }>;
      executed_at: string;
      message: string;
    }>("/api/rebalance/run", { method: "POST" });
  },
  getRebalanceStatus: () => {
    if (isDemo()) {
      return Promise.resolve({
        status: "completed",
        message: "Demo rebalance complete.",
        results: [{ trading_mode: "paper", target_stocks: ["AAPL", "MSFT", "PG", "JNJ", "NVDA"] }],
        elapsed_seconds: 1.2,
        step_key: "done",
        step_number: 7,
        error: undefined,
      });
    }
    return apiFetch<{
      status: string;
      rebalance_submitted?: boolean;
      accounts_processed?: number;
      results?: Array<{ trading_mode: string; target_stocks: string[]; diff_summary?: any }>;
      executed_at?: string;
      completed_at?: string;
      elapsed_seconds?: number;
      step_key?: string;
      step_number?: number;
      error?: string;
      message?: string;
    }>("/api/rebalance/status");
  },
};

