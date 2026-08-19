import { describe, expect, it } from "vitest";

import {
  formatCurrency,
  formatDateTime,
  formatRelativeTime,
  formatSignedCurrency,
  inviteLink,
  keysTone,
  stateTone,
  truncateMiddle,
} from "./format";
import type { TesterState } from "./api";

describe("formatCurrency", () => {
  it("formats a numeric string with two decimals and commas", () => {
    expect(formatCurrency("10000.00")).toBe("$10,000.00");
    expect(formatCurrency("2500.5")).toBe("$2,500.50");
  });

  it("accepts numbers", () => {
    expect(formatCurrency(12345.6)).toBe("$12,345.60");
  });

  it("renders a dash for null/undefined/missing", () => {
    expect(formatCurrency(null)).toBe("—");
    expect(formatCurrency(undefined)).toBe("—");
  });
});

describe("formatSignedCurrency", () => {
  it("prefixes positive values with a plus", () => {
    expect(formatSignedCurrency("120.50")).toBe("+$120.50");
  });

  it("keeps the minus on negative values", () => {
    expect(formatSignedCurrency("-30.00")).toBe("-$30.00");
  });

  it("renders zero unsigned", () => {
    expect(formatSignedCurrency("0")).toBe("$0.00");
  });

  it("renders a dash for missing values", () => {
    expect(formatSignedCurrency(null)).toBe("—");
  });
});

describe("formatRelativeTime", () => {
  const NOW = Date.parse("2026-08-13T12:00:00Z");

  it("renders 'Never' for null/undefined", () => {
    expect(formatRelativeTime(null, NOW)).toBe("Never");
    expect(formatRelativeTime(undefined, NOW)).toBe("Never");
  });

  it("renders 'just now' for the last minute", () => {
    expect(formatRelativeTime("2026-08-13T11:59:40Z", NOW)).toBe("just now");
  });

  it("renders minutes, hours and days", () => {
    expect(formatRelativeTime("2026-08-13T11:55:00Z", NOW)).toBe("5m ago");
    expect(formatRelativeTime("2026-08-13T09:00:00Z", NOW)).toBe("3h ago");
    expect(formatRelativeTime("2026-08-11T12:00:00Z", NOW)).toBe("2d ago");
  });

  it("renders a plain date once older than a week", () => {
    expect(formatRelativeTime("2026-08-05T12:00:00Z", NOW)).toBe("2026-08-05");
  });

  it("renders 'in 5m' style for future timestamps, not 'just now'", () => {
    expect(formatRelativeTime("2026-08-13T12:05:00Z", NOW)).toBe("in 5m");
    expect(formatRelativeTime("2026-08-13T15:00:00Z", NOW)).toBe("in 3h");
    expect(formatRelativeTime("2026-08-15T12:00:00Z", NOW)).toBe("in 2d");
  });

  it("renders a plain date for future timestamps more than a week out", () => {
    expect(formatRelativeTime("2026-08-23T12:00:00Z", NOW)).toBe("2026-08-23");
  });
});

describe("formatDateTime", () => {
  it("formats an ISO timestamp as UTC date + time", () => {
    expect(formatDateTime("2026-08-13T00:00:00+00:00")).toBe("2026-08-13 00:00");
  });

  it("renders a dash for missing timestamps", () => {
    expect(formatDateTime(null)).toBe("—");
    expect(formatDateTime(undefined)).toBe("—");
  });
});

describe("stateTone", () => {
  it.each<[TesterState, string]>([
    ["pending", "amber"],
    ["active", "green"],
    ["revoked", "red"],
  ])("maps %s to the %s badge tone", (state, expected) => {
    expect(stateTone(state)).toBe(expected);
  });
});

describe("keysTone", () => {
  it("is green when paper keys are on file, slate otherwise", () => {
    expect(keysTone(true)).toBe("green");
    expect(keysTone(false)).toBe("slate");
  });
});

describe("truncateMiddle", () => {
  it("keeps short strings intact", () => {
    expect(truncateMiddle("short")).toBe("short");
  });

  it("elides the middle of a UUID-style id", () => {
    expect(truncateMiddle("5b7fb8dd-5f45-4225-a62e-5c908be06279")).toBe("5b7fb8dd…6279");
  });
});

describe("inviteLink", () => {
  it("builds the tester-facing invite URL", () => {
    expect(inviteLink("ABC12345")).toBe("https://shariahtrading.my/invite/ABC12345");
  });

  it("honours a custom base", () => {
    expect(inviteLink("ABC12345", "http://127.0.0.1:5173")).toBe(
      "http://127.0.0.1:5173/invite/ABC12345",
    );
  });
});

