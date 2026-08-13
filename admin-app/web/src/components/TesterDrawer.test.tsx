// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminApi, type Tester } from "../lib/api";
import { TesterDrawer } from "./TesterDrawer";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const TESTER: Tester = {
  user_id: "tester-1",
  email: "t1@example.com",
  role: "tester",
  state: "active",
  invite_code: null,
  linkedin_url: null,
  notes: null,
  approved_by: "admin-uid",
  created_at: "2026-08-13T00:00:00+00:00",
  updated_at: "2026-08-13T00:00:00+00:00",
  trading_mode: "paper",
  shariah_trader_enabled: 0,
  has_paper_keys: true,
  has_live_keys: false,
  last_activity_at: null,
};

const PORTFOLIO = {
  user_id: "tester-1",
  paper_base_url: "https://paper-api.alpaca.markets",
  account: { equity: "10000.00", cash: "2500.00" },
  positions: [{ symbol: "SPUS", qty: "100", market_value: "4000.00", unrealized_pl: "120.50" }],
  unrealized_pl: 120.5,
};

const COMPLIANCE = {
  compliant: true,
  violations: [],
  held_count: 1,
  universe_size: 3,
  last_checked: "2026-08-13T00:00:00+00:00",
  user_id: "tester-1",
  paper_base_url: "https://paper-api.alpaca.markets",
};

const ACTIVITY = {
  user_id: "tester-1",
  events: [
    { id: "e1", event_type: "LOGIN", actor: "tester-1", ip_address: "1.2.3.4", details: "signed in", created_at: "2026-08-13T00:00:00+00:00" },
  ],
  count: 1,
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 25));

describe("TesterDrawer", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  function setup() {
    // Real network latency would gate the loop; a 1ms round-trip keeps the
    // event loop breathing so a regressed fetch loop fails as an assertion
    // instead of hanging the runner.
    const respond = (body: unknown, status = 200) =>
      new Promise<Response>((resolve) => setTimeout(() => resolve(jsonResponse(body, status)), 1));
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/testers/tester-1/portfolio")) return respond(PORTFOLIO);
      if (url.endsWith("/testers/tester-1/compliance")) return respond(COMPLIANCE);
      if (url.endsWith("/testers/tester-1/activity")) return respond(ACTIVITY);
      return respond({ detail: "not found" }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);
    const api = new AdminApi(() => "jwt-token");
    return { fetchMock, api };
  }

  function endpointCalls(fetchMock: ReturnType<typeof vi.fn>, suffix: string): number {
    return fetchMock.mock.calls.filter(([input]) => String(input).endsWith(suffix)).length;
  }

  it("renders the portfolio tab with exactly one fetch per open — no infinite loop", async () => {
    const { fetchMock, api } = setup();

    render(<TesterDrawer tester={TESTER} api={api} onClose={vi.fn()} />);
    expect(await screen.findByText("$10,000.00")).toBeTruthy();
    expect(await screen.findByText("SPUS")).toBeTruthy();
    await settle();

    // The AC-10 regression: the fetcher must fire exactly once per open, not loop.
    expect(endpointCalls(fetchMock, "/portfolio")).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Opening the drawer again fetches exactly once more.
    cleanup();
    render(<TesterDrawer tester={TESTER} api={api} onClose={vi.fn()} />);
    expect(await screen.findByText("$10,000.00")).toBeTruthy();
    await settle();

    expect(endpointCalls(fetchMock, "/portfolio")).toBe(2);
  });

  it("fetches each tab's data exactly once when switched to", async () => {
    const { fetchMock, api } = setup();

    render(<TesterDrawer tester={TESTER} api={api} onClose={vi.fn()} />);
    expect(await screen.findByText("$10,000.00")).toBeTruthy();
    await settle();
    expect(endpointCalls(fetchMock, "/portfolio")).toBe(1);

    fireEvent.click(screen.getByRole("tab", { name: "Compliance" }));
    expect(await screen.findByText("Compliant")).toBeTruthy();
    await settle();
    expect(endpointCalls(fetchMock, "/compliance")).toBe(1);
    expect(endpointCalls(fetchMock, "/portfolio")).toBe(1);

    fireEvent.click(screen.getByRole("tab", { name: "Activity" }));
    expect(await screen.findByText("LOGIN")).toBeTruthy();
    await settle();
    expect(endpointCalls(fetchMock, "/activity")).toBe(1);
    expect(endpointCalls(fetchMock, "/portfolio")).toBe(1);
    expect(endpointCalls(fetchMock, "/compliance")).toBe(1);

    // Switching back re-mounts the tab: one fresh fetch, never a loop.
    fireEvent.click(screen.getByRole("tab", { name: "Portfolio" }));
    expect(await screen.findByText("$10,000.00")).toBeTruthy();
    await settle();
    expect(endpointCalls(fetchMock, "/portfolio")).toBe(2);
  });
});
