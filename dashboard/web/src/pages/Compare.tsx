import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, type StrategyMetrics } from "../lib/api";

function MetricCard({
  label,
  value,
  sub,
  positive,
}: {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
}) {
  const color =
    positive === undefined
      ? "text-primary"
      : positive
      ? "text-brand-green"
      : "text-brand-red";
  return (
    <div className="rounded-xl border border-card-border bg-card p-4">
      <p className="text-[10px] font-semibold text-section uppercase tracking-[0.09em] mb-1">
        {label}
      </p>
      <p className={`text-xl font-bold font-mono tabular-nums ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-faint mt-0.5">{sub}</p>}
    </div>
  );
}

function StrategyColumn({
  m,
  color,
}: {
  m: StrategyMetrics;
  color: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-3 h-3 rounded-full" style={{ background: color }} />
        <span className="text-sm font-semibold text-primary">{m.name}</span>
      </div>
      <MetricCard
        label="Equity"
        value={`$${m.current_equity.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
      />
      <MetricCard
        label="Total Return"
        value={`${m.total_return_pct >= 0 ? "+" : ""}${m.total_return_pct.toFixed(2)}%`}
        positive={m.total_return_pct >= 0}
      />
      <MetricCard
        label="Sharpe Ratio"
        value={m.sharpe_ratio.toFixed(2)}
        sub="Annualised — higher is better"
        positive={m.sharpe_ratio > 0}
      />
      <MetricCard
        label="Max Drawdown"
        value={`${m.max_drawdown_pct.toFixed(2)}%`}
        sub="Peak-to-trough — closer to 0 is better"
        positive={false}
      />
      <MetricCard
        label="Win Rate"
        value={`${m.win_rate_pct.toFixed(1)}%`}
        sub="% of trading days with positive P&L"
        positive={m.win_rate_pct >= 50}
      />
    </div>
  );
}

export function Compare() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["compare"],
    queryFn: api.compare,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted text-sm">
        Loading comparison data...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-brand-red text-sm">
        Failed to load comparison data.
      </div>
    );
  }

  const chartData = data.dates.map((date, i) => ({
    date,
    shariah: data.shariah_equity[i] ?? null,
    daytrader: data.daytrader_available ? (data.daytrader_equity[i] ?? null) : null,
  }));

  return (
    <div className="space-y-6">
      {!data.daytrader_available && (
        <div className="rounded-xl border border-brand-gold/30 bg-brand-gold/5 px-4 py-3 text-sm text-brand-gold">
          Day trader account not configured yet — add{" "}
          <code className="font-mono text-xs">DAY_ALPACA_API_KEY</code> and{" "}
          <code className="font-mono text-xs">DAY_ALPACA_API_SECRET</code> to your environment
          to enable the comparison.
        </div>
      )}

      {/* Equity curve chart */}
      <div className="rounded-xl border border-card-border bg-card p-5">
        <p className="text-[10px] font-semibold text-section uppercase tracking-[0.09em] mb-4">
          Equity Curve Comparison (1 Month)
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2530" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#6b7280", fontSize: 10 }}
              tickFormatter={(v) => v.slice(5)}
            />
            <YAxis
              tick={{ fill: "#6b7280", fontSize: 10 }}
              tickFormatter={(v) =>
                `$${(v / 1000).toFixed(0)}k`
              }
              width={52}
            />
            <Tooltip
              contentStyle={{ background: "#0d1117", border: "1px solid #1e2530", borderRadius: 8 }}
              labelStyle={{ color: "#9ca3af", fontSize: 11 }}
              formatter={(value: number, name: string) => [
                `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
                name === "shariah" ? "Shariah Algo" : "Day Trader",
              ]}
            />
            <Legend
              formatter={(value) => (value === "shariah" ? "Shariah Algo" : "Day Trader")}
              wrapperStyle={{ fontSize: 11, color: "#9ca3af" }}
            />
            <Line
              type="monotone"
              dataKey="shariah"
              stroke="#34E3AE"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            {data.daytrader_available && (
              <Line
                type="monotone"
                dataKey="daytrader"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Side-by-side metrics */}
      <div className="grid grid-cols-2 gap-6">
        <StrategyColumn m={data.shariah} color="#34E3AE" />
        <StrategyColumn
          m={data.daytrader_available ? data.daytrader : { ...data.daytrader, name: "Day Trader (pending)" }}
          color="#f59e0b"
        />
      </div>
    </div>
  );
}
