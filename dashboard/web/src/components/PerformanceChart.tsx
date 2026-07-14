import { useState } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { PerformanceResponse } from "../lib/api";
import { CHART } from "../lib/chartColors";

interface PerformanceChartProps {
  data: PerformanceResponse;
}

const PERIODS = ["1W", "1M", "3M", "6M"] as const;
type Period = (typeof PERIODS)[number];
const PERIOD_DAYS: Record<Period, number> = { "1W": 7, "1M": 30, "3M": 90, "6M": 180 };

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-card-border rounded-none p-3 text-xs">
      <p className="text-faint font-mono mb-1.5">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="font-mono tabular-nums" style={{ color: p.color }}>
          {p.name}: {(p.value * 100).toFixed(2)}%
        </p>
      ))}
    </div>
  );
}

export function PerformanceChart({ data }: PerformanceChartProps) {
  const [period, setPeriod] = useState<Period>("1M");

  const allPoints = data.dates.map((date, i) => ({
    date,
    Strategy: data.portfolio_cumulative[i],
    SPUS: data.benchmark_cumulative[i],
    sp500: data.sp500_cumulative[i],
  }));

  const filtered = allPoints.slice(-PERIOD_DAYS[period]);

  const last = filtered.at(-1);
  const stratVal = last?.Strategy ?? 0;
  const spusVal = last?.SPUS ?? 0;
  const sp500Val = last?.sp500 ?? 0;
  const alphaVal = stratVal - spusVal;
  const sign = (v: number) => (v >= 0 ? "+" : "");

  return (
    <div>
      {/* Stats + period toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-x-4 gap-y-1.5 text-[11px] flex-wrap">
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-4 h-0.5 bg-brand-gold inline-block" />
            <span className="text-muted">Strategy</span>
            <span className="font-mono font-semibold text-brand-gold tabular-nums">
              {sign(stratVal)}{(stratVal * 100).toFixed(2)}%
            </span>
          </span>
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-4 h-0.5 inline-block" style={{ borderTop: `2px dashed ${CHART.tickText}`, background: "transparent" }} />
            <span className="text-muted">SPUS</span>
            <span className="font-mono font-semibold text-muted tabular-nums">
              {sign(spusVal)}{(spusVal * 100).toFixed(2)}%
            </span>
          </span>
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-4 h-0.5 inline-block" style={{ borderTop: `2px dashed ${CHART.secondary}`, background: "transparent" }} />
            <span className="text-muted">S&amp;P 500</span>
            <span className="font-mono font-semibold tabular-nums" style={{ color: CHART.secondary }}>
              {sign(sp500Val)}{(sp500Val * 100).toFixed(2)}%
            </span>
          </span>
          <span className="text-muted whitespace-nowrap">
            Alpha vs SPUS{" "}
            <span className={`font-mono font-semibold tabular-nums ${alphaVal >= 0 ? "text-brand-green" : "text-brand-red"}`}>
              {sign(alphaVal)}{(alphaVal * 100).toFixed(2)} pts
            </span>
          </span>
        </div>
        <div className="flex gap-3 sm:self-auto self-start">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`pb-1 text-[11px] font-medium border-b-2 transition-colors ${
                period === p
                  ? "text-brand-gold border-brand-gold"
                  : "text-faint border-transparent hover:text-muted"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={230}>
        <ComposedChart data={filtered} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="stratGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART.gold} stopOpacity={0.18} />
              <stop offset="95%" stopColor={CHART.gold} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: CHART.tickText, fontSize: 10, fontFamily: "IBM Plex Mono" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => v.slice(5)}
          />
          <YAxis
            tick={{ fill: CHART.tickText, fontSize: 10, fontFamily: "IBM Plex Mono" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            width={36}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="Strategy"
            stroke={CHART.gold}
            strokeWidth={2}
            fill="url(#stratGrad)"
            dot={false}
            activeDot={{ r: 4, fill: CHART.gold, strokeWidth: 0 }}
          />
          <Line
            type="monotone"
            dataKey="SPUS"
            stroke={CHART.tickText}
            strokeWidth={1.5}
            strokeDasharray="5 4"
            dot={false}
            activeDot={{ r: 3, fill: CHART.tickText, strokeWidth: 0 }}
          />
          <Line
            type="monotone"
            dataKey="sp500"
            name="S&P 500"
            stroke={CHART.secondary}
            strokeWidth={1.5}
            strokeDasharray="5 4"
            dot={false}
            activeDot={{ r: 3, fill: CHART.secondary, strokeWidth: 0 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
