// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminApi } from "../lib/api";
import { InvitesView } from "./InvitesView";

const DAY_MS = 86_400_000;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeInvite(code: string, expiresAt: string | null): unknown {
  const created = new Date().toISOString();
  return {
    code,
    created_by: "admin-uid",
    max_uses: 1,
    uses: 0,
    expires_at: expiresAt,
    created_at: created,
    expired: expiresAt !== null && expiresAt < created,
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 25));

describe("InvitesView expiry selector", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  /** Real AdminApi with a stubbed fetch; the POST /invites mock echoes the
   *  requested expiry back, mirroring the A7 router contract. */
  function setup(initialInvites: unknown[] = []) {
    let lastCreateBody: { expires_at?: string | null; max_uses?: number } | null = null;
    let created: unknown = null;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "POST" && url.endsWith("/invites")) {
        const body = JSON.parse(String(init.body)) as { expires_at?: string | null; max_uses?: number };
        lastCreateBody = body;
        created = makeInvite("CODE-7D", body.expires_at ?? null);
        return Promise.resolve(jsonResponse(created));
      }
      if (url.endsWith("/invites")) {
        const invites = created ? [...initialInvites, created] : initialInvites;
        return Promise.resolve(jsonResponse({ invites, count: invites.length }));
      }
      return Promise.resolve(jsonResponse({ detail: "not found" }, 404));
    });
    vi.stubGlobal("fetch", fetchMock);
    const api = new AdminApi(() => "jwt-token");
    return { api, getCreateBody: () => lastCreateBody };
  }

  function expirySelect(): HTMLSelectElement {
    return screen.getByLabelText("Expiry") as HTMLSelectElement;
  }

  function optionValue(name: string): string {
    return (screen.getByRole("option", { name }) as HTMLOptionElement).value;
  }

  function selectExpiry(name: string) {
    fireEvent.change(expirySelect(), { target: { value: optionValue(name) } });
  }

  async function renderReady(api: AdminApi) {
    render(<InvitesView api={api} />);
    await screen.findByText(/No invites yet/);
    await settle();
  }

  async function submitCreate() {
    fireEvent.click(screen.getByRole("button", { name: "Create invite" }));
    await screen.findByText("Invite created");
    await settle();
  }

  it("defaults the dropdown to the 30-day option it actually submits", async () => {
    const { api, getCreateBody } = setup();
    await renderReady(api);

    // The control must not lie: the displayed option equals the state default,
    // and submitting without touching it sends ~30 days.
    expect(expirySelect().value).toBe(optionValue("30 days (default)"));

    await submitCreate();
    const diff = Date.parse(getCreateBody()!.expires_at!) - Date.now();
    expect(diff).toBeGreaterThan(29.5 * DAY_MS);
    expect(diff).toBeLessThan(30.5 * DAY_MS);
  });

  it("sends a ~7-day expiry when '7 days' is chosen and reflects the response", async () => {
    const { api, getCreateBody } = setup();
    await renderReady(api);

    selectExpiry("7 days");
    // The control shows what the user chose instead of snapping away.
    expect(expirySelect().value).toBe(optionValue("7 days"));

    await submitCreate();
    const diff = Date.parse(getCreateBody()!.expires_at!) - Date.now();
    expect(diff).toBeGreaterThan(6.5 * DAY_MS);
    expect(diff).toBeLessThan(7.5 * DAY_MS);

    // The created invite (with the echoed expiry) is reflected in the UI.
    expect(screen.getAllByText("CODE-7D").length).toBeGreaterThanOrEqual(1);
  });

  it("sends a ~90-day expiry when '90 days' is chosen (QA repro: used to yield 30d)", async () => {
    const { api, getCreateBody } = setup();
    await renderReady(api);

    selectExpiry("90 days");
    expect(expirySelect().value).toBe(optionValue("90 days"));

    await submitCreate();
    const diff = Date.parse(getCreateBody()!.expires_at!) - Date.now();
    expect(diff).toBeGreaterThan(89.5 * DAY_MS);
    expect(diff).toBeLessThan(90.5 * DAY_MS);
  });
});
