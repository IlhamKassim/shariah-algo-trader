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
        <h1 className="text-xl font-semibold tracking-tight">Testers</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Beta pilot tester lifecycle — approve, revoke and inspect paper portfolios.
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

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th scope="col" className="px-5 py-3 font-medium">
                  Tester
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  State
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Keys
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Equity
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Last activity
                </th>
                <th scope="col" className="px-5 py-3 text-right font-medium">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {testers.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-sm text-slate-500 dark:text-slate-400">
                    No testers yet. Create an invite to get started.
                  </td>
                </tr>
              )}
              {testers.map((tester) => (
                <tr
                  key={tester.user_id}
                  onClick={() => onSelect(tester)}
                  className="cursor-pointer border-b border-slate-100 transition last:border-0 hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/40"
                >
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-900 dark:text-slate-100">{tester.email}</div>
                    <div className="mt-0.5 text-xs text-slate-400 dark:text-slate-500" title={tester.user_id}>
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
                  <td className="px-4 py-3 text-right tabular-nums text-slate-900 dark:text-slate-100">
                    {equities[tester.user_id] ? formatCurrency(equities[tester.user_id]) : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
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
                          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-50"
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
                          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 shadow-sm transition hover:bg-red-50 disabled:opacity-50 dark:border-red-500/30 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-500/10"
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
          <div className="border-t border-slate-200 px-5 py-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
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
              <span className="font-medium text-slate-900 dark:text-slate-100">{pending.tester.email}</span>
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
