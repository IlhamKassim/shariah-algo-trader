/**
 * Typed client for the admin API (SPEC-BETA-PILOT.md §5.2 & SPEC-BRUTALISM-ADMIN.md).
 *
 * The backend requires BOTH verify_auth (401) and is_admin (403) on every
 * /api/admin/* route; the token is supplied as a bearer token by the caller
 * (the Supabase session access token). All endpoints return JSON; errors are
 * surfaced as {@link ApiError} with the HTTP status and the server's
 * ``detail`` string.
 */

export type TesterState = "pending" | "active" | "revoked";

export interface Tester {
  user_id: string;
  email: string;
  role: string;
  state: TesterState;
  invite_code: string | null;
  linkedin_url: string | null;
  notes: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
  first_name?: string | null;
  last_name?: string | null;
  quant_handle?: string | null;
  country?: string | null;
  investor_type?: string | null;
  paper_capital?: number | null;
  onboarding_completed_at?: string | null;
  trading_mode: string;
  shariah_trader_enabled: number;
  has_paper_keys: boolean;
  has_live_keys: boolean;
  last_activity_at: string | null;
}


export interface TesterList {
  testers: Tester[];
  count: number;
}

export interface ActionResponse {
  user_id: string;
  state: TesterState | string;
  already_active?: boolean;
}

export interface Invite {
  code: string;
  created_by: string;
  max_uses: number;
  uses: number;
  expires_at: string;
  created_at: string;
  expired: boolean;
}

export interface InviteList {
  invites: Invite[];
  count: number;
}

export interface CreateInviteBody {
  max_uses?: number;
  expires_at?: string | null;
  code?: string | null;
}

export interface Position {
  symbol: string;
  qty: string;
  market_value: string;
  unrealized_pl: string;
  current_price?: string;
  cost_basis?: string;
  [key: string]: unknown;
}

export interface PortfolioResponse {
  user_id: string;
  paper_base_url: string;
  account: Record<string, unknown>;
  positions: Position[];
  unrealized_pl: number;
}

export interface ComplianceResponse {
  compliant: boolean;
  violations: string[];
  held_count: number;
  universe_size: number;
  last_checked: string | null;
  user_id: string;
  paper_base_url: string;
}

export interface ActivityEvent {
  id: string;
  event_type: string;
  actor: string;
  actor_cust_id?: string | null;
  ip_address: string;
  details: string;
  created_at: string;
}

export interface ActivityResponse {
  user_id: string;
  events: ActivityEvent[];
  count: number;
}

export interface TradingPrefs {
  etf_symbol: string;
  top_n: number;
  sector_cap: number;
  drift_threshold: number;
}

export interface CustomerProfilePortfolio {
  status: "ok" | "no_keys" | "unreachable";
  equity?: string;
  cash?: string;
  buying_power?: string;
  position_count?: number;
  unrealized_pl?: number;
  positions?: Position[];
  paper_base_url?: string;
}

export interface CustomerProfileCompliance {
  status: "ok" | "no_keys" | "unreachable";
  compliant?: boolean;
  violations?: string[];
  held_count?: number;
  universe_size?: number;
  last_checked?: string | null;
}

export interface CustomerProfile {
  user_id: string;
  cust_id: string;
  email: string;
  role: string;
  state: TesterState;
  invite_code: string | null;
  linkedin_url: string | null;
  notes: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
  first_name?: string | null;
  last_name?: string | null;
  quant_handle?: string | null;
  country?: string | null;
  investor_type?: string | null;
  paper_capital?: number | null;
  onboarding_completed_at?: string | null;
  trading_mode: string;
  shariah_trader_enabled: number;
  has_paper_keys: boolean;
  has_live_keys: boolean;
  prefs: TradingPrefs;
  portfolio: CustomerProfilePortfolio;
  compliance: CustomerProfileCompliance;
  last_activity_at: string | null;
}


export interface RiskKpis {
  total_customers: number;
  active_traders: number;
  portfolio_value_usd: number;
  accounts_evaluated: number;
  accounts_unreachable: number;
  compliance_pct: number | null;
  compliance_status: "OPTIMAL" | "WATCH" | "CRITICAL" | "N/A";
}

export interface RiskDistribution {
  low: number;
  med: number;
  high: number;
}

export interface LiveAlert {
  created_at: string;
  severity: "critical" | "warning" | "info";
  code: string;
  user_id: string;
  message: string;
}

export interface FlaggedAccount {
  user_id: string;
  cust_id: string;
  risk_level: "LOW" | "MED" | "HIGH";
  last_activity_at: string | null;
  exposure_usd: number;
  state: TesterState;
  reasons: string[];
}

export interface AnalyticsRiskResponse {
  generated_at: string;
  cache_ttl_seconds: number;
  kpis: RiskKpis;
  risk_distribution: RiskDistribution;
  alerts: LiveAlert[];
  flagged: FlaggedAccount[];
}

export interface AuditQueryParams {
  limit?: number;
  offset?: number;
  event_type?: string;
  q?: string;
  since?: string;
}

export interface AuditLogsResponse {
  events: ActivityEvent[];
  total: number;
  limit: number;
  offset: number;
  event_types: string[];
}

/** Engine status (spectate S1 → GET /api/status on :8000). */
export interface SpectateStatusResponse {
  scheduler_running: boolean;
  last_started_at: string | null;
  next_fire_at: string | null;
  etf_symbol: string;
  top_n: number;
  broker_url: string;
  trading_mode?: string;
  is_live?: boolean;
}

/** Founder account (spectate S2 → GET /api/account on :8000). */
export interface SpectateAccountResponse {
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

/** Founder position (spectate S3 → GET /api/portfolio on :8000). */
export interface SpectatePosition {
  symbol: string;
  qty: number;
  market_value: number;
  avg_entry_price: number;
  unrealized_pl: number;
  unrealized_pl_pct: number;
  current_price: number;
}

/** Universe row (spectate S4 → GET /api/universe on :8000). */
export interface SpectateStockScore {
  symbol: string;
  company_name?: string | null;
  momentum_score: number;
  quality_score: number;
  volatility_score: number;
  value_score: number;
  factor_score: number;
  rank: number;
  in_portfolio: boolean;
  in_top_n: boolean;
}

export interface SpectateUniverseResponse {
  computing: boolean;
  last_computed_at: string | null;
  stocks: SpectateStockScore[];
}

/** Founder compliance (spectate S5 → GET /api/compliance on :8000). */
export interface SpectateComplianceResponse {
  compliant: boolean;
  violations: string[];
  held_count: number;
  universe_size: number;
  last_checked: string | null;
}

export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export class AdminApi {
  private readonly getToken: () => string | null;
  private readonly base: string;

  constructor(getToken: () => string | null, base = "/api/admin") {
    this.getToken = getToken;
    this.base = base;
  }

  async listTesters(): Promise<TesterList> {
    return this.request<TesterList>("/testers");
  }

  async approveTester(userId: string): Promise<ActionResponse> {
    return this.request<ActionResponse>(`/testers/${encodeURIComponent(userId)}/approve`, {
      method: "POST",
    });
  }

  async revokeTester(userId: string): Promise<ActionResponse> {
    return this.request<ActionResponse>(`/testers/${encodeURIComponent(userId)}/revoke`, {
      method: "POST",
    });
  }

  async deleteTester(userId: string): Promise<{ user_id: string; deleted: boolean }> {
    return this.request<{ user_id: string; deleted: boolean }>(`/testers/${encodeURIComponent(userId)}`, {
      method: "DELETE",
    });
  }

  async testerPortfolio(userId: string): Promise<PortfolioResponse> {
    return this.request<PortfolioResponse>(`/testers/${encodeURIComponent(userId)}/portfolio`);
  }

  async testerCompliance(userId: string): Promise<ComplianceResponse> {
    return this.request<ComplianceResponse>(`/testers/${encodeURIComponent(userId)}/compliance`);
  }

  async testerActivity(userId: string): Promise<ActivityResponse> {
    return this.request<ActivityResponse>(`/testers/${encodeURIComponent(userId)}/activity`);
  }

  async createInvite(body: CreateInviteBody = {}): Promise<Invite> {
    return this.request<Invite>("/invites", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async deleteInvite(code: string): Promise<{ code: string; deleted: boolean }> {
    return this.request<{ code: string; deleted: boolean }>(`/invites/${encodeURIComponent(code)}`, {
      method: "DELETE",
    });
  }

  async listInvites(): Promise<InviteList> {
    return this.request<InviteList>("/invites");
  }


  async getCustomerProfile(userId: string): Promise<CustomerProfile> {
    return this.request<CustomerProfile>(`/customers/${encodeURIComponent(userId)}/profile`);
  }

  async getAnalyticsRisk(): Promise<AnalyticsRiskResponse> {
    return this.request<AnalyticsRiskResponse>("/analytics/risk");
  }

  async getAuditLogs(params: AuditQueryParams = {}): Promise<AuditLogsResponse> {
    const searchParams = new URLSearchParams();
    if (params.limit !== undefined) searchParams.set("limit", String(params.limit));
    if (params.offset !== undefined) searchParams.set("offset", String(params.offset));
    if (params.event_type) searchParams.set("event_type", params.event_type);
    if (params.q) searchParams.set("q", params.q);
    if (params.since) searchParams.set("since", params.since);

    const query = searchParams.toString();
    return this.request<AuditLogsResponse>(`/audit${query ? `?${query}` : ""}`);
  }

  /** Spectate S1 — global engine status via the admin proxy (SPEC-ADMIN-SPECTATE.md §5). */
  async spectateStatus(): Promise<SpectateStatusResponse> {
    return this.request<SpectateStatusResponse>("/spectate/status");
  }

  /** Spectate S2 — the calling founder's own account (proxy forwards the JWT). */
  async spectateAccount(): Promise<SpectateAccountResponse> {
    return this.request<SpectateAccountResponse>("/spectate/account");
  }

  /** Spectate S3 — the calling founder's own open positions. */
  async spectatePortfolio(): Promise<SpectatePosition[]> {
    return this.request<SpectatePosition[]>("/spectate/portfolio");
  }

  /** Spectate S4 — global cached eligible universe. */
  async spectateUniverse(): Promise<SpectateUniverseResponse> {
    return this.request<SpectateUniverseResponse>("/spectate/universe");
  }

  /** Spectate S5 — the calling founder's own compliance status. */
  async spectateCompliance(): Promise<SpectateComplianceResponse> {
    return this.request<SpectateComplianceResponse>("/spectate/compliance");
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (init.body) headers.set("Content-Type", "application/json");

    const res = await fetch(`${this.base}${path}`, { ...init, headers });
    if (!res.ok) {
      let detail = res.statusText || `Request failed (${res.status})`;
      try {
        const body = (await res.json()) as { detail?: unknown };
        if (typeof body.detail === "string") detail = body.detail;
      } catch {
        // non-JSON error body — keep the statusText fallback
      }
      throw new ApiError(res.status, detail);
    }
    return (await res.json()) as T;
  }
}
