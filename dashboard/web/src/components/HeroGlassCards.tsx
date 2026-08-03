import { TrendingUp, ShieldCheck, Award, ArrowUpRight, ArrowDownRight, CheckCircle2 } from "lucide-react";
import { GlassCard } from "./ui/GlassCard";
import { formatCurrency, formatPct } from "../lib/utils";

interface HeroGlassCardsProps {
  portfolioValue: number;
  dayPl: number;
  dayPlPct: number;
  isCompliant: boolean;
  violationsCount: number;
  universeSize: number;
  heldCount: number;
  topStockSymbol?: string;
  topStockScore?: number;
  topStockSector?: string;
  loading?: boolean;
}

export function HeroGlassCards({
  portfolioValue,
  dayPl,
  dayPlPct,
  isCompliant,
  violationsCount,
  universeSize,
  heldCount,
  topStockSymbol = "NVDA",
  topStockScore = 2.45,
  topStockSector = "Technology",
  loading = false,
}: HeroGlassCardsProps) {
  const isPositive = dayPlPct >= 0;

  // Mini sparkline points (SVG polyline)
  const sparklinePoints = isPositive
    ? "0,35 15,32 30,38 45,25 60,28 75,18 90,22 105,10 120,14 135,5 150,8"
    : "0,10 15,15 30,12 45,22 60,18 75,28 90,25 105,32 120,30 135,38 150,35";

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {/* Card 1: Portfolio Value & Daily Return */}
      <GlassCard className="relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Total Portfolio Value</span>
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <TrendingUp size={16} />
          </div>
        </div>

        <div className="mt-3">
          {loading ? (
            <div className="h-9 w-36 bg-slate-800/50 rounded animate-pulse" />
          ) : (
            <div className="text-3xl font-bold font-sans text-white tracking-tight">
              {formatCurrency(portfolioValue)}
            </div>
          )}

          <div className="mt-2 flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full font-mono ${
                isPositive
                  ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                  : "bg-rose-500/15 border border-rose-500/30 text-rose-400"
              }`}
            >
              {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {formatPct(dayPlPct)} Today
            </span>
            <span className="text-xs text-slate-400 font-mono">
              ({formatCurrency(dayPl)})
            </span>
          </div>
        </div>

        {/* Mini sparkline chart SVG */}
        <div className="mt-4 pt-2 border-t border-white/5 flex items-end justify-between">
          <span className="text-[11px] text-slate-500 font-mono">7-Day Return Curve</span>
          <svg className="w-28 h-8 overflow-visible" viewBox="0 0 150 40">
            <polyline
              fill="none"
              stroke={isPositive ? "#10B981" : "#F43F5E"}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={sparklinePoints}
            />
          </svg>
        </div>
      </GlassCard>

      {/* Card 2: Shariah Compliance & Universe Health */}
      <GlassCard className="relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Shariah Compliance Health</span>
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center border ${
              isCompliant
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : "bg-rose-500/10 border-rose-500/20 text-rose-400"
            }`}
          >
            <ShieldCheck size={16} />
          </div>
        </div>

        <div className="mt-3">
          {loading ? (
            <div className="h-9 w-36 bg-slate-800/50 rounded animate-pulse" />
          ) : (
            <div className="text-3xl font-bold font-sans text-white tracking-tight flex items-center gap-2">
              {isCompliant ? (
                <>
                  <span>100% Screened</span>
                  <CheckCircle2 size={22} className="text-emerald-400" />
                </>
              ) : (
                <span className="text-rose-400">{violationsCount} Violations</span>
              )}
            </div>
          )}

          <div className="mt-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Daily Scan Passed
            </span>
            <span className="text-xs text-slate-400 font-mono">
              {heldCount}/{heldCount || 20} Held
            </span>
          </div>
        </div>

        <div className="mt-4 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>SPUS Snapshot Pool</span>
          <span className="text-emerald-300 font-semibold">{universeSize || 150} Eligible Stocks</span>
        </div>
      </GlassCard>

      {/* Card 3: Factor Score Leader */}
      <GlassCard className="relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Top Factor Score Leader</span>
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Award size={16} />
          </div>
        </div>

        <div className="mt-3">
          {loading ? (
            <div className="h-9 w-36 bg-slate-800/50 rounded animate-pulse" />
          ) : (
            <div className="text-3xl font-bold font-sans text-white tracking-tight flex items-center gap-3">
              <span>{topStockSymbol}</span>
              <span className="text-xs font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                Rank #1
              </span>
            </div>
          )}

          <div className="mt-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono">
              Score: +{topStockScore.toFixed(2)} z
            </span>
            <span className="text-xs text-slate-400 font-sans">
              {topStockSector}
            </span>
          </div>
        </div>

        <div className="mt-4 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>4-Factor Weights</span>
          <span className="text-indigo-300 font-semibold">25% Mom · Quality · Vol · FCF</span>
        </div>
      </GlassCard>
    </div>
  );
}
