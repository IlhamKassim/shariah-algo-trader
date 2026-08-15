// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OverviewView } from "./OverviewView";
import type { AnalyticsRiskResponse, Tester } from "../lib/api";

const MOCK_ANALYTICS: AnalyticsRiskResponse = {
  generated_at: "2026-08-15T10:00:00Z",
  cache_ttl_seconds: 60,
  kpis: {
    total_customers: 10,
    active_traders: 8,
    portfolio_value_usd: 1250000.5,
    accounts_evaluated: 8,
    accounts_unreachable: 0,
    compliance_pct: 100.0,
    compliance_status: "OPTIMAL",
  },
  risk_distribution: {
    low: 8,
    med: 0,
    high: 0,
  },
  alerts: [
    {
      created_at: "2026-08-15T09:30:00Z",
      severity: "info",
      code: "REBALANCE_EXECUTED",
      user_id: "u-1",
      message: "Rebalance cycle completed across 8 active accounts",
    },
  ],
  flagged: [],
};

const MOCK_TESTERS: Tester[] = [
  {
    user_id: "tester-1",
    email: "alpha@example.com",
    role: "tester",
    state: "active",
    invite_code: "INV-1",
    linkedin_url: null,
    notes: null,
    approved_by: "admin",
    created_at: "2026-08-10T00:00:00Z",
    updated_at: "2026-08-10T00:00:00Z",
    trading_mode: "paper",
    shariah_trader_enabled: 1,
    has_paper_keys: true,
    has_live_keys: false,
    last_activity_at: null,
  },
];

describe("OverviewView component", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders KPI metrics, charts, and customer list", () => {
    const onNavigate = vi.fn();
    const onRefresh = vi.fn();

    render(
      <OverviewView
        analytics={MOCK_ANALYTICS}
        testers={MOCK_TESTERS}
        loading={false}
        onNavigateToCustomers={onNavigate}
        onRefresh={onRefresh}
      />
    );

    expect(screen.getByText(/Analytics & Risk/i)).toBeTruthy();
    expect(screen.getByText(/Total AUM \(Paper\)/i)).toBeTruthy();
    expect(screen.getByText(/\$1,250,000.50/)).toBeTruthy();
    expect(screen.getByText(/OPTIMAL/)).toBeTruthy();
    expect(screen.getByText(/alpha@example.com/)).toBeTruthy();

    fireEvent.click(screen.getByText(/View All CRM/i));
    expect(onNavigate).toHaveBeenCalled();
  });

  it("renders the REAL risk distribution from the analytics payload, never fabricated 55/30/15%", () => {
    render(
      <OverviewView
        analytics={MOCK_ANALYTICS}
        testers={MOCK_TESTERS}
        loading={false}
        onNavigateToCustomers={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    // Real counts from analytics.risk_distribution (low 8 / med 0 / high 0).
    expect(screen.getByText(/Low Risk/i)).toBeTruthy();
    expect(screen.getByText(/High Risk/i)).toBeTruthy();
    // The fabricated allocation percentages must be gone.
    expect(screen.queryByText("55%")).toBeNull();
    expect(screen.queryByText("30%")).toBeNull();
    expect(screen.queryByText("15%")).toBeNull();
    expect(screen.queryByText(/Halal Equities/)).toBeNull();
    expect(screen.queryByText(/Sukuk/)).toBeNull();
  });

  it("does not render the fabricated +12.5% trend or 1.4x ratio", () => {
    render(
      <OverviewView
        analytics={MOCK_ANALYTICS}
        testers={MOCK_TESTERS}
        loading={false}
        onNavigateToCustomers={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    expect(screen.queryByText("+12.5%")).toBeNull();
    expect(screen.queryByText("1.4x Ratio")).toBeNull();
  });

  it("renders an honest no-time-series state instead of the hardcoded SVG chart and dead timeframe tabs", () => {
    render(
      <OverviewView
        analytics={MOCK_ANALYTICS}
        testers={MOCK_TESTERS}
        loading={false}
        onNavigateToCustomers={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    // The analytics API exposes no time series, so no fabricated chart or
    // timeframe tabs may render.
    expect(screen.getByText(/No time-series data/)).toBeTruthy();
    expect(screen.queryByText("1W")).toBeNull();
    expect(screen.queryByText("1M")).toBeNull();
    expect(screen.queryByText("1Y")).toBeNull();
    expect(screen.queryByText(/User Growth & Portfolio Trends/)).toBeNull();
  });

  it("shows an honest empty state for risk distribution when analytics is absent", () => {
    render(
      <OverviewView
        analytics={null}
        testers={MOCK_TESTERS}
        loading={false}
        onNavigateToCustomers={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    expect(screen.getByText(/No risk distribution data/)).toBeTruthy();
  });
});
