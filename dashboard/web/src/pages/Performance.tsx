import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { api, type StrategyMetrics } from "../lib/api";
import { ConsoleShell } from "../components/ConsoleShell";

const PERIODS = ["1W", "1M", "3M", "6M", "All"] as const;
type Period = (typeof PERIODS)[number];
const PERIOD_DAYS: Record<Period, number> = {
  "1W": 7,
  "1M": 30,
  "3M": 90,
  "6M": 180,
  All: Number.MAX_SAFE_INTEGER,
};

const money = (n: number, dp = 0) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  }).format(n);

const signed = (n: number, dp = 2) => `${n >= 0 ? "+" : ""}${n.toFixed(dp)}%`;

function Card({
  title,
  aside,
  swatch,
  children,
  className = "",
}: {
  title: string;
  aside?: React.ReactNode;
  swatch: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex flex-col gap-4 min-w-0 bg-[var(--c-card)] border border-[var(--c-line)] rounded-[var(--r-card)] p-4 sm:p-[22px] ${className}`}
    >
      <div className="flex items-center justify-between gap-x-3.5 gap-y-1 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="w-[22px] h-[22px] shrink-0 rounded-[var(--r-chip)] block"
            style={{ background: swatch }}
          />
          <h2 className="text-[16px] font-semibold tracking-[-0.01em]">{title}</h2>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-[var(--r-btn)] border-0 font-[inherit] text-[12.5px] px-4 py-2 whitespace-nowrap cursor-pointer transition-colors ${
        active
          ? "bg-[var(--c-soft)] text-[var(--c-ink)] font-semibold shadow-[var(--sh-card)]"
          : "bg-transparent text-[var(--c-mid)] font-medium hover:text-[var(--c-ink)]"
      }`}
    >
      {children}
    </button>
  );
}

function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[12px] text-[var(--c-mid)] leading-[1.45]">{label}</div>
      <div
        className="console-figure text-[24px] font-medium tracking-[-0.02em] mt-1.5 tabular-nums whitespace-nowrap"
        style={tone ? { color: tone } : undefined}
      >
        {value}
      </div>
      {sub && <div className="text-[11.5px] text-[var(--c-mute)] mt-1 leading-[1.4]">{sub}</div>}
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  format,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  format: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--c-card)] rounded-[var(--r-card)] px-3.5 py-2.5 shadow-[var(--sh-pop)]">
      <div className="text-[11px] text-[var(--c-mute)] whitespace-nowrap">{label}</div>
      {payload.map((p) => (
        <div
          key={p.name}
          className="text-[13px] font-semibold mt-1 tabular-nums whitespace-nowrap"
          style={{ color: p.color }}
        >
          {p.name} {format(p.value)}
        </div>
      ))}
    </div>
  );
}

/** Strategy metric column, carried over from the Compare page. */
function StrategyMetrics_({
  m,
  color,
  pending,
  /** Only the Shariah strategy is mandated long-only and unleveraged. The Day
      Trader benchmark is deliberately unrestricted, so the guarantee must not
      be printed under it. */
  shariahMandate,
}: {
  m: StrategyMetrics;
  color: string;
  pending?: boolean;
  shariahMandate?: boolean;
}) {
  return (
    <div className={`min-w-0 ${pending ? "opacity-55" : ""}`}>
      <div className="flex items-center gap-2 pb-3 mb-1 border-b border-[var(--c-line)]">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
        <span className="text-[13.5px] font-semibold truncate">
          {pending ? `${m.name} (not configured)` : m.name}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-4 pt-3">
        <Metric label="Equity" value={money(m.current_equity)} />
        <Metric
          label="Total return"
          value={signed(m.total_return_pct)}
          tone={m.total_return_pct >= 0 ? "var(--c-green)" : "var(--c-red)"}
        />
        <Metric label="Sharpe ratio" value={m.sharpe_ratio.toFixed(2)} sub="Annualised" />
        <Metric
          label="Max drawdown"
          value={`${m.max_drawdown_pct.toFixed(2)}%`}
          sub="Peak to trough"
          tone="var(--c-red)"
        />
        <Metric label="Win rate" value={`${m.win_rate_pct.toFixed(1)}%`} sub="Positive days" />
        {shariahMandate ? (
          <Metric label="Leverage" value="None" tone="var(--c-green)" sub="Long-only spot" />
        ) : (
          <Metric label="Mandate" value="Unrestricted" sub="Not Shariah-screened" />
        )}
      </div>
    </div>
  );
}

export function Performance() {
  const [period, setPeriod] = useState<Period>("1M");

  const { data: status } = useQuery({ queryKey: ["status"], queryFn: api.status });
  const { data: performance, isLoading: loadingPerf } = useQuery({
    queryKey: ["performance"],
    queryFn: api.performance,
    refetchInterval: 300_000,
  });
  const { data: compare, isLoading: loadingCompare } = useQuery({
    queryKey: ["compare"],
    queryFn: api.compare,
    refetchInterval: 60_000,
  });

  const benchKey = status?.etf_symbol ?? "SPUS";

  const returnSeries = useMemo(() => {
    if (!performance) return [];
    return performance.dates
      .map((date, i) => ({
        date,
        Strategy: performance.portfolio_cumulative[i],
        [benchKey]: performance.benchmark_cumulative[i],
        "S&P 500": performance.sp500_cumulative[i],
      }))
      .slice(-PERIOD_DAYS[period]);
  }, [performance, period, benchKey]);

  // Drawdown is not an endpoint — derived here from the cumulative return
  // series as the running distance below its own peak.
  const drawdownSeries = useMemo(() => {
    if (!performance) return [];
    const rows = performance.dates.map((date, i) => ({
      date,
      cum: performance.portfolio_cumulative[i] ?? 0,
    }));
    let peak = -Infinity;
    return rows
      .map((r) => {
        const nav = 1 + r.cum;
        peak = Math.max(peak, nav);
        return { date: r.date, Drawdown: peak > 0 ? nav / peak - 1 : 0 };
      })
      .slice(-PERIOD_DAYS[period]);
  }, [performance, period]);

  const last = returnSeries.at(-1);
  const strat = last ? (last.Strategy as number) : 0;
  const bench = last ? (last[benchKey] as number) : 0;
  const alpha = strat - bench;
  const worstDd = drawdownSeries.length
    ? Math.min(...drawdownSeries.map((d) => d.Drawdown))
    : 0;

  const equitySeries = useMemo(() => {
    if (!compare) return [];
    return compare.dates.map((date, i) => ({
      date,
      "Shariah Algo": compare.shariah_equity[i] ?? null,
      "Day Trader": compare.daytrader_available ? (compare.daytrader_equity[i] ?? null) : null,
    }));
  }, [compare]);

  return (
    <ConsoleShell
      breadcrumb="Performance"
      aside={
        <div className="flex items-center gap-1 p-[5px] bg-[var(--c-card)] border border-[var(--c-line)] rounded-[var(--r-inset)] shadow-[var(--sh-card)]">
          {PERIODS.map((p) => (
            <Pill key={p} active={period === p} onClick={() => setPeriod(p)}>
              {p}
            </Pill>
          ))}
        </div>
      }
    >
      <div className="bg-[var(--c-sheet)] rounded-t-[var(--r-sheet)] p-3.5 sm:p-[26px] flex flex-col gap-4 sm:gap-[22px] min-h-[70vh]">
        {/* headline return figures */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-3.5">
          <div className="bg-[var(--c-card)] border border-[var(--c-line)] rounded-[var(--r-inset)] px-5 py-4">
            <Metric
              label="Strategy return"
              value={signed(strat * 100)}
              tone={strat >= 0 ? "var(--c-green)" : "var(--c-red)"}
              sub={`Cumulative · ${period === "All" ? "since inception" : `last ${period}`}`}
            />
          </div>
          <div className="bg-[var(--c-card)] border border-[var(--c-line)] rounded-[var(--r-inset)] px-5 py-4">
            <Metric label={`${benchKey} return`} value={signed(bench * 100)} sub="Benchmark ETF" />
          </div>
          <div className="bg-[var(--c-card)] border border-[var(--c-line)] rounded-[var(--r-inset)] px-5 py-4">
            <Metric
              label="Alpha vs benchmark"
              value={`${alpha >= 0 ? "+" : ""}${(alpha * 100).toFixed(2)} pts`}
              tone={alpha >= 0 ? "var(--c-green)" : "var(--c-red)"}
              sub="Strategy minus benchmark"
            />
          </div>
          <div className="bg-[var(--c-card)] border border-[var(--c-line)] rounded-[var(--r-inset)] px-5 py-4">
            <Metric
              label="Worst drawdown"
              value={`${(worstDd * 100).toFixed(2)}%`}
              tone="var(--c-red)"
              sub="Derived from the return series"
            />
          </div>
        </div>

        {/* cumulative return vs benchmarks */}
        <Card
          title="Cumulative return"
          swatch="var(--c-blue)"
          aside={
            <div className="flex items-center gap-4 text-[12px] text-[var(--c-mid)] flex-wrap">
              <LegendKey color="#2563EB" label="Strategy" />
              <LegendKey color="#8FB6EC" label={benchKey} dashed />
              <LegendKey color="#B9BFC9" label="S&P 500" dashed />
            </div>
          }
        >
          <div className="h-[300px]">
            {loadingPerf ? (
              <Placeholder text="Loading performance…" />
            ) : returnSeries.length === 0 ? (
              <Placeholder text="No performance history yet" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={returnSeries} margin={{ top: 8, right: 36, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="perf-strat" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563EB" stopOpacity={0.26} />
                      <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--c-line)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "var(--c-mute)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={30}
                  />
                  <YAxis
                    tick={{ fill: "var(--c-mute)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={52}
                    tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                  />
                  <Tooltip content={<ChartTooltip format={(v) => signed(v * 100)} />} />
                  <Area
                    type="monotone"
                    dataKey="Strategy"
                    stroke="#2563EB"
                    strokeWidth={2}
                    fill="url(#perf-strat)"
                  />
                  <Line
                    type="monotone"
                    dataKey={benchKey}
                    stroke="#8FB6EC"
                    strokeWidth={2}
                    strokeDasharray="7 7"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="S&P 500"
                    stroke="#B9BFC9"
                    strokeWidth={1.5}
                    strokeDasharray="3 5"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* drawdown */}
        <Card
          title="Drawdown"
          swatch="var(--c-red)"
          aside={
            <span className="text-[12.5px] text-[var(--c-mute)]">
              Distance below the running peak
            </span>
          }
        >
          <div className="h-[180px]">
            {drawdownSeries.length === 0 ? (
              <Placeholder text="No drawdown history yet" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={drawdownSeries}
                  margin={{ top: 8, right: 36, bottom: 0, left: 0 }}
                >
                  <defs>
                    <linearGradient id="perf-dd" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#DE4A4F" stopOpacity={0} />
                      <stop offset="100%" stopColor="#DE4A4F" stopOpacity={0.3} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--c-line)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "var(--c-mute)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={30}
                  />
                  <YAxis
                    tick={{ fill: "var(--c-mute)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={56}
                    tickFormatter={(v: number) => `${(v * 100).toFixed(2)}%`}
                  />
                  <Tooltip content={<ChartTooltip format={(v) => `${(v * 100).toFixed(2)}%`} />} />
                  <Area
                    type="monotone"
                    dataKey="Drawdown"
                    stroke="#DE4A4F"
                    strokeWidth={2}
                    fill="url(#perf-dd)"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* strategy comparison — merged in from the Compare page */}
        <Card
          title="Strategy comparison"
          swatch="var(--c-ink)"
          aside={
            <span className="text-[12.5px] text-[var(--c-mute)]">
              Shariah Algo vs unrestricted Day Trader
            </span>
          }
        >
          {!loadingCompare && compare && !compare.daytrader_available && (
            <div className="bg-[var(--c-soft)] rounded-[var(--r-card)] px-4 py-3 text-[12.5px] text-[var(--c-mid)] leading-[1.55]">
              Day Trader account is not configured. Add{" "}
              <code className="text-[11.5px]">DAY_ALPACA_API_KEY</code> and{" "}
              <code className="text-[11.5px]">DAY_ALPACA_API_SECRET</code> to enable the benchmark
              comparison.
            </div>
          )}

          <div className="h-[260px]">
            {loadingCompare ? (
              <Placeholder text="Loading comparison…" />
            ) : equitySeries.length === 0 ? (
              <Placeholder text="No equity history yet" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={equitySeries} margin={{ top: 8, right: 36, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="var(--c-line)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "var(--c-mute)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={30}
                  />
                  <YAxis
                    domain={["auto", "auto"]}
                    tick={{ fill: "var(--c-mute)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={58}
                    tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<ChartTooltip format={(v) => money(v)} />} />
                  <Line
                    type="monotone"
                    dataKey="Shariah Algo"
                    stroke="#2563EB"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="Day Trader"
                    stroke="#7C5CFC"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          {compare && (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-7 pt-2">
              <StrategyMetrics_ m={compare.shariah} color="#2563EB" shariahMandate />
              <StrategyMetrics_
                m={compare.daytrader}
                color="#7C5CFC"
                pending={!compare.daytrader_available}
              />
            </div>
          )}
        </Card>

        {/* Cash flows are not tracked anywhere (issue #19), so returns cannot yet
            be separated from contributions. Stated rather than implied. */}
        <p className="text-[11.5px] text-[var(--c-mute)] leading-[1.6] pb-[26px]">
          Returns are computed from account equity and do not yet adjust for deposits or
          withdrawals — cash flows are not tracked. Realized P&amp;L and dividend income are also
          not recorded, so these figures reflect equity movement rather than a full
          time-weighted return.
        </p>
      </div>
    </ConsoleShell>
  );
}

function LegendKey({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <span
        className="w-4 h-0 border-t-2 block"
        style={{ borderColor: color, borderStyle: dashed ? "dashed" : "solid" }}
      />
      {label}
    </span>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className="h-full flex items-center justify-center border border-dashed border-[var(--c-line)] rounded-[var(--r-card)] text-[13px] text-[var(--c-mute)]">
      {text}
    </div>
  );
}
