import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TopTickerBar } from "../components/TopTickerBar";
import { HeroGlassCards } from "../components/HeroGlassCards";
import { MarketOverviewGlassTable } from "../components/MarketOverviewGlassTable";
import { PerformanceChart } from "../components/PerformanceChart";
import { ActivityFeed } from "../components/ActivityFeed";
import { RebalanceModal } from "../components/RebalanceModal";
import { OnboardingTutorial } from "../components/OnboardingTutorial";
import { api } from "../lib/api";
import { Shield, CheckCircle2, Zap } from "lucide-react";
import { GlassCard } from "../components/ui/GlassCard";

export function OverviewV2() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [rebalanceResult, setRebalanceResult] = useState<{ success: boolean; msg: string } | null>(null);

  const { data: status } = useQuery({
    queryKey: ["status"],
    queryFn: api.status,
    refetchInterval: 30_000,
  });

  const { data: account, isLoading: loadingAccount } = useQuery({
    queryKey: ["account"],
    queryFn: api.account,
    refetchInterval: 30_000,
  });

  const { data: positions, isLoading: loadingPortfolio } = useQuery({
    queryKey: ["portfolio"],
    queryFn: api.portfolio,
    refetchInterval: 30_000,
  });

  const { data: universeResponse, isLoading: loadingUniverse } = useQuery({
    queryKey: ["universe"],
    queryFn: api.universe,
    refetchInterval: 300_000,
  });

  const { data: performance } = useQuery({
    queryKey: ["performance"],
    queryFn: api.performance,
    refetchInterval: 300_000,
  });

  const { data: activity } = useQuery({
    queryKey: ["activity"],
    queryFn: () => api.activity(),
    refetchInterval: 30_000,
  });

  const { data: compliance, isLoading: loadingCompliance } = useQuery({
    queryKey: ["compliance"],
    queryFn: api.compliance,
    refetchInterval: 60_000,
  });

  const universeStocks = universeResponse?.stocks || [];
  const topStock = universeStocks.length > 0 ? universeStocks[0] : undefined;

  return (
    <div className="space-y-6 pb-12 bg-ambient-violet min-h-screen">
      {/* Top Ticker Marquee Bar */}
      <TopTickerBar isLive={status?.is_live} />

      <div className="space-y-6 px-2 sm:px-4">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold font-sans text-white tracking-tight">
                Quantix Glass Overview
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-mono text-[10px] font-bold uppercase tracking-wider">
                V2 Beta Layout
              </span>
            </div>
            <p className="text-xs text-slate-400 font-sans mt-0.5">
              Live Shariah 4-Factor multi-factor telemetry, compliance verification, and Alpaca execution
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Sync Active
            </span>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(99,102,241,0.4)] cursor-pointer flex items-center gap-2"
            >
              <Zap size={14} />
              <span>Trigger Rebalance</span>
            </button>
          </div>
        </div>

        {rebalanceResult && (
          <div
            className={`border rounded-2xl p-4 flex items-center justify-between gap-3 text-xs font-mono backdrop-blur-md ${
              rebalanceResult.success
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-rose-500/10 border-rose-500/30 text-rose-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {rebalanceResult.success ? <CheckCircle2 size={16} /> : <Zap size={16} />}
              <span>{rebalanceResult.msg}</span>
            </div>
            <button
              type="button"
              onClick={() => setRebalanceResult(null)}
              className="text-[10px] underline hover:no-underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {account?.fee_status_label === "Connect Alpaca API in Settings" && (
          <OnboardingTutorial />
        )}

        {/* 3 Quantix Hero Glass Cards */}
        <HeroGlassCards
          portfolioValue={account?.portfolio_value ?? 0}
          dayPl={account?.dayl_pl ?? 0}
          dayPlPct={account?.dayl_pl_pct ?? 0}
          isCompliant={compliance?.compliant ?? true}
          violationsCount={compliance?.violations.length ?? 0}
          universeSize={compliance?.universe_size ?? universeStocks.length ?? 150}
          heldCount={positions?.length ?? 0}
          topStockSymbol={topStock?.symbol ?? "NVDA"}
          topStockScore={topStock?.factor_score ?? 2.45}
          topStockSector={topStock?.company_name ?? "Technology"}
          loading={loadingAccount || loadingCompliance}
        />

        {/* Performance Curve Chart */}
        <GlassCard>
          <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
            <div>
              <h2 className="text-sm font-bold font-mono text-white uppercase tracking-wider">
                Strategy Equity & Benchmark Performance
              </h2>
              <p className="text-[11px] text-slate-400 font-sans">
                Shariah 4-Factor Portfolio vs SPUS Shariah ETF & S&P 500 Index
              </p>
            </div>
            <span className="text-xs font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-full">
              Daily Snapshots
            </span>
          </div>
          {performance ? <PerformanceChart data={performance} /> : <div className="h-48 bg-slate-950/40 rounded-xl animate-pulse" />}
        </GlassCard>

        {/* Main Dual-Tabbed Table Section */}
        <MarketOverviewGlassTable
          positions={positions || []}
          universe={universeStocks}
          onTriggerRebalance={() => setIsModalOpen(true)}
          loadingPositions={loadingPortfolio}
          loadingUniverse={loadingUniverse}
        />

        {/* Activity Feed / Audit Trail */}
        <GlassCard>
          <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2.5">
            <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Shield size={14} className="text-emerald-400" />
              <span>Compliance & Execution Audit Feed</span>
            </h2>
            <span className="text-[11px] text-slate-400 font-mono">Live Telemetry</span>
          </div>
          {activity ? <ActivityFeed entries={activity.entries} /> : <div className="h-32 bg-slate-950/40 rounded-xl animate-pulse" />}
        </GlassCard>
      </div>

      <RebalanceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => setRebalanceResult({ success: true, msg: "Rebalance triggered successfully" })}
      />
    </div>
  );
}
