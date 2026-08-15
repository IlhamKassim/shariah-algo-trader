import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminApi, ApiError } from "./api";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("AdminApi", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const TESTER = {
    user_id: "tester-1",
    email: "t1@example.com",
    role: "tester",
    state: "pending",
    invite_code: null,
    linkedin_url: null,
    notes: null,
    approved_by: null,
    created_at: "2026-08-13T00:00:00+00:00",
    updated_at: "2026-08-13T00:00:00+00:00",
    trading_mode: "paper",
    shariah_trader_enabled: 0,
    has_paper_keys: false,
    has_live_keys: false,
    last_activity_at: null,
  };

  it("lists testers against /api/admin/testers with the bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ testers: [TESTER], count: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    const api = new AdminApi(() => "jwt-token");
    const result = await api.listTesters();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/testers",
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.get("Authorization")).toBe("Bearer jwt-token");
    expect(result.count).toBe(1);
    expect(result.testers[0].email).toBe("t1@example.com");
  });

  it("omits the Authorization header when there is no session token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ testers: [], count: 0 }));
    vi.stubGlobal("fetch", fetchMock);

    await new AdminApi(() => null).listTesters();

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.get("Authorization")).toBeNull();
  });

  it("approves a tester via POST with the user id encoded in the path", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ user_id: "t-1", state: "active" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new AdminApi(() => "jwt-token").approveTester("t-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/testers/t-1/approve",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.state).toBe("active");
  });

  it("revokes a tester via POST", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ user_id: "t-1", state: "revoked" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new AdminApi(() => "jwt-token").revokeTester("t-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/testers/t-1/revoke",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.state).toBe("revoked");
  });

  it("fetches the per-tester paper portfolio", async () => {
    const portfolio = {
      user_id: "t-1",
      paper_base_url: "https://paper-api.alpaca.markets",
      account: { equity: "10000.00", cash: "2500.00" },
      positions: [{ symbol: "SPUS", qty: "100", market_value: "4000.00", unrealized_pl: "120.50" }],
      unrealized_pl: 120.5,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(portfolio)));

    const result = await new AdminApi(() => "jwt-token").testerPortfolio("t-1");

    expect(result.unrealized_pl).toBe(120.5);
    expect(result.positions[0].symbol).toBe("SPUS");
  });

  it("fetches compliance", async () => {
    const compliance = {
      compliant: false,
      violations: ["AAPL"],
      held_count: 2,
      universe_size: 2,
      last_checked: "2026-08-13T00:00:00+00:00",
      user_id: "t-1",
      paper_base_url: "https://paper-api.alpaca.markets",
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(compliance)));

    const result = await new AdminApi(() => "jwt-token").testerCompliance("t-1");

    expect(result.violations).toEqual(["AAPL"]);
    expect(result.compliant).toBe(false);
  });

  it("fetches the activity feed", async () => {
    const activity = {
      user_id: "t-1",
      events: [{ id: "e1", event_type: "LOGIN", actor: "t-1", ip_address: "1.2.3.4", details: "signed in", created_at: "2026-08-13T00:00:00+00:00" }],
      count: 1,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(activity)));

    const result = await new AdminApi(() => "jwt-token").testerActivity("t-1");

    expect(result.count).toBe(1);
    expect(result.events[0].event_type).toBe("LOGIN");
  });

  it("creates an invite with a JSON body and parses the response", async () => {
    const invite = {
      code: "ABC12345",
      created_by: "admin-uid",
      max_uses: 1,
      uses: 0,
      expires_at: "2026-09-12T00:00:00+00:00",
      created_at: "2026-08-13T00:00:00+00:00",
      expired: false,
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(invite));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new AdminApi(() => "jwt-token").createInvite({ max_uses: 1 });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.headers.get("Content-Type")).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({ max_uses: 1 });
    expect(result.code).toBe("ABC12345");
  });

  it("lists invites", async () => {
    const invites = {
      invites: [{ code: "ABC12345", created_by: "admin", max_uses: 1, uses: 0, expires_at: "2026-09-12T00:00:00+00:00", created_at: "2026-08-13T00:00:00+00:00", expired: false }],
      count: 1,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(invites)));

    const result = await new AdminApi(() => "jwt-token").listInvites();

    expect(result.count).toBe(1);
    expect(result.invites[0].expired).toBe(false);
  });

  it("throws ApiError with the server detail on 4xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ detail: "Tester has no Alpaca paper credentials on file" }, 409)),
    );

    await expect(new AdminApi(() => "jwt-token").testerPortfolio("t-1")).rejects.toMatchObject({
      status: 409,
      detail: "Tester has no Alpaca paper credentials on file",
    });
  });

  it("throws ApiError with the status code on 401/403", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ detail: "Admin privileges required" }, 403)));

    await expect(new AdminApi(() => "jwt-token").listTesters()).rejects.toMatchObject({
      status: 403,
      detail: "Admin privileges required",
    });
  });

  it("falls back to a generic detail when the error body is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("boom", { status: 502, statusText: "Bad Gateway" })),
    );

    await expect(new AdminApi(() => "jwt-token").testerPortfolio("t-1")).rejects.toMatchObject({
      status: 502,
      detail: "Bad Gateway",
    });
  });

  it("exposes status and detail on ApiError", () => {
    const err = new ApiError(401, "Missing or invalid Authorization header");
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(401);
    expect(err.detail).toBe("Missing or invalid Authorization header");
    expect(err.message).toBe("Missing or invalid Authorization header");
  });

  it("fetches spectate engine status from /spectate/status", async () => {
    const status = {
      scheduler_running: true,
      last_started_at: "2026-08-15T01:00:00+00:00",
      next_fire_at: "2026-08-17T09:30:00-04:00",
      etf_symbol: "SPUS",
      top_n: 20,
      broker_url: "https://paper-api.alpaca.markets",
      trading_mode: "paper",
      is_live: false,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(status)));

    const result = await new AdminApi(() => "jwt-token").spectateStatus();

    expect(fetchMockUrl()).toBe("/api/admin/spectate/status");
    expect(result.scheduler_running).toBe(true);
    expect(result.etf_symbol).toBe("SPUS");
    expect(result.top_n).toBe(20);
  });

  it("fetches spectate account from /spectate/account", async () => {
    const account = {
      equity: 12500.5,
      cash: 2500.0,
      buying_power: 5000.0,
      portfolio_value: 12500.5,
      dayl_pl: 120.25,
      dayl_pl_pct: 0.97,
      estimated_fees: 0.0,
      fee_drag_pct: 0.0,
      fee_status_label: "Ultra-Low Drag (<0.05%)",
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(account)));

    const result = await new AdminApi(() => "jwt-token").spectateAccount();

    expect(fetchMockUrl()).toBe("/api/admin/spectate/account");
    expect(result.equity).toBe(12500.5);
    expect(result.dayl_pl_pct).toBe(0.97);
  });

  it("fetches spectate portfolio positions from /spectate/portfolio", async () => {
    const positions = [
      {
        symbol: "SPUS",
        qty: 100,
        market_value: 4200.0,
        avg_entry_price: 40.5,
        unrealized_pl: 150.0,
        unrealized_pl_pct: 3.7,
        current_price: 42.0,
      },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(positions)));

    const result = await new AdminApi(() => "jwt-token").spectatePortfolio();

    expect(fetchMockUrl()).toBe("/api/admin/spectate/portfolio");
    expect(result[0].symbol).toBe("SPUS");
    expect(result[0].unrealized_pl).toBe(150.0);
  });

  it("fetches spectate universe from /spectate/universe", async () => {
    const universe = {
      computing: false,
      last_computed_at: "2026-08-15T02:00:00+00:00",
      stocks: [
        {
          symbol: "MSFT",
          momentum_score: 0.9,
          quality_score: 0.8,
          volatility_score: 0.2,
          value_score: 0.6,
          factor_score: 0.78,
          rank: 1,
          in_portfolio: true,
          in_top_n: true,
        },
      ],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(universe)));

    const result = await new AdminApi(() => "jwt-token").spectateUniverse();

    expect(fetchMockUrl()).toBe("/api/admin/spectate/universe");
    expect(result.stocks[0].factor_score).toBe(0.78);
    expect(result.stocks[0].in_portfolio).toBe(true);
  });

  it("fetches spectate compliance from /spectate/compliance", async () => {
    const compliance = {
      compliant: true,
      violations: [],
      held_count: 18,
      universe_size: 20,
      last_checked: "2026-08-15T02:30:00+00:00",
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(compliance)));

    const result = await new AdminApi(() => "jwt-token").spectateCompliance();

    expect(fetchMockUrl()).toBe("/api/admin/spectate/compliance");
    expect(result.compliant).toBe(true);
    expect(result.held_count).toBe(18);
  });

  it("surfaces 502 from any spectate call as ApiError with the proxy detail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ detail: "Dashboard unreachable: connection refused" }, 502)),
    );

    await expect(new AdminApi(() => "jwt-token").spectateStatus()).rejects.toMatchObject({
      status: 502,
      detail: "Dashboard unreachable: connection refused",
    });
  });
});

function fetchMockUrl(): string {
  const calls = vi.mocked(fetch).mock.calls;
  return typeof calls[0][0] === "string" ? calls[0][0] : String(calls[0][0]);
}
