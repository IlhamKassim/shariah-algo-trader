import { useCallback, useEffect, useState, type FormEvent } from "react";

import type { AdminApi, Invite } from "../lib/api";
import { formatDateTime, formatRelativeTime, inviteLink } from "../lib/format";
import { Badge } from "./Badge";

interface InvitesViewProps {
  api: AdminApi | null;
}

interface ExpiryOption {
  label: string;
  value: string | null; // ISO-8601 absolute, or null for the backend default (30 days)
}

function buildExpiryOptions(now: number): ExpiryOption[] {
  const days = (n: number) => new Date(now + n * 86_400_000).toISOString();
  return [
    { label: "7 days", value: days(7) },
    { label: "30 days (default)", value: days(30) },
    { label: "90 days", value: days(90) },
    { label: "Never", value: null },
  ];
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Non-secure contexts (plain Tailscale http) fall back to execCommand.
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  }
}

export function InvitesView({ api }: InvitesViewProps) {
  // The four expiry ISOs are computed ONCE per mount and reused for both the
  // <select> options and the onChange lookup. Recomputing per render made the
  // state-held ISO never match a rendered option (selector lied about the
  // selection and every 7/90-day choice fell back to the 30-day default).
  const [expiryOptions] = useState<ExpiryOption[]>(() => buildExpiryOptions(Date.now()));
  const [maxUses, setMaxUses] = useState(1);
  const [expiry, setExpiry] = useState<string | null>(() => expiryOptions[1].value);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<Invite | null>(null);
  const [copied, setCopied] = useState(false);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.listInvites();
      setInvites(data.invites);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load invites");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!api) return;
    setCreating(true);
    setError(null);
    setCopied(false);
    try {
      const invite = await api.createInvite({ max_uses: maxUses, expires_at: expiry });
      setFresh(invite);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invite");
    } finally {
      setCreating(false);
    }
  };

  const copy = async (code: string) => {
    const ok = await copyText(inviteLink(code));
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <section>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Invites</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Single-use invite links for beta testers. The link opens the signup flow
          with the code pre-filled.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
        >
          {error}
        </div>
      )}

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Create invite</h2>
        <form onSubmit={create} className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="max-uses" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Max uses
            </label>
            <input
              id="max-uses"
              type="number"
              min={1}
              value={maxUses}
              onChange={(e) => setMaxUses(Math.max(1, Number(e.target.value) || 1))}
              className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label htmlFor="expiry" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Expiry
            </label>
            <select
              id="expiry"
              value={expiry ?? "never"}
              onChange={(e) => {
                const option = expiryOptions.find((o) => (o.value ?? "never") === e.target.value);
                setExpiry(option ? option.value : null);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {expiryOptions.map((option) => (
                <option key={option.label} value={option.value ?? "never"}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create invite"}
          </button>
        </form>

        {fresh && (
          <div className="mt-5 rounded-xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-500/30 dark:bg-indigo-500/10">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-medium uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                  Invite created
                </div>
                <div className="mt-1 truncate font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {fresh.code}
                </div>
                <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                  {inviteLink(fresh.code)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void copy(fresh.code)}
                className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500"
              >
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Send this link to the recruit — it expires {formatRelativeTime(fresh.expires_at)} and can be
              used {fresh.max_uses} time{fresh.max_uses === 1 ? "" : "s"}.
            </p>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <span className="text-sm font-medium">All invites</span>
        </div>
        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">Loading invites…</div>
        ) : invites.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            No invites yet. Create your first one above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th scope="col" className="px-5 py-3 font-medium">Code</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Uses</th>
                  <th scope="col" className="px-4 py-3 font-medium">Expires</th>
                  <th scope="col" className="px-4 py-3 font-medium">Created</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">Link</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((invite) => (
                  <tr
                    key={invite.code}
                    className="border-b border-slate-100 last:border-0 dark:border-slate-800/60"
                  >
                    <td className="px-5 py-3 font-mono text-slate-900 dark:text-slate-100">{invite.code}</td>
                    <td className="px-4 py-3">
                      <Badge tone={invite.expired ? "red" : invite.uses >= invite.max_uses ? "amber" : "green"}>
                        {invite.expired ? "Expired" : invite.uses >= invite.max_uses ? "Used up" : "Active"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                      {invite.uses} / {invite.max_uses}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {invite.expires_at ? formatDateTime(invite.expires_at) : "Never"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatDateTime(invite.created_at)}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void copy(invite.code)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        Copy
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
