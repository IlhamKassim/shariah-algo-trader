import React, { useCallback, useEffect, useRef, useState } from "react";
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
  truncateMiddle,
} from "../lib/format";

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

interface TabState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function useTabData<T>(fetcher: () => Promise<T>): TabState<T> & { reload: () => void } {
  const [state, setState] = useState<TabState<T>>({ data: null, loading: false, error: null });

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
    <div className="border-2 border-[#ba1a1a] bg-[#ba1a1a]/10 p-4 text-xs font-mono text-[#ffdad6]">
      <p>{error}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 text-xs font-bold uppercase underline"
      >
        Retry
      </button>
    </div>
  );
}

const EMPTY_STATE_CLASSES =
  "border-2 border-[#333333] bg-[#0a0a0a] text-center text-xs font-mono text-secondary-fixed-dim";

function PortfolioTab({ api, tester }: { api: AdminApi; tester: Tester }) {
  const { data, loading, error, reload } = useTabData<PortfolioResponse>(() =>
    api.testerPortfolio(tester.user_id),
  );

  if (loading) {
    return <p className="py-10 text-center text-xs font-mono text-secondary-fixed-dim">Loading portfolio…</p>;
  }
  if (error) {
    if (error.toLowerCase().includes("paper credentials")) {
      return (
        <div className={`p-8 ${EMPTY_STATE_CLASSES}`}>
          Tester has no Alpaca paper credentials on file yet.
        </div>
      );
    }
    return <TabError error={error} onRetry={reload} />;
  }
  if (!data) return null;

  const account = data.account as Record<string, string | number | null | undefined>;

  return (
    <div className="space-y-6">
      {/* Account KPI Grid */}
      <div className="data-grid grid-cols-2">
        <div>
          <div className="text-[10px] font-mono text-secondary-fixed-dim uppercase tracking-wider">
            Equity
          </div>
          <div className="text-xl font-headline font-bold text-[#ffffff] mt-1">
            {formatCurrency(account.equity)}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-mono text-secondary-fixed-dim uppercase tracking-wider">
            Unrealized P/L
          </div>
          <div className="text-xl font-headline font-bold text-[#10b981] mt-1">
            {formatSignedCurrency(data.unrealized_pl)}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-mono text-secondary-fixed-dim uppercase tracking-wider">
            Cash
          </div>
          <div className="text-base font-headline font-bold text-[#ffffff] mt-1">
            {formatCurrency(account.cash)}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-mono text-secondary-fixed-dim uppercase tracking-wider">
            Buying power
          </div>
          <div className="text-base font-headline font-bold text-[#ffffff] mt-1">
            {formatCurrency(account.buying_power)}
          </div>
        </div>
      </div>

      {/* Positions Table */}
      <div className="space-y-3">
        <h3 className="font-label text-xs font-bold uppercase tracking-widest text-[#f2f0f1]">
          Open Positions ({data.positions.length})
        </h3>
        {data.positions.length === 0 ? (
          <div className={`p-6 ${EMPTY_STATE_CLASSES}`}>No open positions.</div>
        ) : (
          <div className="data-grid grid-cols-4 border-2 border-[#333333]">
            <div className="data-grid-header">Symbol</div>
            <div className="data-grid-header text-right">Qty</div>
            <div className="data-grid-header text-right">Market value</div>
            <div className="data-grid-header text-right">Unrealized P/L</div>

            {data.positions.map((pos) => (
              <React.Fragment key={pos.symbol}>
                <div className="text-xs font-mono font-bold text-[#ffffff] bg-[#1a1918]">
                  {pos.symbol}
                </div>
                <div className="text-xs font-mono text-right text-secondary-fixed-dim bg-[#1a1918]">
                  {pos.qty}
                </div>
                <div className="text-xs font-mono text-right text-[#ffffff] bg-[#1a1918]">
                  {formatCurrency(pos.market_value)}
                </div>
                <div className="text-xs font-mono text-right text-[#10b981] bg-[#1a1918]">
                  {formatSignedCurrency(pos.unrealized_pl)}
                </div>
              </React.Fragment>
            ))}
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

  if (loading) {
    return <p className="py-10 text-center text-xs font-mono text-secondary-fixed-dim">Loading compliance…</p>;
  }
  if (error) {
    if (error.toLowerCase().includes("paper credentials")) {
      return (
        <div className={`p-8 ${EMPTY_STATE_CLASSES}`}>
          Tester has no Alpaca paper credentials on file yet.
        </div>
      );
    }
    return <TabError error={error} onRetry={reload} />;
  }
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-2 border-[#333333] p-4 bg-[#242322]">
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 text-xs font-mono font-bold uppercase border ${
              data.compliant
                ? "bg-[#0a0a0a] text-[#10b981] border-[#10b981]"
                : "bg-[#0a0a0a] text-[#ba1a1a] border-[#ba1a1a]"
            }`}
          >
            {data.compliant ? "Compliant" : "Violations"}
          </span>
        </div>
        <span className="text-[10px] font-mono text-secondary-fixed-dim">
          Last checked {data.last_checked ? formatRelativeTime(data.last_checked) : "never"}
        </span>
      </div>

      <div className="data-grid grid-cols-2">
        <div>
          <div className="text-[10px] font-mono text-secondary-fixed-dim uppercase tracking-wider">
            Held positions
          </div>
          <div className="text-xl font-headline font-bold text-[#ffffff] mt-1">
            {data.held_count}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-mono text-secondary-fixed-dim uppercase tracking-wider">
            Eligible universe
          </div>
          <div className="text-xl font-headline font-bold text-[#ffffff] mt-1">
            {data.universe_size}
          </div>
        </div>
      </div>

      {data.violations.length > 0 && (
        <div className="border-2 border-[#ba1a1a] bg-[#ba1a1a]/10 p-4 space-y-2">
          <h3 className="font-label text-xs font-bold uppercase tracking-widest text-[#ffdad6]">
            Held outside the eligible universe
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.violations.map((sym) => (
              <span
                key={sym}
                className="px-2 py-0.5 bg-[#ba1a1a] text-white text-xs font-mono font-bold uppercase"
              >
                {sym}
              </span>
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

  if (loading) {
    return <p className="py-10 text-center text-xs font-mono text-secondary-fixed-dim">Loading activity…</p>;
  }
  if (error) return <TabError error={error} onRetry={reload} />;
  if (!data) return null;

  if (data.events.length === 0) {
    return <div className={`p-8 ${EMPTY_STATE_CLASSES}`}>No activity recorded yet.</div>;
  }

  return (
    <div className="data-grid grid-cols-1 border-2 border-[#333333]">
      {data.events.map((ev) => (
        <div key={ev.id} className="bg-[#1a1918] p-3 space-y-1">
          <div className="flex justify-between items-baseline border-b border-[#333333] pb-1">
            <span className="text-xs font-mono font-bold text-[#f9e37a] uppercase">
              {ev.event_type}
            </span>
            <span className="text-[9px] font-mono text-secondary-fixed-dim">
              {formatDateTime(ev.created_at)}
            </span>
          </div>
          <p className="text-xs font-mono text-[#f2f0f1] leading-relaxed pt-1">{ev.details}</p>
          <p className="text-[10px] font-mono text-secondary-fixed-dim">IP: {ev.ip_address}</p>
        </div>
      ))}
    </div>
  );
}

export function TesterDrawer({ tester, api, onClose }: TesterDrawerProps) {
  const [tab, setTab] = useState<Tab>("portfolio");
  const custId = tester.user_id.replace(/-/g, "").slice(0, 8).toUpperCase();

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={`${tester.email} details`}
    >
      <button
        type="button"
        aria-label="Close drawer"
        onClick={onClose}
        className="fixed inset-0 bg-black/80 transition-opacity"
      />

      <aside className="animate-drawer-in relative z-10 w-full max-w-xl bg-[#1a1918] border-l-2 border-[#333333] flex flex-col h-full shadow-2xl">
        {/* Drawer Header */}
        <div className="flex items-start justify-between border-b-2 border-[#333333] bg-[#242322] px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-headline font-bold text-[#ffffff] uppercase tracking-wider">
                {tester.first_name || tester.last_name
                  ? `${tester.first_name ?? ""} ${tester.last_name ?? ""}`.trim()
                  : tester.email}
              </h2>
              {tester.quant_handle && (
                <span className="text-xs font-mono text-[#10b981] font-bold">
                  {tester.quant_handle}
                </span>
              )}
            </div>
            <p className="text-xs font-mono text-secondary-fixed-dim mt-0.5">
              {tester.email}
            </p>
            <div className="mt-1.5 flex items-center gap-2 font-mono text-[10px] text-secondary-fixed-dim">
              <span>CUST_ID: <strong className="text-[#3366cc]">{custId}</strong></span>
              {tester.country && (
                <>
                  <span>·</span>
                  <span className="text-[#f9e37a] uppercase">{tester.country}</span>
                </>
              )}
              {tester.investor_type && (
                <>
                  <span>·</span>
                  <span className="text-[#ffffff] uppercase">{tester.investor_type.replace("_", " ")}</span>
                </>
              )}
              <span>·</span>
              <span className="uppercase text-[#10b981]">{tester.state}</span>
              <span>·</span>
              <span title={tester.user_id}>{truncateMiddle(tester.user_id)}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-secondary-fixed-dim hover:text-white p-1 font-mono text-lg"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b-2 border-[#333333] bg-[#0a0a0a]" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2.5 text-xs font-mono font-bold uppercase tracking-wider border-r-2 border-[#333333] last:border-r-0 transition-none ${
                tab === t.key
                  ? "bg-[#1a1918] text-[#ffffff] border-b-2 border-b-transparent"
                  : "text-secondary-fixed-dim hover:bg-[#242322]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="custom-scrollbar flex-1 overflow-y-auto p-6">
          {!api ? (
            <p className="text-xs font-mono text-secondary-fixed-dim">Not authenticated.</p>
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
