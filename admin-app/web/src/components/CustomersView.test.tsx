// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CustomersView } from "./CustomersView";
import type { Tester } from "../lib/api";

const MOCK_TESTERS: Tester[] = [
  {
    user_id: "tester-1",
    email: "alpha@example.com",
    role: "tester",
    state: "pending",
    invite_code: "INV-1",
    linkedin_url: null,
    notes: null,
    approved_by: null,
    created_at: "2026-08-10T00:00:00Z",
    updated_at: "2026-08-10T00:00:00Z",
    trading_mode: "paper",
    shariah_trader_enabled: 0,
    has_paper_keys: false,
    has_live_keys: false,
    last_activity_at: null,
  },
];

describe("CustomersView component", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders customer directory and responds to approve actions", () => {
    const onSelect = vi.fn();
    const onApprove = vi.fn();
    const onRevoke = vi.fn();
    const onInspect = vi.fn();

    render(
      <CustomersView
        testers={MOCK_TESTERS}
        selectedTesterId="tester-1"
        onSelectTester={onSelect}
        onApprove={onApprove}
        onRevoke={onRevoke}
        onInspectDrawer={onInspect}
        api={null}
        busyId={null}
      />
    );

    expect(screen.getByText(/Customer CRM Directory/i)).toBeTruthy();
    expect(screen.getAllByText(/alpha@example.com/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Approve Customer/i)).toBeTruthy();

    fireEvent.click(screen.getByText(/Approve Customer/i));
    expect(onApprove).toHaveBeenCalledWith(MOCK_TESTERS[0]);
  });
});
