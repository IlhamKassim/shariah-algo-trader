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

const INPUT_CLASSES =
  "rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-primary shadow-sm outline-none transition placeholder:text-faint focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30";

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
        <h1 className="text-[15px] font-semibold leading-tight text-primary">Invites</h1>
        <p className="mt-0.5 text-[11px] leading-tight text-muted">
          Single-use invite links for beta testers. The link opens the signup flow
          with the code pre-filled.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
        >
          {error}
        </div>
      )}

      <div className="glass-panel mb-6 rounded-2xl p-5">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-primary">
          Create invite
        </h2>
        <form onSubmit={create} className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="max-uses" className="mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
              Max uses
            </label>
            <input
              id="max-uses"
              type="number"
              min={1}
              value={maxUses}
              onChange={(e) => setMaxUses(Math.max(1, Number(e.target.value) || 1))}
              className={`w-24 ${INPUT_CLASSES}`}
            />
          </div>
          <div>
            <label htmlFor="expiry" className="mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
              Expiry
            </label>
            <select
              id="expiry"
              value={expiry ?? "never"}
              onChange={(e) => {
                const option = expiryOptions.find((o) => (o.value ?? "never") === e.target.value);
                setExpiry(option ? option.value : null);
              }}
              className={INPUT_CLASSES}
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
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_20px_rgba(99,102,241,0.4)] transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create invite"}
          </button>
        </form>

        {fresh && (
          <div className="mt-5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-300">
                  Invite created
                </div>
                <div className="mt-1 truncate font-mono text-sm font-semibold text-emerald-200">
                  {fresh.code}
                </div>
                <div className="mt-0.5 truncate font-mono text-xs text-muted">
                  {inviteLink(fresh.code)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void copy(fresh.code)}
                className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
              >
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
            <p className="mt-2 text-xs text-muted">
              Send this link to the recruit — it expires {formatRelativeTime(fresh.expires_at)} and can be
              used {fresh.max_uses} time{fresh.max_uses === 1 ? "" : "s"}.
            </p>
          </div>
        )}
      </div>

      <div className="glass-panel overflow-hidden rounded-2xl">
        <div className="border-b border-white/10 px-5 py-4">
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-primary">All invites</span>
        </div>
        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-muted">Loading invites…</div>
        ) : invites.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted">
            No invites yet. Create your first one above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
                  <th scope="col" className="px-5 py-3 font-semibold">Code</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Uses</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Expires</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Created</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Link</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((invite) => (
                  <tr
                    key={invite.code}
                    className="border-b border-white/10 transition last:border-0 hover:bg-white/[0.03]"
                  >
                    <td className="px-5 py-3 font-mono text-sm text-primary">{invite.code}</td>
                    <td className="px-4 py-3">
                      <Badge tone={invite.expired ? "red" : invite.uses >= invite.max_uses ? "amber" : "green"}>
                        {invite.expired ? "Expired" : invite.uses >= invite.max_uses ? "Used up" : "Active"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-muted">
                      {invite.uses} / {invite.max_uses}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">
                      {invite.expires_at ? formatDateTime(invite.expires_at) : "Never"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">{formatDateTime(invite.created_at)}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void copy(invite.code)}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-muted transition hover:border-white/20 hover:text-primary"
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
