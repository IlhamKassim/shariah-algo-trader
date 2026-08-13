import { useCallback, useEffect, useRef, useState } from "react";

import type {
  ActivityResponse,
  AdminApi,
  ComplianceResponse,
  PortfolioResponse,
  Tester,
} from "../lib/api";
import {
  formatCurrency,
  formatDateTime,
  formatRelativeTime,
  formatSignedCurrency,
  stateTone,
  truncateMiddle,
} from "../lib/format";
import { Badge } from "./Badge";

interface TesterDrawerProps {
  tester: Tester;
  api: AdminApi | null;
  onClose: () => void;
}

type Tab = "portfolio" | "compliance" | "activity";

const TABS: { key: Tab; label: string }[] = [
  { key: "portfolio", label: "Portfolio" },
  { key: "compliance", label: "Compliance" },
  { key: "activity", label: "Activity" },
];

const STATE_LABEL: Record<Tester["state"], string> = {
  pending: "Pending",
  active: "Active",
  revoked: "Revoked",
};

interface TabState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function useTabData<T>(fetcher: () => Promise<T>): TabState<T> & { reload: () => void } {
  const [state, setState] = useState<TabState<T>>({ data: null, loading: false, error: null });

  // The fetcher is an inline closure (new identity every render), so it must
  // NOT be an effect dependency — that is what caused the AC-10 infinite
  // fetch loop (setState → re-render → new fetcher → effect re-runs → …).
  // Read it through a ref instead: `load` stays stable for the component's
  // lifetime (one fetch per mount), yet `reload` always calls the freshest
  // closure (Retry still works if props change).
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcherRef
      .current()
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((e: unknown) => {
        const detail = e instanceof Error ? e.message : "Request failed";
        setState((s) => ({ ...s, loading: false, error: detail }));
      });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, reload: load };
}

function TabError({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
      <p>{error}</p>
      <button type="button" onClick={onRetry} className="mt-2 font-medium underline">
        Retry
      </button>
    </div>
  );
}

function PortfolioTab({ api, tester }: { api: AdminApi; tester: Tester }) {
  const { data, loading, error, reload } = useTabData<PortfolioResponse>(() =>
    api.testerPortfolio(tester.user_id),
  );

  if (loading) return <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Loading portfolio…</p>;
  if (error) {
    if (error.toLowerCase().includes("paper credentials")) {
      return (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
          Tester has no Alpaca paper credentials on file yet.
        </div>
      );
    }
    return <TabError error={error} onRetry={reload} />;
  }
  if (!data) return null;

  const account = data.account as Record<string, string | number | null | undefined>;
  const cash = account.cash;
  const buyingPower = account.buying_power;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Equity</div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {formatCurrency(account.equity)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Unrealized P/L</div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {formatSignedCurrency(data.unrealized_pl)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Cash</div>
          <div className="mt-1 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {formatCurrency(cash)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Buying power</div>
          <div className="mt-1 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {formatCurrency(buyingPower)}
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Positions</h3>
        {data.positions.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
            No open positions.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                  <th scope="col" className="px-4 py-2.5 font-medium">Symbol</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Qty</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Market value</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Unrealized P/L</th>
                </tr>
              </thead>
              <tbody>
                {data.positions.map((position) => (
                  <tr key={position.symbol} className="border-b border-slate-100 last:border-0 dark:border-slate-800/60">
                    <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">{position.symbol}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{position.qty}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-900 dark:text-slate-100">
                      {formatCurrency(position.market_value)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-900 dark:text-slate-100">
                      {formatSignedCurrency(position.unrealized_pl)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ComplianceTab({ api, tester }: { api: AdminApi; tester: Tester }) {
  const { data, loading, error, reload } = useTabData<ComplianceResponse>(() =>
    api.testerCompliance(tester.user_id),
  );

  if (loading) return <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Loading compliance…</p>;
  if (error) {
    if (error.toLowerCase().includes("paper credentials")) {
      return (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
          Tester has no Alpaca paper credentials on file yet.
        </div>
      );
    }
    return <TabError error={error} onRetry={reload} />;
  }
  if (!data) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Badge tone={data.compliant ? "green" : "red"}>
          {data.compliant ? "Compliant" : "Violations"}
        </Badge>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          Last checked {data.last_checked ? formatRelativeTime(data.last_checked) : "never"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Held positions</div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">{data.held_count}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Eligible universe</div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">{data.universe_size}</div>
        </div>
      </div>

      {data.violations.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Held outside the eligible universe
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.violations.map((symbol) => (
              <Badge key={symbol} tone="red">{symbol}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ActivityTab({ api, tester }: { api: AdminApi; tester: Tester }) {
  const { data, loading, error, reload } = useTabData<ActivityResponse>(() =>
    api.testerActivity(tester.user_id),
  );

  if (loading) return <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Loading activity…</p>;
  if (error) return <TabError error={error} onRetry={reload} />;
  if (!data) return null;

  if (data.events.length === 0) {
    return (
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
        No activity recorded yet.
      </p>
    );
  }

  return (
    <ol className="space-y-4">
      {data.events.map((event) => (
        <li key={event.id} className="flex gap-3">
          <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-slate-300 dark:bg-slate-600" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{event.event_type}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {formatRelativeTime(event.created_at)}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{event.details}</p>
            <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500" title={event.created_at}>
              {formatDateTime(event.created_at)} · {event.ip_address}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Right-side detail drawer with Portfolio / Compliance / Activity tabs (SPEC §5.3). */
export function TesterDrawer({ tester, api, onClose }: TesterDrawerProps) {
  const [tab, setTab] = useState<Tab>("portfolio");

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`${tester.email} details`}>
      <button type="button" aria-label="Close drawer" onClick={onClose} className="absolute inset-0 bg-slate-900/40" />
      <aside className="animate-drawer-in absolute inset-y-0 right-0 flex w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">{tester.email}</h2>
            <div className="mt-1.5 flex items-center gap-2">
              <Badge tone={stateTone(tester.state)}>{STATE_LABEL[tester.state]}</Badge>
              <span className="text-xs text-slate-400 dark:text-slate-500" title={tester.user_id}>
                {truncateMiddle(tester.user_id)}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex gap-1 border-b border-slate-200 px-4 dark:border-slate-800" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                tab === t.key
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {!api ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Not signed in.</p>
          ) : (
            <>
              {tab === "portfolio" && <PortfolioTab api={api} tester={tester} />}
              {tab === "compliance" && <ComplianceTab api={api} tester={tester} />}
              {tab === "activity" && <ActivityTab api={api} tester={tester} />}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
