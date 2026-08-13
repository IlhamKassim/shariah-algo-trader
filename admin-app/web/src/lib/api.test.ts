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
});
