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
  company_name?: string;
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

export interface AuthStatus {
  auth_enabled: boolean;
  password_auth_enabled: boolean;
  google_auth_enabled: boolean;
  authenticated: boolean;
}

export interface SettingsResponse {
  alpaca_api_key: string;
  alpaca_api_secret_masked: string;
  alpaca_base_url: string;
  etf_symbol: string;
  top_n: number;
  etf_symbols: string[];
  sector_cap: number;
  drift_threshold: number;
  dashboard_password_masked: string;
  google_client_id: string | null;
  google_client_secret_masked: string | null;
  google_redirect_uri: string | null;
  allowed_google_emails: string[];
}

export interface SettingsUpdateRequest {
  alpaca_api_key?: string;
  alpaca_api_secret?: string;
  alpaca_base_url?: string;
  etf_symbol?: string;
  top_n?: number;
  etf_symbols?: string[];
  sector_cap?: number;
  drift_threshold?: number;
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



// Helper to detect demo mode
const isDemo = () => localStorage.getItem("shariah_demo_mode") === "true";

// Simulated in-memory states for Demo mode
let isMockComputing = false;
let demoSettings: SettingsResponse = {
  alpaca_api_key: "AKDEMO1234567890",
  alpaca_api_secret_masked: "************DEMO",
  alpaca_base_url: "https://paper-api.alpaca.markets",
  etf_symbol: "SPUS",
  top_n: 15,
  etf_symbols: ["SPUS", "HLAL", "SPSK"],
  sector_cap: 0.25,
  drift_threshold: 0.05,
  dashboard_password_masked: "********",
  google_client_id: null,
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
  { symbol: "NVDA", company_name: "NVIDIA Corporation", momentum_score: 88, quality_score: 91, volatility_score: 74, value_score: 58, factor_score: 83.2, rank: 1, in_portfolio: true, in_top_n: true },
  { symbol: "MSFT", company_name: "Microsoft Corporation", momentum_score: 79, quality_score: 88, volatility_score: 82, value_score: 62, factor_score: 80.5, rank: 2, in_portfolio: true, in_top_n: true },
  { symbol: "AAPL", company_name: "Apple Inc.", momentum_score: 77, quality_score: 89, volatility_score: 84, value_score: 60, factor_score: 79.8, rank: 3, in_portfolio: true, in_top_n: true },
  { symbol: "AMZN", company_name: "Amazon.com, Inc.", momentum_score: 82, quality_score: 80, volatility_score: 78, value_score: 65, factor_score: 78.4, rank: 4, in_portfolio: true, in_top_n: true },
  { symbol: "GOOGL", company_name: "Alphabet Inc.", momentum_score: 78, quality_score: 83, volatility_score: 81, value_score: 68, factor_score: 77.9, rank: 5, in_portfolio: true, in_top_n: true },
  { symbol: "META", company_name: "Meta Platforms, Inc.", momentum_score: 83, quality_score: 82, volatility_score: 73, value_score: 61, factor_score: 76.8, rank: 6, in_portfolio: true, in_top_n: true },
  { symbol: "AVGO", company_name: "Broadcom Inc.", momentum_score: 85, quality_score: 84, volatility_score: 68, value_score: 52, factor_score: 75.1, rank: 7, in_portfolio: false, in_top_n: true },
  { symbol: "LLY", company_name: "Eli Lilly and Company", momentum_score: 89, quality_score: 86, volatility_score: 65, value_score: 45, factor_score: 74.8, rank: 8, in_portfolio: false, in_top_n: true },
  { symbol: "TSLA", company_name: "Tesla, Inc.", momentum_score: 72, quality_score: 74, volatility_score: 70, value_score: 55, factor_score: 73.2, rank: 9, in_portfolio: true, in_top_n: true },
  { symbol: "COST", company_name: "Costco Wholesale Corporation", momentum_score: 76, quality_score: 85, volatility_score: 86, value_score: 48, factor_score: 72.5, rank: 10, in_portfolio: false, in_top_n: true },
  { symbol: "NFLX", company_name: "Netflix, Inc.", momentum_score: 80, quality_score: 79, volatility_score: 72, value_score: 53, factor_score: 71.9, rank: 11, in_portfolio: false, in_top_n: true },
  { symbol: "ADBE", company_name: "Adobe Inc.", momentum_score: 68, quality_score: 82, volatility_score: 80, value_score: 58, factor_score: 70.4, rank: 12, in_portfolio: false, in_top_n: true },
  { symbol: "CRM", company_name: "Salesforce, Inc.", momentum_score: 70, quality_score: 81, volatility_score: 79, value_score: 60, factor_score: 69.8, rank: 13, in_portfolio: false, in_top_n: true },
  { symbol: "AMD", company_name: "Advanced Micro Devices, Inc.", momentum_score: 75, quality_score: 72, volatility_score: 66, value_score: 50, factor_score: 68.5, rank: 14, in_portfolio: false, in_top_n: true },
  { symbol: "INTC", company_name: "Intel Corporation", momentum_score: 55, quality_score: 65, volatility_score: 75, value_score: 69, factor_score: 67.2, rank: 15, in_portfolio: false, in_top_n: true },
  { symbol: "QCOM", company_name: "QUALCOMM Incorporated", momentum_score: 73, quality_score: 78, volatility_score: 74, value_score: 63, factor_score: 66.1, rank: 16, in_portfolio: false, in_top_n: false },
  { symbol: "TXN", company_name: "Texas Instruments Incorporated", momentum_score: 65, quality_score: 80, volatility_score: 83, value_score: 57, factor_score: 65.4, rank: 17, in_portfolio: false, in_top_n: false },
  { symbol: "AMAT", company_name: "Applied Materials, Inc.", momentum_score: 71, quality_score: 76, volatility_score: 71, value_score: 59, factor_score: 64.9, rank: 18, in_portfolio: false, in_top_n: false },
  { symbol: "MU", company_name: "Micron Technology, Inc.", momentum_score: 76, quality_score: 64, volatility_score: 60, value_score: 52, factor_score: 63.8, rank: 19, in_portfolio: false, in_top_n: false },
  { symbol: "LRCX", company_name: "Lam Research Corporation", momentum_score: 69, quality_score: 77, volatility_score: 72, value_score: 56, factor_score: 62.5, rank: 20, in_portfolio: false, in_top_n: false }
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

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) throw new Error(`API ${path} returned ${res.status}`);
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
        { timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), level: "INFO", type: "ORDER", message: "Order BUY NVDA executed: 5 shares at $125.50", tickers: ["NVDA"] },
        { timestamp: new Date(Date.now() - 3 * 3600 * 1000).toISOString(), level: "INFO", type: "REBALANCE", message: "Rebalance check complete. Portfolio aligned with Top 15 scoring universe.", tickers: [] },
        { timestamp: new Date(Date.now() - 3.5 * 3600 * 1000).toISOString(), level: "INFO", type: "COMPLIANCE", message: "Compliance check passed. 7/7 held positions are Shariah-compliant according to AAOIFI guidelines.", tickers: ["MSFT", "AAPL", "NVDA", "AMZN", "GOOGL", "META", "TSLA"] },
        { timestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString(), level: "INFO", type: "SCHEDULER", message: "Daily scheduler triggered for SPUS universe.", tickers: [] },
        { timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString(), level: "INFO", type: "SCHEDULER", message: "Market closed. Portfolio value: $129,262.25.", tickers: [] },
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
  logout: () => {
    if (isDemo()) {
      localStorage.removeItem("shariah_demo_mode");
      return Promise.resolve({ status: "ok" });
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
};

