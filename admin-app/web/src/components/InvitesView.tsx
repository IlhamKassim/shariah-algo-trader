import React, { useCallback, useEffect, useState, type FormEvent } from "react";
import type { AdminApi, Invite } from "../lib/api";
import { formatDateTime, formatRelativeTime, inviteLink } from "../lib/format";

interface InvitesViewProps {
  api: AdminApi | null;
}

interface ExpiryOption {
  label: string;
  value: string | null;
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
    <section className="space-y-6 animate-fadeIn">
      {/* Title */}
      <div className="flex justify-between items-end border-b-2 border-[#333333] pb-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-[#ffffff] uppercase tracking-wider">
            Pilot Invites
          </h2>
          <p className="text-xs font-body text-secondary-fixed-dim mt-1 font-bold uppercase tracking-widest">
            Single-use or multi-use recruitment tokens for beta testers
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="border-2 border-[#ba1a1a] bg-[#ba1a1a]/10 px-4 py-3 text-xs font-mono text-[#ffdad6]"
        >
          {error}
        </div>
      )}

      {/* Creation Box */}
      <div className="bg-[#1a1918] border-2 border-[#333333] p-6 space-y-4">
        <h3 className="font-headline text-sm font-bold uppercase tracking-wider text-[#ffffff]">
          Create Invite
        </h3>
        <form onSubmit={create} className="flex flex-wrap items-end gap-4">
          <div>
            <label
              htmlFor="max-uses"
              className="mb-1 block text-[10px] font-mono font-bold uppercase tracking-widest text-secondary-fixed-dim"
            >
              Max uses
            </label>
            <input
              id="max-uses"
              type="number"
              min={1}
              value={maxUses}
              onChange={(e) => setMaxUses(Math.max(1, Number(e.target.value) || 1))}
              className="w-28 bg-[#0a0a0a] border-2 border-[#333333] px-3 py-2 text-xs font-mono text-[#ffffff] outline-none focus:border-[#ffffff]"
            />
          </div>

          <div>
            <label
              htmlFor="expiry"
              className="mb-1 block text-[10px] font-mono font-bold uppercase tracking-widest text-secondary-fixed-dim"
            >
              Expiry
            </label>
            <select
              id="expiry"
              value={expiry ?? "never"}
              onChange={(e) => {
                const option = expiryOptions.find((o) => (o.value ?? "never") === e.target.value);
                setExpiry(option ? option.value : null);
              }}
              className="bg-[#0a0a0a] border-2 border-[#333333] px-3 py-2 text-xs font-mono text-[#ffffff] outline-none focus:border-[#ffffff]"
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
            className="bg-[#f2f0f1] text-[#0a0a0a] border-2 border-[#f2f0f1] px-5 py-2 text-xs font-label font-bold uppercase tracking-widest hover:bg-[#d1d1d1] transition-none disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create invite"}
          </button>
        </form>

        {fresh && (
          <div className="mt-4 border-2 border-[#10b981] bg-[#10b981]/10 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#10b981]">
                  Invite created
                </div>
                <div className="text-base font-mono font-bold text-[#ffffff] mt-0.5">
                  {fresh.code}
                </div>
                <div className="text-xs font-mono text-secondary-fixed-dim truncate mt-0.5">
                  {inviteLink(fresh.code)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void copy(fresh.code)}
                className="self-start sm:self-auto bg-[#10b981] text-[#0a0a0a] border-2 border-[#10b981] px-4 py-1.5 text-xs font-label font-bold uppercase tracking-widest hover:bg-[#059669]"
              >
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
            <p className="mt-2 text-[11px] font-mono text-secondary-fixed-dim">
              Expires {formatRelativeTime(fresh.expires_at)} · Valid for {fresh.max_uses} use
              {fresh.max_uses === 1 ? "" : "s"}.
            </p>
          </div>
        )}
      </div>

      {/* Invites Table */}
      <div className="bg-[#1a1918] border-2 border-[#333333] p-6 space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-xs font-label font-bold uppercase tracking-widest text-[#f2f0f1]">
            All invites ({invites.length})
          </h3>
        </div>

        <div className="data-grid grid-cols-6 border-2 border-[#333333]">
          {/* Header */}
          <div className="data-grid-header">Code</div>
          <div className="data-grid-header text-center">Status</div>
          <div className="data-grid-header text-right">Uses</div>
          <div className="data-grid-header">Expires</div>
          <div className="data-grid-header">Created</div>
          <div className="data-grid-header text-right">Action</div>

          {/* Rows */}
          {loading ? (
            <div className="col-span-6 p-8 text-center text-xs font-mono text-secondary-fixed-dim">
              Loading invites…
            </div>
          ) : invites.length === 0 ? (
            <div className="col-span-6 p-8 text-center text-xs font-mono text-secondary-fixed-dim">
              No invites yet. Create your first one above.
            </div>
          ) : (
            invites.map((inv) => (
              <React.Fragment key={inv.code}>
                <div className="text-xs font-mono font-bold text-[#ffffff] truncate bg-[#1a1918]">
                  {inv.code}
                </div>
                <div className="text-center bg-[#1a1918]">
                  <span
                    className={`px-2 py-0.5 border border-[#333333] text-[9px] font-bold uppercase tracking-wider ${
                      inv.expired
                        ? "bg-[#0a0a0a] text-[#ba1a1a]"
                        : inv.uses >= inv.max_uses
                        ? "bg-[#0a0a0a] text-[#f59e0b]"
                        : "bg-[#0a0a0a] text-[#10b981]"
                    }`}
                  >
                    {inv.expired ? "Expired" : inv.uses >= inv.max_uses ? "Used up" : "Active"}
                  </span>
                </div>
                <div className="text-xs font-mono text-right text-[#f2f0f1] bg-[#1a1918]">
                  {inv.uses} / {inv.max_uses}
                </div>
                <div className="text-[11px] font-mono text-secondary-fixed-dim truncate bg-[#1a1918]">
                  {inv.expires_at ? formatDateTime(inv.expires_at) : "Never"}
                </div>
                <div className="text-[11px] font-mono text-secondary-fixed-dim truncate bg-[#1a1918]">
                  {formatDateTime(inv.created_at)}
                </div>
                <div className="text-right bg-[#1a1918]">
                  <button
                    type="button"
                    onClick={() => void copy(inv.code)}
                    className="border-2 border-[#333333] bg-[#242322] px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase text-[#f2f0f1] hover:bg-[#333333]"
                  >
                    Copy
                  </button>
                </div>
              </React.Fragment>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
