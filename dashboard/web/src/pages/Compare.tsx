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
import { Skeleton } from "../components/ui/Skeleton";
import { StatBlock } from "../components/ui/StatBlock";
import { CHART } from "../lib/chartColors";

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
    <div className="py-3 border-b border-divider last:border-0 last:pb-0">
      <StatBlock label={label} value={value} sub={sub} valueClassName={`text-xl font-bold ${color}`} />
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
    <div className="flex flex-col">
      <div className="flex items-center gap-2 mb-1 pb-3 border-b border-divider">
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
      <div className="space-y-6" aria-label="Loading comparison">
        <Skeleton className="h-72 w-full" />
        <div className="grid grid-cols-2 gap-6">
          {[0, 1].map((i) => (
            <div key={i} className="flex flex-col gap-3">
              <Skeleton className="h-6 w-32" />
              {[...Array(5)].map((_, j) => <Skeleton key={j} className="h-14 w-full" />)}
            </div>
          ))}
        </div>
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
        <div className="border-l-2 border-brand-gold bg-brand-gold/5 pl-4 py-3 text-sm text-brand-gold">
          Day trader account not configured yet — add{" "}
          <code className="font-mono text-xs">DAY_ALPACA_API_KEY</code> and{" "}
          <code className="font-mono text-xs">DAY_ALPACA_API_SECRET</code> to your environment
          to enable the comparison.
        </div>
      )}

      {/* Equity curve chart */}
      <div>
        <p className="text-[10px] font-semibold text-section uppercase tracking-[0.09em] mb-4 pb-3 border-b border-divider">
          Equity Curve Comparison (1 Month)
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
            <XAxis
              dataKey="date"
              tick={{ fill: CHART.tickText, fontSize: 10 }}
              tickFormatter={(v) => v.slice(5)}
            />
            <YAxis
              tick={{ fill: CHART.tickText, fontSize: 10 }}
              tickFormatter={(v) =>
                `$${(v / 1000).toFixed(0)}k`
              }
              width={52}
            />
            <Tooltip
              contentStyle={{ background: CHART.bg, border: `1px solid ${CHART.grid}`, borderRadius: 0 }}
              labelStyle={{ color: CHART.tickText, fontSize: 11 }}
              formatter={(value, name) => [
                `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
                name === "shariah" ? "Shariah Algo" : "Day Trader",
              ]}
            />
            <Legend
              formatter={(value) => (value === "shariah" ? "Shariah Algo" : "Day Trader")}
              wrapperStyle={{ fontSize: 11, color: CHART.tickText }}
            />
            <Line
              type="monotone"
              dataKey="shariah"
              stroke={CHART.gold}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            {data.daytrader_available && (
              <Line
                type="monotone"
                dataKey="daytrader"
                stroke={CHART.secondary}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Side-by-side metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <StrategyColumn m={data.shariah} color={CHART.gold} />
        <StrategyColumn
          m={data.daytrader_available ? data.daytrader : { ...data.daytrader, name: "Day Trader (pending)" }}
          color={CHART.secondary}
        />
      </div>
    </div>
  );
}
