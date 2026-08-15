// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { LiveAlert } from "../lib/api";
import { AdminHeader } from "./AdminHeader";

const ALERTS: LiveAlert[] = [
  {
    created_at: "2026-08-15T09:30:00+00:00",
    severity: "critical",
    code: "COMPLIANCE BREACH",
    user_id: "u-1",
    message: "Account u-1 holds a non-eligible symbol",
  },
  {
    created_at: "2026-08-15T08:00:00+00:00",
    severity: "warning",
    code: "REBALANCE SKIPPED",
    user_id: "u-2",
    message: "Rebalance skipped — market closed",
  },
];

describe("AdminHeader notifications", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the alert count on the notifications bell", () => {
    render(
      <AdminHeader title="TEST" email="aqil@example.com" alertCount={2} alerts={ALERTS} />,
    );

    expect(screen.getByTitle("2 Live Alerts")).toBeTruthy();
  });

  it("opens a dropdown listing the live alerts when the bell is clicked", () => {
    render(
      <AdminHeader title="TEST" email="aqil@example.com" alertCount={2} alerts={ALERTS} />,
    );

    fireEvent.click(screen.getByTitle("2 Live Alerts"));
    expect(screen.getByText("COMPLIANCE BREACH")).toBeTruthy();
    expect(screen.getByText("Account u-1 holds a non-eligible symbol")).toBeTruthy();
    expect(screen.getByText("REBALANCE SKIPPED")).toBeTruthy();
  });

  it("shows an honest empty state when there are no alerts", () => {
    render(<AdminHeader title="TEST" email="aqil@example.com" alertCount={0} alerts={[]} />);

    fireEvent.click(screen.getByTitle("0 Live Alerts"));
    expect(screen.getByText("No live alerts.")).toBeTruthy();
  });

  it("closes the dropdown when a second click hits the bell", () => {
    render(
      <AdminHeader title="TEST" email="aqil@example.com" alertCount={2} alerts={ALERTS} />,
    );

    const bell = screen.getByTitle("2 Live Alerts");
    fireEvent.click(bell);
    expect(screen.getByText("COMPLIANCE BREACH")).toBeTruthy();

    fireEvent.click(bell);
    expect(screen.queryByText("COMPLIANCE BREACH")).toBeNull();
  });
});
