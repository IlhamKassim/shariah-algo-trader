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
    <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
      <p>{error}</p>
      <button type="button" onClick={onRetry} className="mt-2 font-medium underline">
        Retry
      </button>
    </div>
  );
}

const EMPTY_STATE_CLASSES = "rounded-lg border border-white/10 bg-white/[0.03] text-center text-sm text-muted";
const STAT_LABEL_CLASSES = "font-mono text-[10px] uppercase tracking-[0.08em] text-muted";
const STAT_VALUE_CLASSES = "mt-1 font-mono tabular-nums text-primary";

function PortfolioTab({ api, tester }: { api: AdminApi; tester: Tester }) {
  const { data, loading, error, reload } = useTabData<PortfolioResponse>(() =>
    api.testerPortfolio(tester.user_id),
  );

  if (loading) return <p className="py-10 text-center text-sm text-muted">Loading portfolio…</p>;
  if (error) {
    if (error.toLowerCase().includes("paper credentials")) {
      return (
        <div className={`px-4 py-8 ${EMPTY_STATE_CLASSES}`}>
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
        <div className="glass-panel rounded-xl p-4">
          <div className={STAT_LABEL_CLASSES}>Equity</div>
          <div className={`text-xl font-semibold ${STAT_VALUE_CLASSES}`}>
            {formatCurrency(account.equity)}
          </div>
        </div>
        <div className="glass-panel rounded-xl p-4">
          <div className={STAT_LABEL_CLASSES}>Unrealized P/L</div>
          <div className={`text-xl font-semibold ${STAT_VALUE_CLASSES}`}>
            {formatSignedCurrency(data.unrealized_pl)}
          </div>
        </div>
        <div className="glass-panel rounded-xl p-4">
          <div className={STAT_LABEL_CLASSES}>Cash</div>
          <div className={`text-lg font-semibold ${STAT_VALUE_CLASSES}`}>
            {formatCurrency(cash)}
          </div>
        </div>
        <div className="glass-panel rounded-xl p-4">
          <div className={STAT_LABEL_CLASSES}>Buying power</div>
          <div className={`text-lg font-semibold ${STAT_VALUE_CLASSES}`}>
            {formatCurrency(buyingPower)}
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-2 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-primary">Positions</h3>
        {data.positions.length === 0 ? (
          <p className={`px-4 py-6 ${EMPTY_STATE_CLASSES}`}>
            No open positions.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
                  <th scope="col" className="px-4 py-2.5 font-semibold">Symbol</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Qty</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Market value</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Unrealized P/L</th>
                </tr>
              </thead>
              <tbody>
                {data.positions.map((position) => (
                  <tr key={position.symbol} className="border-b border-white/10 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-primary">{position.symbol}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-muted">{position.qty}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-primary">
                      {formatCurrency(position.market_value)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-primary">
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

  if (loading) return <p className="py-10 text-center text-sm text-muted">Loading compliance…</p>;
  if (error) {
    if (error.toLowerCase().includes("paper credentials")) {
      return (
        <div className={`px-4 py-8 ${EMPTY_STATE_CLASSES}`}>
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
        <span className="text-sm text-muted">
          Last checked {data.last_checked ? formatRelativeTime(data.last_checked) : "never"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="glass-panel rounded-xl p-4">
          <div className={STAT_LABEL_CLASSES}>Held positions</div>
          <div className={`text-xl font-semibold ${STAT_VALUE_CLASSES}`}>{data.held_count}</div>
        </div>
        <div className="glass-panel rounded-xl p-4">
          <div className={STAT_LABEL_CLASSES}>Eligible universe</div>
          <div className={`text-xl font-semibold ${STAT_VALUE_CLASSES}`}>{data.universe_size}</div>
        </div>
      </div>

      {data.violations.length > 0 && (
        <div>
          <h3 className="mb-2 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-primary">
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

  if (loading) return <p className="py-10 text-center text-sm text-muted">Loading activity…</p>;
  if (error) return <TabError error={error} onRetry={reload} />;
  if (!data) return null;

  if (data.events.length === 0) {
    return (
      <p className={`px-4 py-8 ${EMPTY_STATE_CLASSES}`}>
        No activity recorded yet.
      </p>
    );
  }

  return (
    <ol className="space-y-4">
      {data.events.map((event) => (
        <li key={event.id} className="flex gap-3">
          <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-400/70" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-primary">{event.event_type}</span>
              <span className="font-mono text-xs text-faint">
                {formatRelativeTime(event.created_at)}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-muted">{event.details}</p>
            <p className="mt-0.5 font-mono text-xs text-faint" title={event.created_at}>
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
      <button type="button" aria-label="Close drawer" onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <aside className="animate-drawer-in glass-panel absolute inset-y-0 right-0 flex w-full max-w-lg flex-col rounded-l-2xl shadow-2xl">
        <div className="flex items-start justify-between border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-primary">{tester.email}</h2>
            <div className="mt-1.5 flex items-center gap-2">
              <Badge tone={stateTone(tester.state)}>{STATE_LABEL[tester.state]}</Badge>
              <span className="font-mono text-xs text-faint" title={tester.user_id}>
                {truncateMiddle(tester.user_id)}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-muted transition hover:bg-white/5 hover:text-primary"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex gap-1 border-b border-white/10 px-4" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`-mb-px border-b-2 px-3 py-2.5 text-[12px] font-medium transition ${
                tab === t.key
                  ? "border-brand-gold text-brand-gold"
                  : "border-transparent text-muted hover:text-primary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {!api ? (
            <p className="text-sm text-muted">Not signed in.</p>
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
