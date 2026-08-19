import { Fragment, useCallback, useEffect, useState } from "react";

import {
  ApiError,
  type AdminApi,
  type SpectateAccountResponse,
  type SpectateComplianceResponse,
  type SpectatePosition,
  type SpectateStatusResponse,
  type SpectateStockScore,
  type SpectateUniverseResponse,
} from "../lib/api";
import { formatCurrency, formatRelativeTime, formatSignedCurrency } from "../lib/format";

const GLANCE_INTERVAL_MS = 30_000;

interface SpectateViewProps {
  api: AdminApi | null;
  email: string | null;
}

interface SectionState<T> {
  data: T | null;
  unreachable: boolean;
  loading: boolean;
}

const idle = <T,>(): SectionState<T> => ({ data: null, unreachable: false, loading: true });

function isUnreachable(e: unknown): boolean {
  return e instanceof ApiError && e.status === 502;
}

function brokerHost(brokerUrl: string): string {
  try {
    return new URL(brokerUrl).hostname;
  } catch {
    return brokerUrl;
  }
}

/** The zeroed "Connect Alpaca API in Settings" payload — a real $0 account is
 *  indistinguishable from an unconnected one by the numbers alone, so the
 *  fee_status_label is the authoritative "not connected" signal. */
function isZeroedAccount(account: SpectateAccountResponse): boolean {
  const zeroStats =
    account.equity === 0 &&
    account.cash === 0 &&
    account.buying_power === 0 &&
    account.portfolio_value === 0 &&
    account.dayl_pl === 0 &&
    account.dayl_pl_pct === 0;
  const label = account.fee_status_label ?? "";
  return zeroStats && label !== "" && label !== "Ultra-Low Drag (<0.05%)";
}

function signedPct(value: number): string {
  if (value === 0) return "0.00%";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

/**
 * Spectate view (SPEC-ADMIN-SPECTATE.md §3.3) — engine health, founder
 * reference account and universe, at a glance. All data comes from the
 * read-only admin spectate proxy S1-S5; a 502 (dashboard down) renders an
 * inline "dashboard unreachable" card per section and never crashes the app.
 */
export function SpectateView({ api, email }: SpectateViewProps) {
  const [status, setStatus] = useState<SectionState<SpectateStatusResponse>>(idle);
  const [account, setAccount] = useState<SectionState<SpectateAccountResponse>>(idle);
  const [positions, setPositions] = useState<SectionState<SpectatePosition[]>>(idle);
  const [compliance, setCompliance] = useState<SectionState<SpectateComplianceResponse>>(idle);
  const [universe, setUniverse] = useState<SectionState<SpectateUniverseResponse>>(idle);

  const load = useCallback(
    async <T,>(fn: () => Promise<T>, set: (s: SectionState<T>) => void) => {
      if (!api) return;
      set({ data: null, unreachable: false, loading: true });
      try {
        set({ data: await fn(), unreachable: false, loading: false });
      } catch (e) {
        set({ data: null, unreachable: isUnreachable(e), loading: false });
      }
    },
    [api],
  );

  const refreshStatus = useCallback(() => {
    if (api) void load(api.spectateStatus.bind(api), setStatus);
  }, [api, load]);
  const refreshAccount = useCallback(() => {
    if (api) void load(api.spectateAccount.bind(api), setAccount);
  }, [api, load]);
  const refreshPortfolio = useCallback(() => {
    if (api) void load(api.spectatePortfolio.bind(api), setPositions);
  }, [api, load]);
  const refreshCompliance = useCallback(() => {
    if (api) void load(api.spectateCompliance.bind(api), setCompliance);
  }, [api, load]);
  const refreshUniverse = useCallback(() => {
    if (api) void load(api.spectateUniverse.bind(api), setUniverse);
  }, [api, load]);

  // Status/account/portfolio/compliance poll every 30s while mounted; the
  // universe is fetched on enter only (payload is the largest, recomputed
  // daily — spec §5 refresh cadence table).
  useEffect(() => {
    refreshStatus();
    refreshAccount();
    refreshPortfolio();
    refreshCompliance();
    refreshUniverse();

    const timer = setInterval(() => {
      refreshStatus();
      refreshAccount();
      refreshPortfolio();
      refreshCompliance();
    }, GLANCE_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [refreshStatus, refreshAccount, refreshPortfolio, refreshCompliance, refreshUniverse]);

  const accountZeroed = account.data ? isZeroedAccount(account.data) : false;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b-2 border-[#333333] pb-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-[#ffffff] uppercase tracking-wider">
            Engine Spectate
          </h2>
          <p className="text-xs font-body text-secondary-fixed-dim mt-1 font-bold uppercase tracking-widest">
            Engine health · founder reference account · eligible universe
          </p>
        </div>
        <button
          type="button"
          onClick={refreshUniverse}
          className="px-4 py-2 bg-[#f2f0f1] text-[#0a0a0a] text-xs font-label font-bold uppercase tracking-widest border-2 border-[#f2f0f1] rounded-none flex items-center gap-2 hover:bg-[#d1d1d1] transition-none"
        >
          <span className="material-symbols-outlined text-[16px]">refresh</span>
          Refresh universe
        </button>
      </div>

      {/* Section A — Engine status */}
      <section className="bg-[#1a1918] border-2 border-[#333333] p-6">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-xs font-label font-bold uppercase tracking-widest text-[#f2f0f1]">
            A · Engine Status
          </h3>
          {status.unreachable ? (
            <UnreachableChip />
          ) : status.data ? (
            <span
              className={`px-3 py-1 border-2 text-[10px] font-bold uppercase tracking-widest ${
                status.data.scheduler_running
                  ? "bg-[#3366cc]/20 text-[#3366cc] border-[#3366cc]"
                  : "bg-[#ba1a1a]/20 text-[#ba1a1a] border-[#ba1a1a]"
              }`}
            >
              {status.data.scheduler_running ? "RUNNING" : "STOPPED"}
            </span>
          ) : (
            <span className="text-[10px] font-mono text-secondary-fixed-dim uppercase tracking-widest">
              {status.loading ? "LOADING…" : "NO DATA"}
            </span>
          )}
        </div>

        {status.unreachable ? (
          <UnreachableCard endpoint="engine status" />
        ) : !status.data ? (
          <p className="text-xs font-mono text-secondary-fixed-dim">
            {status.loading ? "Fetching engine status…" : "No engine status available."}
          </p>
        ) : (
          <div className="data-grid grid-cols-1 sm:grid-cols-3 border-2 border-[#333333]">
            <div className="bg-[#1a1918]">
              <div className="text-[10px] font-label font-bold uppercase tracking-widest text-secondary-fixed-dim mb-1.5">
                Last started
              </div>
              <div className="text-sm font-headline font-bold text-[#ffffff]">
                {formatRelativeTime(status.data.last_started_at)}
              </div>
            </div>
            <div className="bg-[#1a1918]">
              <div className="text-[10px] font-label font-bold uppercase tracking-widest text-secondary-fixed-dim mb-1.5">
                Next fire
              </div>
              <div className="text-sm font-headline font-bold text-[#ffffff]">
                {status.data.next_fire_at
                  ? `${formatRelativeTime(status.data.next_fire_at)} · ${status.data.next_fire_at.slice(0, 16).replace("T", " ")}`
                  : "Never"}
              </div>
            </div>
            <div className="bg-[#1a1918]">
              <div className="text-[10px] font-label font-bold uppercase tracking-widest text-secondary-fixed-dim mb-1.5">
                Config
              </div>
              <div className="text-sm font-mono font-bold text-[#f2f0f1]">
                {status.data.etf_symbol} · {status.data.top_n} · {brokerHost(status.data.broker_url)}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Section B — Founder account */}
      <section className="bg-[#1a1918] border-2 border-[#333333] p-6">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-xs font-label font-bold uppercase tracking-widest text-[#f2f0f1]">
            B · Founder account (yours) — {email ?? "unknown"}
          </h3>
          {account.unreachable ? (
            <UnreachableChip />
          ) : accountZeroed ? (
            <span className="px-3 py-1 border-2 border-[#333333] bg-[#242322] text-[10px] font-bold uppercase tracking-widest text-secondary-fixed-dim">
              NOT CONNECTED
            </span>
          ) : null}
        </div>

        {account.unreachable || positions.unreachable ? (
          <UnreachableCard endpoint="founder account" />
        ) : accountZeroed ? (
          <div className="border-2 border-[#333333] bg-[#0a0a0a] p-6 text-center">
            <p className="text-xs font-mono text-secondary-fixed-dim uppercase tracking-widest">
              {account.data?.fee_status_label ?? "Account not connected"}
            </p>
            <p className="text-[10px] font-mono text-secondary-fixed-dim mt-2">
              Connect Alpaca API keys on the dashboard to see live equity, cash and positions.
            </p>
          </div>
        ) : !account.data ? (
          <p className="text-xs font-mono text-secondary-fixed-dim">
            {account.loading ? "Fetching founder account…" : "No account data available."}
          </p>
        ) : (
          <>
            <div className="data-grid grid-cols-2 lg:grid-cols-4 border-2 border-[#333333] mb-6">
              <StatCell label="Equity" value={formatCurrency(account.data.equity)} />
              <StatCell label="Cash" value={formatCurrency(account.data.cash)} />
              <StatCell label="Buying power" value={formatCurrency(account.data.buying_power)} />
              <StatCell
                label="Day P/L"
                value={`${formatSignedCurrency(account.data.dayl_pl)} (${signedPct(account.data.dayl_pl_pct)})`}
                tone={account.data.dayl_pl > 0 ? "up" : account.data.dayl_pl < 0 ? "down" : "flat"}
              />
            </div>

            {/* Holdings table */}
            <div className="mb-5">
              <h4 className="text-[10px] font-label font-bold uppercase tracking-widest text-secondary-fixed-dim mb-3">
                Holdings
              </h4>
              {positions.unreachable ? (
                <UnreachableCard endpoint="holdings" />
              ) : !positions.data || positions.data.length === 0 ? (
                <div className="border-2 border-[#333333] bg-[#0a0a0a] p-6 text-center text-xs font-mono text-secondary-fixed-dim">
                  No open positions.
                </div>
              ) : (
                <div className="data-grid grid-cols-6 border-2 border-[#333333]">
                  <div className="data-grid-header">Symbol</div>
                  <div className="data-grid-header text-right">Qty</div>
                  <div className="data-grid-header text-right">Market value</div>
                  <div className="data-grid-header text-right">Unrealized P/L</div>
                  <div className="data-grid-header text-right">P/L %</div>
                  <div className="data-grid-header text-right">Current price</div>
                  {positions.data.map((p: SpectatePosition) => (
                    <PositionRow key={p.symbol} position={p} />
                  ))}
                </div>
              )}
            </div>

            {/* Compliance line */}
            {compliance.unreachable ? (
              <UnreachableCard endpoint="compliance" />
            ) : compliance.data ? (
              <div className="flex flex-wrap items-center gap-3 border-t-2 border-[#333333] pt-4">
                <span
                  className={`px-3 py-1 border-2 text-[10px] font-bold uppercase tracking-widest ${
                    compliance.data.compliant
                      ? "bg-[#10b981]/20 text-[#10b981] border-[#10b981]"
                      : "bg-[#ba1a1a]/20 text-[#ba1a1a] border-[#ba1a1a]"
                  }`}
                >
                  {compliance.data.compliant ? "COMPLIANT" : "VIOLATIONS"}
                </span>
                <span className="text-[11px] font-mono text-secondary-fixed-dim uppercase tracking-wider">
                  {compliance.data.held_count} / {compliance.data.universe_size} held · last checked{" "}
                  {formatRelativeTime(compliance.data.last_checked)}
                </span>
                {compliance.data.violations.length > 0 && (
                  <span className="text-[11px] font-mono text-[#ba1a1a] uppercase tracking-wider">
                    {compliance.data.violations.join(", ")}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-xs font-mono text-secondary-fixed-dim">
                {compliance.loading ? "Fetching compliance…" : "No compliance data available."}
              </p>
            )}
          </>
        )}
      </section>

      {/* Section C — Universe summary */}
      <section className="bg-[#1a1918] border-2 border-[#333333] p-6">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-xs font-label font-bold uppercase tracking-widest text-[#f2f0f1]">
            C · Eligible Universe
          </h3>
          {universe.unreachable ? (
            <UnreachableChip />
          ) : universe.data ? (
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-secondary-fixed-dim uppercase tracking-wider">
                {universe.data.stocks.length} eligible · last computed{" "}
                {formatRelativeTime(universe.data.last_computed_at)}
              </span>
              {universe.data.computing && (
                <span className="px-3 py-1 border-2 border-[#f59e0b] bg-[#f59e0b]/15 text-[10px] font-bold uppercase tracking-widest text-[#f59e0b]">
                  COMPUTING
                </span>
              )}
            </div>
          ) : (
            <span className="text-[10px] font-mono text-secondary-fixed-dim uppercase tracking-widest">
              {universe.loading ? "LOADING…" : "NO DATA"}
            </span>
          )}
        </div>

        {universe.unreachable ? (
          <UnreachableCard endpoint="universe" />
        ) : !universe.data ? (
          <p className="text-xs font-mono text-secondary-fixed-dim">
            {universe.loading ? "Fetching universe…" : "No universe data available."}
          </p>
        ) : universe.data.stocks.length === 0 ? (
          <div className="border-2 border-[#333333] bg-[#0a0a0a] p-6 text-center text-xs font-mono text-secondary-fixed-dim">
            {universe.data.computing ? "Universe is being recomputed…" : "No eligible stocks yet."}
          </div>
        ) : (
          <div className="data-grid grid-cols-8 border-2 border-[#333333]">
            <div className="data-grid-header">Rank</div>
            <div className="data-grid-header">Symbol</div>
            <div className="data-grid-header text-right">Factor</div>
            <div className="data-grid-header text-right">Momentum</div>
            <div className="data-grid-header text-right">Quality</div>
            <div className="data-grid-header text-right">Volatility</div>
            <div className="data-grid-header text-right">Value</div>
            <div className="data-grid-header text-center">In portfolio</div>
            {universeTopN(universe.data).length === 0 ? (
              <div className="col-span-8 p-6 text-center text-xs font-mono text-secondary-fixed-dim">
                No stocks in the top-N yet.
              </div>
            ) : (
              universeTopN(universe.data).map((s) => (
                <Fragment key={s.symbol}>
                  <div className="text-xs font-mono font-bold text-secondary-fixed-dim bg-[#1a1918]">
                    {s.rank}
                  </div>
                  <div className="text-xs font-mono font-bold text-[#ffffff] bg-[#1a1918]">
                    {s.symbol}
                  </div>
                  <div className="text-xs font-mono font-bold text-right text-[#3366cc] bg-[#1a1918]">
                    {s.factor_score.toFixed(2)}
                  </div>
                  <div className="text-xs font-mono text-right text-[#f2f0f1] bg-[#1a1918]">
                    {s.momentum_score.toFixed(2)}
                  </div>
                  <div className="text-xs font-mono text-right text-[#f2f0f1] bg-[#1a1918]">
                    {s.quality_score.toFixed(2)}
                  </div>
                  <div className="text-xs font-mono text-right text-[#f2f0f1] bg-[#1a1918]">
                    {s.volatility_score.toFixed(2)}
                  </div>
                  <div className="text-xs font-mono text-right text-[#f2f0f1] bg-[#1a1918]">
                    {s.value_score.toFixed(2)}
                  </div>
                  <div className="text-center bg-[#1a1918]">
                    {s.in_portfolio ? (
                      <span
                        role="img"
                        aria-label={`${s.symbol} in portfolio`}
                        title="In portfolio"
                        className="inline-block h-2.5 w-2.5 bg-[#10b981]"
                      />
                    ) : (
                      <span
                        role="img"
                        aria-label={`${s.symbol} not in portfolio`}
                        title="Not in portfolio"
                        className="inline-block h-2.5 w-2.5 border-2 border-[#333333] bg-[#0a0a0a]"
                      />
                    )}
                  </div>
                </Fragment>
              ))
            )}
          </div>
        )}
      </section>
    </div>
  );
}

/** The spec's "top-N table": stocks the engine actually ranked into top_n
 *  (the :8000 universe response marks them with in_top_n), ordered by rank. */
function universeTopN(universe: SpectateUniverseResponse): SpectateStockScore[] {
  return universe.stocks
    .filter((s) => s.in_top_n)
    .slice()
    .sort((a, b) => a.rank - b.rank);
}

function StatCell({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" | "flat" }) {
  const toneClass =
    tone === "up" ? "text-[#10b981]" : tone === "down" ? "text-[#ba1a1a]" : "text-[#ffffff]";
  return (
    <div className="bg-[#1a1918]">
      <div className="text-[10px] font-label font-bold uppercase tracking-widest text-secondary-fixed-dim mb-1.5">
        {label}
      </div>
      <div className={`text-xl lg:text-2xl font-headline font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}

function PositionRow({ position }: { position: SpectatePosition }) {
  const plTone =
    position.unrealized_pl > 0 ? "text-[#10b981]" : position.unrealized_pl < 0 ? "text-[#ba1a1a]" : "text-[#f2f0f1]";
  return (
    <>
      <div className="text-xs font-mono font-bold text-[#ffffff] bg-[#1a1918]">{position.symbol}</div>
      <div className="text-xs font-mono text-right text-[#f2f0f1] bg-[#1a1918]">{position.qty}</div>
      <div className="text-xs font-mono text-right text-[#f2f0f1] bg-[#1a1918]">
        {formatCurrency(position.market_value)}
      </div>
      <div className={`text-xs font-mono text-right bg-[#1a1918] ${plTone}`}>
        {formatSignedCurrency(position.unrealized_pl)}
      </div>
      <div className={`text-xs font-mono text-right bg-[#1a1918] ${plTone}`}>
        {signedPct(position.unrealized_pl_pct)}
      </div>
      <div className="text-xs font-mono text-right text-[#f2f0f1] bg-[#1a1918]">
        {formatCurrency(position.current_price)}
      </div>
    </>
  );
}

function UnreachableChip() {
  return (
    <span className="px-3 py-1 border-2 border-[#ba1a1a] bg-[#ba1a1a]/15 text-[10px] font-bold uppercase tracking-widest text-[#ffdad6]">
      Dashboard unreachable
    </span>
  );
}

function UnreachableCard({ endpoint }: { endpoint: string }) {
  return (
    <div className="border-2 border-[#ba1a1a] bg-[#ba1a1a]/10 p-6 text-center">
      <p className="text-xs font-mono text-[#ffdad6] uppercase tracking-widest">
        Dashboard unreachable — {endpoint} unavailable
      </p>
      <p className="text-[10px] font-mono text-secondary-fixed-dim mt-2">
        The engine dashboard (:8000) did not respond. Other admin views are unaffected.
      </p>
    </div>
  );
}
