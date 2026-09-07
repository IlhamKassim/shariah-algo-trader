import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, type ActivityEntry, type PositionResponse, type StockScore } from "../lib/api";
import { ConsoleShell } from "../components/ConsoleShell";
import { RebalanceModal } from "../components/RebalanceModal";
import { OnboardingTutorial } from "../components/OnboardingTutorial";

/* -------------------------------------------------------------------------- */
/* view modes                                                                  */
/* -------------------------------------------------------------------------- */

const PERIODS = ["1W", "1M", "3M", "6M"] as const;
type Period = (typeof PERIODS)[number];
const PERIOD_DAYS: Record<Period, number> = { "1W": 7, "1M": 30, "3M": 90, "6M": 180 };

type SignalKind = "Buy" | "Watch" | "Exit" | "Hold";
const SIGNAL_TABS = ["All", "Buy", "Watch", "Exit"] as const;
type SignalTab = (typeof SIGNAL_TABS)[number];

interface Signal {
  kind: SignalKind;
  title: string;
  detail: string;
}

const SIGNAL_DOT: Record<SignalKind, string> = {
  Buy: "var(--c-green)",
  Watch: "var(--c-amber)",
  Exit: "var(--c-red)",
  Hold: "var(--c-blue)",
};

/* -------------------------------------------------------------------------- */
/* formatting                                                                  */
/* -------------------------------------------------------------------------- */

const money = (n: number, dp = 2) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  }).format(n);

const signed = (n: number, dp = 2) => `${n >= 0 ? "+" : ""}${n.toFixed(dp)}%`;

const relTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return formatDistanceToNow(d, { addSuffix: true });
};

/* -------------------------------------------------------------------------- */
/* primitives                                                                  */
/* -------------------------------------------------------------------------- */

function Pill({
  active,
  onClick,
  children,
  small,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border-0 font-[inherit] whitespace-nowrap cursor-pointer transition-colors ${
        small ? "text-[12.5px] px-4 py-2" : "text-[13.5px] px-5 py-2.5"
      } ${
        active
          ? "bg-[var(--c-card)] text-[var(--c-ink)] font-semibold shadow-[0_1px_3px_rgba(20,25,35,0.12)]"
          : "bg-transparent text-[var(--c-mid)] font-medium hover:text-[var(--c-ink)]"
      }`}
    >
      {children}
    </button>
  );
}

function Card({
  title,
  icon,
  aside,
  children,
  className = "",
}: {
  title: string;
  icon: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex flex-col gap-4 min-w-0 bg-[var(--c-card)] rounded-[26px] p-[22px] ${className}`}
    >
      <div className="flex items-center justify-between gap-3.5">
        <div className="flex items-center gap-2.5 min-w-0">
          {icon}
          <h2 className="text-[16px] font-semibold tracking-[-0.01em]">{title}</h2>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[12.5px] leading-[1.5] text-[var(--c-mid)]">{label}</div>
      <div
        className="console-display text-[26px] font-medium tracking-[-0.02em] mt-2 whitespace-nowrap tabular-nums"
        style={{ color: color ?? "var(--c-ink)" }}
      >
        {value}
      </div>
    </div>
  );
}

/** Top-level status tile: the four numbers Overview surfaced above the fold. */
function StatTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className="min-w-0 bg-[var(--c-card)] rounded-[20px] px-5 py-4">
      <div className="text-[11px] text-[var(--c-mute)] uppercase tracking-[0.06em] whitespace-nowrap">
        {label}
      </div>
      <div
        className="console-display text-[24px] font-medium tracking-[-0.02em] mt-1.5 tabular-nums truncate"
        style={tone ? { color: tone } : undefined}
      >
        {value}
      </div>
      {sub != null && (
        <div className="text-[12px] text-[var(--c-mid)] mt-1 leading-[1.45]">{sub}</div>
      )}
    </div>
  );
}

/** Holdings row with a weight bar scaled against a rounded book-weight ceiling. */
function HoldingRow({
  pos,
  total,
  ceiling,
}: {
  pos: PositionResponse;
  total: number;
  ceiling: number;
}) {
  const weight = total > 0 ? (pos.market_value / total) * 100 : 0;
  // Scaled against a rounded ceiling, not the largest holding: an equal-weighted
  // book makes every max-scaled bar pin at 100% and read as broken.
  const barPct = ceiling > 0 ? Math.min(100, (weight / ceiling) * 100) : 0;
  const up = pos.unrealized_pl >= 0;
  // Derived, not stored: the API exposes avg_entry_price but no cost basis.
  const basis = pos.avg_entry_price * pos.qty;

  return (
    <div className="flex items-center gap-4 py-3 border-b border-[var(--c-line)] last:border-b-0">
      <div className="w-[76px] shrink-0 min-w-0">
        <div className="text-[13.5px] font-semibold truncate">{pos.symbol}</div>
        <div className="text-[11.5px] text-[var(--c-mute)] tabular-nums">
          {pos.qty.toLocaleString("en-US")} sh
        </div>
      </div>

      <div className="flex-1 min-w-0 hidden sm:flex items-center gap-3">
        <div className="w-[150px] shrink-0 h-1.5 rounded-full bg-[var(--c-soft)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--c-blue)]"
            style={{ width: `${barPct}%` }}
          />
        </div>
        <div className="text-[11.5px] text-[var(--c-mute)] tabular-nums truncate">
          {weight.toFixed(1)}% of book · basis {money(basis, 0)}
        </div>
      </div>

      <div className="text-right whitespace-nowrap shrink-0">
        <div className="text-[13.5px] font-semibold tabular-nums">
          {money(pos.market_value, 0)}
        </div>
        <div
          className="text-[12px] font-semibold tabular-nums mt-0.5"
          style={{ color: up ? "var(--c-green)" : "var(--c-red)" }}
        >
          {up ? "+" : ""}
          {money(pos.unrealized_pl, 0).replace("-", "")} ({signed(pos.unrealized_pl_pct * 100)})
        </div>
      </div>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--c-card)] rounded-[14px] px-3.5 py-2.5 shadow-[0_8px_24px_rgba(20,25,35,0.16)]">
      <div className="text-[11px] text-[var(--c-mute)] whitespace-nowrap">{label}</div>
      {payload.map((p) => (
        <div
          key={p.name}
          className="text-[13px] font-semibold mt-1 tabular-nums whitespace-nowrap"
          style={{ color: p.color }}
        >
          {p.name} {signed(p.value * 100)}
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* signal derivation — every row traces to /api/universe + /api/portfolio      */
/* -------------------------------------------------------------------------- */

function deriveSignals(
  stocks: StockScore[],
  heldSymbols: Set<string>,
  violations: string[],
  topN: number,
): Signal[] {
  const out: Signal[] = [];
  const label = (s: StockScore) => (s.company_name ? `${s.symbol} · ${s.company_name}` : s.symbol);

  for (const v of violations) {
    out.push({
      kind: "Exit",
      title: `Exit ${v}`,
      detail: "Left the Eligible Universe — Compliance Exit on the next open.",
    });
  }

  for (const s of stocks) {
    if (s.in_top_n && !heldSymbols.has(s.symbol)) {
      out.push({
        kind: "Buy",
        title: `Enter ${label(s)}`,
        detail: `Rank #${s.rank} by Factor Score (${s.factor_score.toFixed(2)}) — inside the top ${topN} cut line.`,
      });
    }
  }

  for (const s of stocks) {
    if (!s.in_top_n && heldSymbols.has(s.symbol) && !violations.includes(s.symbol)) {
      out.push({
        kind: "Exit",
        title: `Exit ${label(s)}`,
        detail: `Fell to rank #${s.rank} — below the top ${topN} cut line at the next Rebalance.`,
      });
    }
  }

  const watch = stocks
    .filter((s) => !s.in_top_n && !heldSymbols.has(s.symbol) && s.rank <= topN + 5)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 3);
  for (const s of watch) {
    out.push({
      kind: "Watch",
      title: `Watch ${label(s)}`,
      detail: `Rank #${s.rank}, just below the cut — enters if the Factor Score holds.`,
    });
  }

  const holding = stocks.filter((s) => s.in_top_n && heldSymbols.has(s.symbol)).length;
  if (holding > 0) {
    out.push({
      kind: "Hold",
      title: "Hold core weights",
      detail: `${holding} name${holding === 1 ? "" : "s"} still inside the top ${topN} — no action this cycle.`,
    });
  }

  return out;
}

/* -------------------------------------------------------------------------- */
/* order derivation — every row is a real /api/activity entry                  */
/* -------------------------------------------------------------------------- */

function orderTag(entry: ActivityEntry): { tag: string; color: string } {
  const msg = entry.message.toUpperCase();
  if (entry.type === "COMPLIANCE" && !msg.includes("PASSED")) {
    return { tag: "EXIT", color: "var(--c-red)" };
  }
  if (msg.includes("SELL")) return { tag: "SELL", color: "var(--c-red)" };
  if (msg.includes("BUY")) return { tag: "BUY", color: "var(--c-green)" };
  if (entry.type === "REBALANCE") return { tag: "RBL", color: "var(--c-blue)" };
  return { tag: entry.type.slice(0, 3), color: "var(--c-mid)" };
}

/* -------------------------------------------------------------------------- */
/* page                                                                        */
/* -------------------------------------------------------------------------- */

export function Console() {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<Period>("1M");
  const [signalTab, setSignalTab] = useState<SignalTab>("All");
  const [expandOrders, setExpandOrders] = useState(false);
  const [expandHoldings, setExpandHoldings] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [rebalanceOpen, setRebalanceOpen] = useState(false);

  const { data: status } = useQuery({ queryKey: ["status"], queryFn: api.status, refetchInterval: 30_000 });
  const { data: account } = useQuery({ queryKey: ["account"], queryFn: api.account, refetchInterval: 30_000 });
  const { data: positions } = useQuery({ queryKey: ["portfolio"], queryFn: api.portfolio, refetchInterval: 30_000 });
  const { data: universe } = useQuery({ queryKey: ["universe"], queryFn: api.universe, refetchInterval: 30_000 });
  const { data: activity } = useQuery({ queryKey: ["activity"], queryFn: () => api.activity(), refetchInterval: 30_000 });
  const { data: performance } = useQuery({ queryKey: ["performance"], queryFn: api.performance, refetchInterval: 300_000 });
  const { data: compliance } = useQuery({ queryKey: ["compliance"], queryFn: api.compliance, refetchInterval: 60_000 });
  const { data: compare } = useQuery({ queryKey: ["compare"], queryFn: api.compare, refetchInterval: 300_000 });

  const topN = status?.top_n ?? 20;
  const invested = useMemo(
    () => (positions ?? []).reduce((s, p) => s + p.market_value, 0),
    [positions],
  );
  const cash = account?.cash ?? 0;
  const totalValue = account?.portfolio_value ?? invested + cash;

  const byValue = useMemo(
    () => (positions ?? []).slice().sort((a, b) => b.market_value - a.market_value),
    [positions],
  );
  const ticker = byValue.slice(0, 4);
  // Weight-bar axis: the largest holding rounded up to the next 5%, so bars
  // sit against a stable reference rather than each other.
  const weightCeiling = useMemo(() => {
    if (invested <= 0 || byValue.length === 0) return 0;
    const max = Math.max(...byValue.map((p) => (p.market_value / invested) * 100));
    return Math.max(5, Math.ceil(max / 5) * 5);
  }, [byValue, invested]);

  // Aggregate unrealized P&L, folded in from the retired Portfolio page —
  // Console previously showed this per position but never totalled it.
  const totalPl = useMemo(
    () => (positions ?? []).reduce((s, p) => s + p.unrealized_pl, 0),
    [positions],
  );
  const totalCost = invested - totalPl;
  const totalPlPct = totalCost > 0 ? (totalPl / totalCost) * 100 : 0;

  const dayPl = account?.dayl_pl ?? 0;
  const dayPlPct = account?.dayl_pl_pct ?? 0;
  const dayTone = dayPl >= 0 ? "var(--c-green)" : "var(--c-red)";

  // Cash sitting idle with no positions — the account can't do anything until
  // a first rebalance allocates it.
  const needsFirstAllocation =
    positions != null && positions.length === 0 && (account?.portfolio_value ?? 0) > 0;
  const needsAlpaca = account?.fee_status_label === "Connect Alpaca API in Settings";

  const nextRun = status?.next_fire_at
    ? new Date(status.next_fire_at).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : null;

  const signals = useMemo(() => {
    if (!universe?.stocks.length || !positions) return [];
    const held = new Set(positions.map((p) => p.symbol));
    return deriveSignals(universe.stocks, held, compliance?.violations ?? [], topN);
  }, [universe, positions, compliance, topN]);

  const shownSignals = signals.filter((s) => signalTab === "All" || s.kind === signalTab);

  const orders = useMemo(() => {
    const entries = (activity?.entries ?? []).filter(
      (e) => e.type === "ORDER" || e.type === "REBALANCE" || e.type === "COMPLIANCE",
    );
    return entries.slice(0, expandOrders ? 10 : 4);
  }, [activity, expandOrders]);

  const chartData = useMemo(() => {
    if (!performance) return [];
    return performance.dates
      .map((date, i) => ({
        date,
        Strategy: performance.portfolio_cumulative[i],
        [status?.etf_symbol ?? "SPUS"]: performance.benchmark_cumulative[i],
      }))
      .slice(-PERIOD_DAYS[period]);
  }, [performance, period, status]);

  const benchKey = status?.etf_symbol ?? "SPUS";
  const isComputing = scanning || universe?.computing;

  const runScan = async () => {
    if (isComputing) return;
    setScanning(true);
    try {
      await api.refreshUniverse();
      await queryClient.invalidateQueries({ queryKey: ["universe"] });
    } finally {
      setScanning(false);
    }
  };

  return (
    // Positions carry unrealized_pl_pct, not a daily move — the strip is
    // labelled so the green/red chip isn't read as today's change.
    <ConsoleShell
      breadcrumb="My Portfolio"
      aside={
          <div className="min-w-0 max-w-full">
            <div className="text-[11px] text-[var(--c-mute)] mb-1.5 whitespace-nowrap">
              Largest holdings · unrealized
            </div>
            <div className="flex gap-[34px] overflow-x-auto pb-1 min-w-0">
            {ticker.map((p) => (
              <div key={p.symbol} className="min-w-0 whitespace-nowrap">
                <div className="text-[13px] text-[var(--c-mute)]">{p.symbol}</div>
                <div className="flex items-center gap-2.5 mt-2">
                  <span className="text-[19px] font-medium tracking-[-0.01em] tabular-nums">
                    {p.current_price.toFixed(2)}
                  </span>
                  <span
                    className="px-2.5 py-[5px] rounded-full text-[12px] font-semibold whitespace-nowrap"
                    style={{
                      background:
                        p.unrealized_pl_pct >= 0 ? "rgba(31,169,113,0.13)" : "rgba(222,74,79,0.12)",
                      color: p.unrealized_pl_pct >= 0 ? "var(--c-green)" : "var(--c-red)",
                    }}
                  >
                    {signed(p.unrealized_pl_pct * 100)}
                  </span>
                </div>
              </div>
            ))}
            </div>
          </div>
      }
    >
        {/* ---------------------------------------------------------------- */}
        {/* hero                                                             */}
        {/* ---------------------------------------------------------------- */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] gap-7 items-center pt-1.5 pb-[18px]">
          <div className="min-w-0">
            <h1 className="console-display m-0 font-light text-[66px] leading-none tracking-[-0.035em]">
              My Portfolio
            </h1>
            {/* One proportion bar for the whole book. The comp used two bars
                with decorative fixed ratios; driving those from real dollars
                collapsed a slice to nothing whenever cash was small, so this
                shows the actual equity/cash split once instead. */}
            <div className="mt-[34px] max-w-[440px]">
              <div className="flex items-center gap-1.5 p-[7px] bg-white/55 rounded-full">
                <span
                  className="h-11 rounded-full block min-w-[18px]"
                  style={{
                    flex: Math.max(invested, 0),
                    background: "repeating-linear-gradient(115deg,#4E90F0 0 6px,#2E6FE0 6px 12px)",
                  }}
                  title={`Equity holdings ${money(invested, 0)}`}
                />
                <span
                  className="h-11 rounded-full block min-w-[18px]"
                  style={{
                    flex: Math.max(cash, 0),
                    background: "repeating-linear-gradient(90deg,#F6CB5C 0 5px,#EFBE42 5px 10px)",
                  }}
                  title={`Cash buffer ${money(cash, 0)}`}
                />
              </div>

              <div className="flex gap-6 flex-wrap mt-3.5">
                {[
                  { label: "Equity holdings", value: invested, swatch: "#2E6FE0" },
                  { label: "Cash buffer", value: cash, swatch: "#EFBE42" },
                ].map((row) => (
                  <div key={row.label} className="flex items-baseline gap-2 min-w-0">
                    <span
                      className="w-[9px] h-[9px] shrink-0 rounded-[3px] block self-center"
                      style={{ background: row.swatch }}
                    />
                    <span className="text-[13px] text-[var(--c-mid)] whitespace-nowrap">
                      {row.label}
                    </span>
                    <span className="text-[13px] font-semibold whitespace-nowrap tabular-nums">
                      {money(row.value, 0)}
                    </span>
                    <span className="text-[12px] text-[var(--c-mute)] whitespace-nowrap tabular-nums">
                      {totalValue > 0 ? `${((row.value / totalValue) * 100).toFixed(1)}%` : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="min-w-0 relative flex items-center justify-center py-3">
            <svg viewBox="0 0 520 250" className="w-full h-auto block" aria-hidden="true">
              <defs>
                <linearGradient id="console-dome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4B93F2" stopOpacity="0.55" />
                  <stop offset="100%" stopColor="#DCE3EC" stopOpacity="0.1" />
                </linearGradient>
              </defs>
              <path d="M18 240 A 242 232 0 0 1 502 240 Z" fill="url(#console-dome)" />
              <path d="M18 240 A 242 232 0 0 1 302 12" fill="none" stroke="#2E6FE0" strokeWidth="2" />
              <path
                d="M302 12 A 242 232 0 0 1 502 240"
                fill="none"
                stroke="#8FB6EC"
                strokeWidth="2"
                strokeDasharray="7 7"
              />
              <circle cx="18" cy="240" r="9" fill="#2249E0" />
              <circle cx="150" cy="33.3" r="9" fill="#2249E0" />
              <circle cx="302" cy="12" r="9" fill="#2249E0" />
              <circle cx="470" cy="124.7" r="8" fill="#BCD3F3" />
              <circle cx="502" cy="240" r="8" fill="#BCD3F3" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pt-9">
              <span className="text-[15px] text-[var(--c-mid)]">Total portfolio value</span>
              <span className="console-display text-[42px] tracking-[-0.03em] tabular-nums">
                {money(totalValue)}
              </span>
              <span
                className="text-[14px] font-semibold tabular-nums -mt-1"
                style={{ color: dayTone }}
              >
                {dayPl >= 0 ? "+" : "−"}
                {money(Math.abs(dayPl), 2)} ({signed(dayPlPct * 100)}) today
              </span>
              <Link
                to="/performance"
                className="flex items-center gap-2.5 bg-[var(--c-card)] rounded-full px-5 py-2.5 text-[13.5px] font-semibold !text-[var(--c-ink)] shadow-[0_2px_8px_rgba(20,25,35,0.1)] hover:opacity-85 transition-opacity"
              >
                View performance <span className="text-[12px]">↗</span>
              </Link>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* status strip — the four numbers Overview kept above the fold      */}
        {/* ---------------------------------------------------------------- */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(230px,100%),1fr))] gap-3.5">
          <StatTile
            label="Daily P&L"
            value={`${dayPl >= 0 ? "+" : "−"}${money(Math.abs(dayPl), 2)}`}
            tone={dayTone}
            sub={<span style={{ color: dayTone }}>{signed(dayPlPct * 100)} vs prior close</span>}
          />
          <StatTile
            label="Shariah screen"
            value={
              compliance == null
                ? "—"
                : compliance.compliant
                  ? "Screened"
                  : `${compliance.violations.length} violation${compliance.violations.length === 1 ? "" : "s"}`
            }
            tone={
              compliance == null
                ? undefined
                : compliance.compliant
                  ? "var(--c-green)"
                  : "var(--c-red)"
            }
            sub={
              compliance ? (
                <>
                  {compliance.held_count} held · {compliance.universe_size} in universe
                  {!compliance.compliant && compliance.violations.length > 0 && (
                    <span className="block text-[var(--c-red)]">
                      {compliance.violations.join(", ")}
                    </span>
                  )}
                </>
              ) : undefined
            }
          />
          <StatTile
            label="Fee drag"
            value={account ? money(account.estimated_fees ?? 0, 2) : "—"}
            sub={account?.fee_status_label ?? "Estimated cost to date"}
          />
          <StatTile
            label="Next rebalance"
            value={nextRun ?? "—"}
            sub={
              <span className="flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full inline-block"
                  style={{
                    background: status?.scheduler_running ? "var(--c-green)" : "var(--c-red)",
                  }}
                />
                Scheduler {status?.scheduler_running ? "active" : "offline"} · top {topN}
              </span>
            }
          />
        </div>

        {needsAlpaca && <OnboardingTutorial />}

        {needsFirstAllocation && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--c-card)] rounded-[20px] px-5 py-4">
            <div className="min-w-0">
              <div className="text-[14px] font-semibold">Account funded — no positions yet</div>
              <div className="text-[12.5px] text-[var(--c-mid)] mt-1 leading-[1.5]">
                {money(account?.portfolio_value ?? 0, 2)} in cash and 0 holdings. Run a rebalance to
                rank the Eligible Universe and allocate into the top {topN}.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setRebalanceOpen(true)}
              className="shrink-0 border-0 rounded-full bg-[var(--c-blue)] text-white font-[inherit] text-[12.5px] font-semibold px-5 py-[11px] cursor-pointer hover:opacity-90 transition-opacity"
            >
              Allocate portfolio
            </button>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* sheet                                                            */}
        {/* ---------------------------------------------------------------- */}
        <div className="bg-[var(--c-sheet)] rounded-t-[34px] p-[26px] flex flex-col gap-[22px] min-h-[60vh]">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(430px,100%),1fr))] gap-[22px] items-start">
            {(
              <Card
                title="Performance"
                                icon={
                  <span className="w-[22px] h-[22px] shrink-0 rounded-[6px] bg-[var(--c-ink)] flex items-center justify-center">
                    <span className="w-[9px] h-[9px] border-[1.5px] border-white rounded-[2px] block" />
                  </span>
                }
                aside={
                  <span className="text-[13px] text-[var(--c-mute)] whitespace-nowrap">
                    Cumulative return vs {benchKey} · last {PERIOD_DAYS[period]}d
                  </span>
                }
              >
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)] gap-[18px] items-stretch">
                  <div className="min-w-0 flex flex-col gap-3.5">
                    <div className="min-w-0 h-[250px]">
                      {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={chartData} margin={{ top: 8, right: 36, bottom: 0, left: 0 }}>
                            <defs>
                              <linearGradient id="console-strat" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#2563EB" stopOpacity={0.28} />
                                <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid stroke="var(--c-line)" strokeDasharray="3 3" vertical={false} />
                            <XAxis
                              dataKey="date"
                              tick={{ fill: "var(--c-mute)", fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                              minTickGap={28}
                            />
                            <YAxis
                              tick={{ fill: "var(--c-mute)", fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                              width={52}
                              tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                            />
                            <Tooltip content={<ChartTooltip />} />
                            <Area
                              type="monotone"
                              dataKey="Strategy"
                              stroke="#2563EB"
                              strokeWidth={2}
                              fill="url(#console-strat)"
                            />
                            <Line
                              type="monotone"
                              dataKey={benchKey}
                              stroke="#8FB6EC"
                              strokeWidth={2}
                              strokeDasharray="7 7"
                              dot={false}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center border border-dashed border-[var(--c-line)] rounded-[10px] text-[13px] text-[var(--c-mute)]">
                          No performance history yet
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      {PERIODS.map((p) => (
                        <Pill key={p} small active={period === p} onClick={() => setPeriod(p)}>
                          {p}
                        </Pill>
                      ))}
                    </div>
                  </div>

                  <div className="min-w-0 bg-[var(--c-soft)] rounded-[20px] p-5 flex flex-col justify-between gap-[22px]">
                    <Metric
                      label="Sharpe ratio"
                      value={compare ? compare.shariah.sharpe_ratio.toFixed(2) : "—"}
                    />
                    <Metric
                      label="Max drawdown"
                      value={compare ? `${compare.shariah.max_drawdown_pct.toFixed(2)}%` : "—"}
                    />
                    <Metric
                      label="Win rate"
                      value={compare ? `${compare.shariah.win_rate_pct.toFixed(1)}%` : "—"}
                    />
                    <Metric label="Leverage used" value="None" color="var(--c-green)" />
                  </div>
                </div>
              </Card>
            )}

            {(
              <Card
                title="Engine Signals"
                                icon={
                  <span className="w-[22px] h-[22px] shrink-0 rounded-full bg-gradient-to-br from-[#2563EB] to-[#7C5CFC] block" />
                }
              >
                <div className="self-end bg-[var(--c-soft)] rounded-[16px_16px_4px_16px] px-4 py-3 text-[13px] text-[var(--c-mid)] max-w-[80%]">
                  Where should the engine focus this cycle?
                </div>

                {/* Capped so a long signal list doesn't stretch this card far
                    past the Performance card beside it, leaving dead space. */}
                <div className="flex flex-col gap-3.5 flex-1 max-h-[360px] overflow-y-auto pr-1">
                  <div className="text-[13px] font-semibold">
                    Focus for top {topN}
                    {universe?.last_computed_at && (
                      <span className="font-normal text-[var(--c-mute)]">
                        {" "}
                        · ranked {relTime(universe.last_computed_at)}
                      </span>
                    )}
                  </div>

                  {shownSignals.length === 0 ? (
                    <p className="text-[12.5px] text-[var(--c-mid)] leading-[1.55]">
                      {universe?.stocks.length
                        ? "No signals in this category — the Portfolio matches the current ranking."
                        : "Factor Scores have not been computed yet. Run the scan to rank the Eligible Universe."}
                    </p>
                  ) : (
                    shownSignals.map((s, i) => (
                      <div key={`${s.kind}-${s.title}-${i}`} className="flex gap-2.5 items-start">
                        <span
                          className="w-[9px] h-[9px] shrink-0 rounded-full mt-1.5 block"
                          style={{ background: SIGNAL_DOT[s.kind] }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-semibold">{s.title}</span>
                          <span className="block text-[12.5px] text-[var(--c-mid)] mt-1 leading-[1.55]">
                            {s.detail}
                          </span>
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex gap-[7px] flex-wrap">
                  {SIGNAL_TABS.map((t) => {
                    const count = t === "All" ? signals.length : signals.filter((s) => s.kind === t).length;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSignalTab(t)}
                        aria-pressed={signalTab === t}
                        className={`border-0 rounded-full cursor-pointer font-[inherit] text-[12px] font-semibold px-[15px] py-2 whitespace-nowrap transition-opacity hover:opacity-85 ${
                          signalTab === t
                            ? "bg-[var(--c-ink)] text-white"
                            : "bg-[var(--c-soft)] text-[var(--c-mid)]"
                        }`}
                      >
                        {t}
                        {count > 0 && <span className="ml-1.5 tabular-nums opacity-70">{count}</span>}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-3 bg-[var(--c-soft)] rounded-full p-2 pl-5">
                  <span className="flex-1 min-w-0 text-[13px] text-[var(--c-mid)]">
                    {isComputing ? "Recomputing factor ranks…" : "Re-rank the Eligible Universe"}
                  </span>
                  <button
                    type="button"
                    onClick={runScan}
                    disabled={!!isComputing}
                    className="border-0 rounded-full bg-[var(--c-blue)] text-white font-[inherit] text-[12.5px] font-semibold px-5 py-[11px] whitespace-nowrap cursor-pointer disabled:cursor-wait hover:opacity-90 transition-opacity"
                  >
                    {isComputing ? "Working" : "Run scan"}
                  </button>
                </div>
              </Card>
            )}
          </div>

          {(
            <Card
              title="Holdings"
              icon={
                <span className="w-[22px] h-[22px] shrink-0 rounded-[6px] bg-[var(--c-blue)] block" />
              }
              aside={
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-[12.5px] text-[var(--c-mute)] tabular-nums whitespace-nowrap">
                    {byValue.length} position{byValue.length === 1 ? "" : "s"} · {money(invested, 0)}
                  </span>
                  {byValue.length > 0 && (
                    <span
                      className="text-[12.5px] font-semibold tabular-nums whitespace-nowrap"
                      style={{ color: totalPl >= 0 ? "var(--c-green)" : "var(--c-red)" }}
                      title="Aggregate unrealized P&L across open positions"
                    >
                      {totalPl >= 0 ? "+" : "−"}
                      {money(Math.abs(totalPl), 0)} ({signed(totalPlPct)}) unrealized
                    </span>
                  )}
                  {byValue.length > 6 && (
                    <button
                      type="button"
                      onClick={() => setExpandHoldings((v) => !v)}
                      className="rounded-full border border-[var(--c-line)] bg-transparent text-[var(--c-mid)] hover:text-[var(--c-ink)] font-[inherit] text-[12px] font-semibold px-3.5 py-2 whitespace-nowrap cursor-pointer transition-colors"
                    >
                      {expandHoldings ? "Show less" : "See all"}
                    </button>
                  )}
                </div>
              }
            >
              {byValue.length === 0 ? (
                <p className="text-[12.5px] text-[var(--c-mid)] py-3">
                  No open positions. The next Rebalance will allocate into the top {topN}.
                </p>
              ) : (
                <>
                  <div className="flex flex-col">
                    {(expandHoldings ? byValue : byValue.slice(0, 6)).map((p) => (
                      <HoldingRow key={p.symbol} pos={p} total={invested} ceiling={weightCeiling} />
                    ))}
                  </div>
                  {/* Realized P&L and true target weight are not exposed by the
                      API (see issue #19); stated rather than approximated. */}
                  <p className="text-[11.5px] text-[var(--c-mute)] leading-[1.5] pt-1">
                    Cost basis derived from average entry price. Realized P&amp;L and target weight
                    are not tracked yet.
                  </p>
                </>
              )}
            </Card>
          )}

          {(
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(400px,100%),1fr))] gap-[22px] items-start pb-[26px]">
              <Card
                title="Recent Activity"
                className="col-span-full"
                icon={<span className="w-[22px] h-[22px] shrink-0 rounded-full bg-[var(--c-ink)] block" />}
                aside={
                  <div className="flex items-center gap-2">
                    <Link
                      to="/ledger"
                      className="rounded-full border border-[var(--c-line)] bg-transparent !text-[var(--c-mid)] hover:!text-[var(--c-ink)] text-[12px] font-semibold px-3.5 py-2 whitespace-nowrap"
                    >
                      Full log
                    </Link>
                    <button
                      type="button"
                      onClick={() => setExpandOrders((v) => !v)}
                      className="rounded-full border border-[var(--c-line)] bg-transparent text-[var(--c-mid)] hover:text-[var(--c-ink)] font-[inherit] text-[12px] font-semibold px-3.5 py-2 whitespace-nowrap cursor-pointer transition-colors"
                    >
                      {expandOrders ? "Show less" : "See all"}
                    </button>
                  </div>
                }
              >
                <div className="flex flex-col">
                  {orders.length === 0 ? (
                    <p className="text-[12.5px] text-[var(--c-mid)] py-3.5">
                      No orders, rebalances or compliance events recorded yet.
                    </p>
                  ) : (
                    orders.map((e, i) => {
                      const { tag, color } = orderTag(e);
                      return (
                        <div
                          key={`${e.timestamp}-${i}`}
                          className="flex items-center gap-3.5 py-3.5 border-b border-[var(--c-line)] last:border-b-0"
                        >
                          <span
                            className="w-[34px] h-[34px] shrink-0 rounded-full bg-[var(--c-soft)] flex items-center justify-center text-[11px] font-bold"
                            style={{ color }}
                          >
                            {tag}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-[13.5px] font-semibold">{e.message}</span>
                            {e.tickers.length > 0 && (
                              <span className="block text-[12px] text-[var(--c-mute)] mt-1 overflow-hidden text-ellipsis whitespace-nowrap">
                                {e.tickers.join(" · ")}
                              </span>
                            )}
                          </span>
                          <span className="text-right whitespace-nowrap text-[11.5px] text-[var(--c-mute)]">
                            {relTime(e.timestamp)}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </Card>
            </div>
          )}
        </div>

      {/* Still on the obsidian system — see DESIGN.md §B. Migrating the modals
          is tracked separately so this page isn't blocked on them. */}
      <RebalanceModal
        isOpen={rebalanceOpen}
        onClose={() => setRebalanceOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["portfolio"] });
          queryClient.invalidateQueries({ queryKey: ["account"] });
          queryClient.invalidateQueries({ queryKey: ["activity"] });
        }}
        accountData={
          account
            ? {
                portfolio_value: account.portfolio_value,
                cash: account.cash,
                trading_mode: status?.is_live ? "live" : "paper",
              }
            : undefined
        }
      />
    </ConsoleShell>
  );
}
