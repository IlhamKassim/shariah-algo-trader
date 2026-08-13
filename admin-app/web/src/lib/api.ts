/**
 * Typed client for the admin API (SPEC-BETA-PILOT.md §5.2, A1-A7).
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
  ip_address: string;
  details: string;
  created_at: string;
}

export interface ActivityResponse {
  user_id: string;
  events: ActivityEvent[];
  count: number;
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

  async listInvites(): Promise<InviteList> {
    return this.request<InviteList>("/invites");
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
