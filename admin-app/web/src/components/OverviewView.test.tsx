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
});
