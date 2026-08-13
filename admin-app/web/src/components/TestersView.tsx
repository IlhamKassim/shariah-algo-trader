import { useEffect, useRef, useState } from "react";

import type { AdminApi, Tester } from "../lib/api";
import { formatCurrency, formatRelativeTime, keysTone, stateTone, truncateMiddle } from "../lib/format";
import { Badge } from "./Badge";
import { ConfirmDialog } from "./ConfirmDialog";

interface TestersViewProps {
  testers: Tester[];
  loading: boolean;
  error: string | null;
  busyId: string | null;
  api: AdminApi | null;
  onApprove: (tester: Tester) => void;
  onRevoke: (tester: Tester) => void;
  onSelect: (tester: Tester) => void;
}

interface PendingAction {
  tester: Tester;
  action: "approve" | "revoke";
}

const STATE_LABEL: Record<Tester["state"], string> = {
  pending: "Pending",
  active: "Active",
  revoked: "Revoked",
};

/**
 * Lazy per-tester paper equity (A4), fetched only for testers with paper keys
 * on file. The A1 list deliberately carries no equity — the table gets it from
 * the per-tester portfolio endpoint and never blocks the list render on it.
 */
function useEquities(testers: Tester[], api: AdminApi | null): Record<string, string> {
  const [equities, setEquities] = useState<Record<string, string>>({});
  const fetched = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!api) return;
    const targets = testers.filter((t) => t.has_paper_keys && !fetched.current.has(t.user_id));
    if (targets.length === 0) return;
    targets.forEach((t) => fetched.current.add(t.user_id));
    targets.forEach((t) => {
      api
        .testerPortfolio(t.user_id)
        .then((portfolio) => {
          setEquities((prev) => ({ ...prev, [t.user_id]: String(portfolio.account.equity) }));
        })
        .catch(() => {
          // 409/502 (no creds / Alpaca down) — column shows the dash, row still usable
        });
    });
  }, [testers, api]);

  return equities;
}

export function TestersView({
  testers,
  loading,
  error,
  busyId,
  api,
  onApprove,
  onRevoke,
  onSelect,
}: TestersViewProps) {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const equities = useEquities(testers, api);

  const confirm = async () => {
    if (!pending) return;
    const { tester, action } = pending;
    setPending(null);
    if (action === "approve") onApprove(tester);
    else onRevoke(tester);
  };

  return (
    <section>
      <div className="mb-6">
        <h1 className="text-[15px] font-semibold leading-tight text-primary">Testers</h1>
        <p className="mt-0.5 text-[11px] leading-tight text-muted">
          Beta pilot tester lifecycle — approve, revoke and inspect paper portfolios.
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

      <div className="glass-panel overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
                <th scope="col" className="px-5 py-3 font-semibold">
                  Tester
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  State
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Keys
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Equity
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Last activity
                </th>
                <th scope="col" className="px-5 py-3 text-right font-semibold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {testers.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-sm text-muted">
                    No testers yet. Create an invite to get started.
                  </td>
                </tr>
              )}
              {testers.map((tester) => (
                <tr
                  key={tester.user_id}
                  onClick={() => onSelect(tester)}
                  className="cursor-pointer border-b border-white/10 transition last:border-0 hover:bg-white/[0.03]"
                >
                  <td className="px-5 py-3">
                    <div className="font-medium text-primary">{tester.email}</div>
                    <div className="mt-0.5 font-mono text-xs text-faint" title={tester.user_id}>
                      {truncateMiddle(tester.user_id)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={stateTone(tester.state)}>{STATE_LABEL[tester.state]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={keysTone(tester.has_paper_keys)}>
                      {tester.has_paper_keys ? "Paper" : "No keys"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-primary">
                    {equities[tester.user_id] ? formatCurrency(equities[tester.user_id]) : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {formatRelativeTime(tester.last_activity_at)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {tester.state === "pending" && (
                        <button
                          type="button"
                          disabled={busyId === tester.user_id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPending({ tester, action: "approve" });
                          }}
                          className="rounded-lg bg-brand-green px-3 py-1.5 text-sm font-semibold text-page shadow-sm transition hover:brightness-110 disabled:opacity-50"
                        >
                          Approve
                        </button>
                      )}
                      {tester.state === "active" && (
                        <button
                          type="button"
                          disabled={busyId === tester.user_id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPending({ tester, action: "revoke" });
                          }}
                          className="rounded-lg border border-rose-500/40 px-3 py-1.5 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/10 disabled:opacity-50"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading && (
          <div className="border-t border-white/10 px-5 py-4 text-sm text-muted">
            Refreshing…
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={pending?.action === "approve" ? "Approve tester?" : "Revoke tester?"}
        message={
          pending ? (
            <>
              <span className="font-medium text-primary">{pending.tester.email}</span>
              {pending.action === "approve"
                ? " will become active and the engine will start trading their paper account on the next cycle."
                : " will be revoked — engine trading stops on the next cycle. Their settings and keys are kept."}
            </>
          ) : null
        }
        confirmLabel={pending?.action === "approve" ? "Approve" : "Revoke"}
        destructive={pending?.action === "revoke"}
        busy={pending !== null && busyId === pending.tester.user_id}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      />
    </section>
  );
}
