// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminApi } from "../lib/api";
import { SpectateView } from "./SpectateView";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const STATUS = {
  scheduler_running: true,
  last_started_at: "2026-08-15T01:00:00+00:00",
  next_fire_at: "2026-08-17T13:30:00+00:00",
  etf_symbol: "SPUS",
  top_n: 20,
  broker_url: "https://paper-api.alpaca.markets",
  trading_mode: "paper",
  is_live: false,
};

const STATUS_STOPPED = { ...STATUS, scheduler_running: false };

const ACCOUNT = {
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

const ZEROED_ACCOUNT = {
  equity: 0,
  cash: 0,
  buying_power: 0,
  portfolio_value: 0,
  dayl_pl: 0,
  dayl_pl_pct: 0,
  estimated_fees: 0,
  fee_drag_pct: 0,
  fee_status_label: "Connect Alpaca API in Settings",
};

const POSITIONS = [
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

const UNIVERSE = {
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
    {
      symbol: "AAPL",
      momentum_score: 0.85,
      quality_score: 0.9,
      volatility_score: 0.15,
      value_score: 0.5,
      factor_score: 0.74,
      rank: 2,
      in_portfolio: false,
      in_top_n: true,
    },
    {
      symbol: "FAR_OUT",
      momentum_score: 0.1,
      quality_score: 0.1,
      volatility_score: 0.9,
      value_score: 0.1,
      factor_score: 0.11,
      rank: 99,
      in_portfolio: false,
      in_top_n: false,
    },
  ],
};

const UNIVERSE_COMPUTING = { ...UNIVERSE, computing: true, stocks: [] };

const COMPLIANCE = {
  compliant: true,
  violations: [],
  held_count: 18,
  universe_size: 20,
  last_checked: "2026-08-15T02:30:00+00:00",
};

const COMPLIANCE_VIOLATIONS = {
  ...COMPLIANCE,
  compliant: false,
  violations: ["TSLA"],
  held_count: 19,
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 25));

describe("SpectateView", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function setup() {
    const respond = (body: unknown, status = 200) =>
      new Promise<Response>((resolve) => setTimeout(() => resolve(jsonResponse(body, status)), 1));
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/spectate/status")) return respond(STATUS);
      if (url.endsWith("/spectate/account")) return respond(ACCOUNT);
      if (url.endsWith("/spectate/portfolio")) return respond(POSITIONS);
      if (url.endsWith("/spectate/universe")) return respond(UNIVERSE);
      if (url.endsWith("/spectate/compliance")) return respond(COMPLIANCE);
      return respond({ detail: "not found" }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);
    const api = new AdminApi(() => "jwt-token");
    return { fetchMock, api };
  }

  function endpointCalls(fetchMock: ReturnType<typeof vi.fn>, suffix: string): number {
    return fetchMock.mock.calls.filter(([input]) => String(input).endsWith(suffix)).length;
  }

  it("renders the engine status card with RUNNING badge and config line", async () => {
    const { api } = setup();
    render(<SpectateView api={api} email="founder@example.com" />);

    expect(await screen.findByText("RUNNING")).toBeTruthy();
    expect(screen.getByText("SPUS · 20 · paper-api.alpaca.markets")).toBeTruthy();
    expect(await settle).toBeTruthy();
  });

  it("renders STOPPED badge when the scheduler is not running", async () => {
    const respond = (body: unknown, status = 200) =>
      new Promise<Response>((resolve) => setTimeout(() => resolve(jsonResponse(body, status)), 1));
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/spectate/status")) return respond(STATUS_STOPPED);
      if (url.endsWith("/spectate/account")) return respond(ACCOUNT);
      if (url.endsWith("/spectate/portfolio")) return respond(POSITIONS);
      if (url.endsWith("/spectate/universe")) return respond(UNIVERSE);
      if (url.endsWith("/spectate/compliance")) return respond(COMPLIANCE);
      return respond({ detail: "not found" }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SpectateView api={new AdminApi(() => "jwt-token")} email="founder@example.com" />);

    expect(await screen.findByText("STOPPED")).toBeTruthy();
  });

  it("labels the account panel 'Founder account (yours)' with the caller's email", async () => {
    const { api } = setup();
    render(<SpectateView api={api} email="aqil@example.com" />);

    expect(await screen.findByText(/Founder account \(yours\) — aqil@example\.com/)).toBeTruthy();
  });

  it("renders the stat row: equity, cash, buying power, signed day P/L", async () => {
    const { api } = setup();
    render(<SpectateView api={api} email="founder@example.com" />);

    expect(await screen.findByText("$12,500.50")).toBeTruthy();
    expect(screen.getByText("$2,500.00")).toBeTruthy();
    expect(screen.getByText("$5,000.00")).toBeTruthy();
    expect(screen.getByText(/120\.25/)).toBeTruthy();
    expect(screen.getByText(/0\.97%/)).toBeTruthy();
  });

  it("renders holdings rows and the 'No open positions.' empty state", async () => {
    const { api } = setup();
    render(<SpectateView api={api} email="founder@example.com" />);

    expect(await screen.findByText("SPUS")).toBeTruthy();
    expect(screen.getByText("$4,200.00")).toBeTruthy();
    expect(screen.getByText("+$150.00")).toBeTruthy();
    expect(screen.getByText("+3.70%")).toBeTruthy();
    expect(screen.getByText("$42.00")).toBeTruthy();

    // Empty portfolio -> explicit empty state, never a fabricated row.
    const emptyRespond = (body: unknown, status = 200) =>
      new Promise<Response>((resolve) => setTimeout(() => resolve(jsonResponse(body, status)), 1));
    const emptyFetch = vi.fn((input: RequestInfo | URL) => {
      void input;
      const url = String(input);
      if (url.endsWith("/spectate/portfolio")) return emptyRespond([]);
      if (url.endsWith("/spectate/status")) return emptyRespond(STATUS);
      if (url.endsWith("/spectate/account")) return emptyRespond(ACCOUNT);
      if (url.endsWith("/spectate/universe")) return emptyRespond(UNIVERSE);
      if (url.endsWith("/spectate/compliance")) return emptyRespond(COMPLIANCE);
      return emptyRespond({ detail: "not found" }, 404);
    });
    vi.stubGlobal("fetch", emptyFetch);
    cleanup();
    render(<SpectateView api={new AdminApi(() => "jwt-token")} email="founder@example.com" />);
    expect(await screen.findByText("No open positions.")).toBeTruthy();
  });

  it("renders the compliance line with COMPLIANT chip and counts", async () => {
    const { api } = setup();
    render(<SpectateView api={api} email="founder@example.com" />);

    expect(await screen.findByText("COMPLIANT")).toBeTruthy();
    expect(screen.getByText(/18 \/ 20/)).toBeTruthy();
  });

  it("renders VIOLATIONS chip with the violating symbols", async () => {
    const respond = (body: unknown, status = 200) =>
      new Promise<Response>((resolve) => setTimeout(() => resolve(jsonResponse(body, status)), 1));
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/spectate/compliance")) return respond(COMPLIANCE_VIOLATIONS);
      if (url.endsWith("/spectate/status")) return respond(STATUS);
      if (url.endsWith("/spectate/account")) return respond(ACCOUNT);
      if (url.endsWith("/spectate/portfolio")) return respond(POSITIONS);
      if (url.endsWith("/spectate/universe")) return respond(UNIVERSE);
      return respond({ detail: "not found" }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SpectateView api={new AdminApi(() => "jwt-token")} email="founder@example.com" />);

    expect(await screen.findByText("VIOLATIONS")).toBeTruthy();
    expect(screen.getByText("TSLA")).toBeTruthy();
  });

  it("renders the zeroed-account payload as its fee_status_label text, never zeros", async () => {
    const respond = (body: unknown, status = 200) =>
      new Promise<Response>((resolve) => setTimeout(() => resolve(jsonResponse(body, status)), 1));
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/spectate/account")) return respond(ZEROED_ACCOUNT);
      if (url.endsWith("/spectate/status")) return respond(STATUS);
      if (url.endsWith("/spectate/portfolio")) return respond(POSITIONS);
      if (url.endsWith("/spectate/universe")) return respond(UNIVERSE);
      if (url.endsWith("/spectate/compliance")) return respond(COMPLIANCE);
      return respond({ detail: "not found" }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SpectateView api={new AdminApi(() => "jwt-token")} email="founder@example.com" />);

    expect(await screen.findByText("Connect Alpaca API in Settings")).toBeTruthy();
    expect(screen.queryByText("$0.00")).toBeNull();
    expect(screen.queryByText("$0.00", { exact: false })).toBeNull();
  });

  it("renders the universe summary with eligible count and top-N table", async () => {
    const { api } = setup();
    render(<SpectateView api={api} email="founder@example.com" />);

    expect(await screen.findByText("MSFT")).toBeTruthy();
    expect(screen.getByText("AAPL")).toBeTruthy();
    expect(screen.getByText("0.78")).toBeTruthy();
    expect(screen.getByText("0.74")).toBeTruthy();
    expect(screen.getByLabelText("MSFT in portfolio")).toBeTruthy();
    // Only stocks the engine ranked into top_n render — FAR_OUT (rank 99,
    // in_top_n false) must not appear in the table.
    expect(screen.queryByText("FAR_OUT")).toBeNull();
  });

  it("shows the COMPUTING indicator when the universe is being recomputed", async () => {
    const respond = (body: unknown, status = 200) =>
      new Promise<Response>((resolve) => setTimeout(() => resolve(jsonResponse(body, status)), 1));
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/spectate/universe")) return respond(UNIVERSE_COMPUTING);
      if (url.endsWith("/spectate/status")) return respond(STATUS);
      if (url.endsWith("/spectate/account")) return respond(ACCOUNT);
      if (url.endsWith("/spectate/portfolio")) return respond(POSITIONS);
      if (url.endsWith("/spectate/compliance")) return respond(COMPLIANCE);
      return respond({ detail: "not found" }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SpectateView api={new AdminApi(() => "jwt-token")} email="founder@example.com" />);

    expect(await screen.findByText("COMPUTING")).toBeTruthy();
  });

  it("renders an inline 'dashboard unreachable' state when the proxy 502s", async () => {
    const respond = (body: unknown, status = 200) =>
      new Promise<Response>((resolve) => setTimeout(() => resolve(jsonResponse(body, status)), 1));
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      void input;
      return respond({ detail: "Dashboard unreachable: connection refused" }, 502);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SpectateView api={new AdminApi(() => "jwt-token")} email="founder@example.com" />);

    expect((await screen.findAllByText(/Dashboard unreachable/)).length).toBeGreaterThan(0);
  });

  it("polls status/account/portfolio/compliance every 30s but not the universe", async () => {
    vi.useFakeTimers();
    const { fetchMock, api } = setup();

    render(<SpectateView api={api} email="founder@example.com" />);

    // Initial mount: all five spectate endpoints fire once.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(endpointCalls(fetchMock, "/spectate/status")).toBe(1);
    expect(endpointCalls(fetchMock, "/spectate/account")).toBe(1);
    expect(endpointCalls(fetchMock, "/spectate/portfolio")).toBe(1);
    expect(endpointCalls(fetchMock, "/spectate/compliance")).toBe(1);
    expect(endpointCalls(fetchMock, "/spectate/universe")).toBe(1);

    // 30s later: the four glance endpoints refetch, the universe does not.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(endpointCalls(fetchMock, "/spectate/status")).toBe(2);
    expect(endpointCalls(fetchMock, "/spectate/account")).toBe(2);
    expect(endpointCalls(fetchMock, "/spectate/portfolio")).toBe(2);
    expect(endpointCalls(fetchMock, "/spectate/compliance")).toBe(2);
    expect(endpointCalls(fetchMock, "/spectate/universe")).toBe(1);

    // Manual refresh button refetches the universe.
    fireEvent.click(screen.getByRole("button", { name: /Refresh universe/i }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(endpointCalls(fetchMock, "/spectate/universe")).toBe(2);
  });
});
