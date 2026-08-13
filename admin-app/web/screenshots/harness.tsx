/**
 * Dev-only screenshot harness for the admin-app reskin (Quantix Glass V2).
 * Renders the REAL TestersView + InvitesView components against a stubbed
 * fetch (same technique as the vitest suites) so the user can eyeball the
 * reskin against the main dashboard without a live Supabase session.
 *
 * Not part of the product: lives outside src/ (tsconfig include) and is not
 * referenced by index.html, so `tsc -b` and `vite build` ignore it. Serve
 * with `npx vite dev` and open /screenshots.html.
 */
import { createRoot } from "react-dom/client";

import { NavBar } from "../src/components/NavBar";
import { TestersView } from "../src/components/TestersView";
import { InvitesView } from "../src/components/InvitesView";
import { AdminApi, type Tester } from "../src/lib/api";
import "../src/index.css";

const NOW = Date.now();
const HOUR = 3_600_000;

const TESTERS: Tester[] = [
  {
    user_id: "usr_9f2c1a7e4b8d",
    email: "sarah.aziz@gmail.com",
    role: "tester",
    state: "active",
    invite_code: null,
    linkedin_url: null,
    notes: null,
    approved_by: "admin-uid",
    created_at: new Date(NOW - 30 * 86_400_000).toISOString(),
    updated_at: new Date(NOW - 2 * HOUR).toISOString(),
    trading_mode: "paper",
    shariah_trader_enabled: 1,
    has_paper_keys: true,
    has_live_keys: false,
    last_activity_at: new Date(NOW - 2 * HOUR).toISOString(),
  },
  {
    user_id: "usr_41d8e6b2c9f0",
    email: "daniel.lim@outlook.com",
    role: "tester",
    state: "pending",
    invite_code: "SPUS-7K2M",
    linkedin_url: null,
    notes: null,
    approved_by: null,
    created_at: new Date(NOW - 1 * 86_400_000).toISOString(),
    updated_at: new Date(NOW - 1 * 86_400_000).toISOString(),
    trading_mode: "paper",
    shariah_trader_enabled: 0,
    has_paper_keys: false,
    has_live_keys: false,
    last_activity_at: new Date(NOW - 5 * HOUR).toISOString(),
  },
  {
    user_id: "usr_77a3b1d5e8c2",
    email: "nurul.huda@yahoo.com",
    role: "tester",
    state: "revoked",
    invite_code: null,
    linkedin_url: null,
    notes: null,
    approved_by: "admin-uid",
    created_at: new Date(NOW - 21 * 86_400_000).toISOString(),
    updated_at: new Date(NOW - 3 * 86_400_000).toISOString(),
    trading_mode: "paper",
    shariah_trader_enabled: 0,
    has_paper_keys: true,
    has_live_keys: false,
    last_activity_at: new Date(NOW - 3 * 86_400_000).toISOString(),
  },
  {
    user_id: "usr_0c5f9a3e7b1d",
    email: "amir.hakim@gmail.com",
    role: "tester",
    state: "active",
    invite_code: null,
    linkedin_url: null,
    notes: null,
    approved_by: "admin-uid",
    created_at: new Date(NOW - 12 * 86_400_000).toISOString(),
    updated_at: new Date(NOW - 30 * 60_000).toISOString(),
    trading_mode: "paper",
    shariah_trader_enabled: 1,
    has_paper_keys: true,
    has_live_keys: false,
    last_activity_at: new Date(NOW - 30 * 60_000).toISOString(),
  },
];

const INVITES = [
  {
    code: "SPUS-7K2M",
    created_by: "admin-uid",
    max_uses: 1,
    uses: 0,
    expires_at: new Date(NOW + 7 * 86_400_000).toISOString(),
    created_at: new Date(NOW - 1 * 86_400_000).toISOString(),
    expired: false,
  },
  {
    code: "HLAL-3Q9X",
    created_by: "admin-uid",
    max_uses: 2,
    uses: 2,
    expires_at: new Date(NOW + 90 * 86_400_000).toISOString(),
    created_at: new Date(NOW - 8 * 86_400_000).toISOString(),
    expired: false,
  },
  {
    code: "SPSK-5N4C",
    created_by: "admin-uid",
    max_uses: 1,
    uses: 0,
    expires_at: new Date(NOW - 2 * 86_400_000).toISOString(),
    created_at: new Date(NOW - 20 * 86_400_000).toISOString(),
    expired: true,
  },
];

const PORTFOLIOS: Record<string, unknown> = {
  usr_9f2c1a7e4b8d: {
    user_id: "usr_9f2c1a7e4b8d",
    paper_base_url: "https://paper-api.alpaca.markets",
    account: { equity: "12345.67", cash: "2345.67", buying_power: "24691.34" },
    unrealized_pl: 412.19,
    positions: [
      { symbol: "SPUS", qty: "40", market_value: "4880.00", unrealized_pl: "185.20" },
      { symbol: "HLAL", qty: "30", market_value: "2544.30", unrealized_pl: "96.41" },
      { symbol: "SPSK", qty: "45", market_value: "1804.50", unrealized_pl: "130.58" },
    ],
  },
  usr_77a3b1d5e8c2: {
    user_id: "usr_77a3b1d5e8c2",
    paper_base_url: "https://paper-api.alpaca.markets",
    account: { equity: "501.00", cash: "501.00", buying_power: "1002.00" },
    unrealized_pl: 0,
    positions: [],
  },
  usr_0c5f9a3e7b1d: {
    user_id: "usr_0c5f9a3e7b1d",
    paper_base_url: "https://paper-api.alpaca.markets",
    account: { equity: "98210.42", cash: "12740.15", buying_power: "195680.84" },
    unrealized_pl: -312.77,
    positions: [
      { symbol: "SPUS", qty: "300", market_value: "36600.00", unrealized_pl: "-401.20" },
      { symbol: "HLAL", qty: "250", market_value: "21202.50", unrealized_pl: "88.43" },
    ],
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function stubFetch() {
  const fetchMock = (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    if (url.endsWith("/testers")) {
      return Promise.resolve(jsonResponse({ testers: TESTERS, count: TESTERS.length }));
    }
    if (url.endsWith("/invites")) {
      return Promise.resolve(jsonResponse({ invites: INVITES, count: INVITES.length }));
    }
    const portfolio = /\/testers\/([^/]+)\/portfolio$/.exec(url);
    if (portfolio) {
      const body = PORTFOLIOS[portfolio[1]] ?? {
        user_id: portfolio[1],
        paper_base_url: "https://paper-api.alpaca.markets",
        account: { equity: "0.00", cash: "0.00", buying_power: "0.00" },
        unrealized_pl: 0,
        positions: [],
      };
      return Promise.resolve(jsonResponse(body));
    }
    return Promise.resolve(jsonResponse({ detail: "not found" }, 404));
  };
  window.fetch = fetchMock as typeof fetch;
}

stubFetch();
const api = new AdminApi(() => "jwt-token");

const noop = () => {};

// ?view=testers | ?view=invites — render one view so the screenshot shows only
// that section (both views stacked would overlap the viewport boundary).
const view = new URLSearchParams(window.location.search).get("view") ?? "testers";

createRoot(document.getElementById("root")!).render(
  <div className="flex min-h-screen flex-col bg-glass-page text-primary">
    <NavBar email="aqilnazri9@gmail.com" view="testers" onViewChange={noop} onSignOut={noop} />
    <div className="flex-1 bg-ambient-violet">
      <main className="mx-auto max-w-6xl px-6 py-8">
        {view === "invites" ? (
          <InvitesView api={api} />
        ) : (
          <TestersView
            testers={TESTERS}
            loading={false}
            error={null}
            busyId={null}
            api={api}
            onApprove={noop}
            onRevoke={noop}
            onSelect={noop}
          />
        )}
      </main>
    </div>
  </div>,
);
