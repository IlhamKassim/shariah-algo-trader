import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Zap, CheckCircle2 } from "lucide-react";



import { api } from "../lib/api";
import { formatCurrency, formatPct, plColor } from "../lib/utils";
import { ActivityFeed } from "../components/ActivityFeed";
import { HoldingsTable } from "../components/HoldingsTable";
import { Hero, HeroStat, HeroFacts } from "../components/Hero";
import { PerformanceChart } from "../components/PerformanceChart";
import { SchedulerStatus } from "../components/SchedulerStatus";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Skeleton } from "../components/ui/Skeleton";
import { OnboardingTutorial } from "../components/OnboardingTutorial";
import { RebalanceModal } from "../components/RebalanceModal";

export function Overview() {
  const queryClient = useQueryClient();
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
  const { data: activity } = useQuery({
    queryKey: ["activity"],
    queryFn: () => api.activity(),
    refetchInterval: 30_000,
  });
  const { data: performance, isLoading: loadingPerf } = useQuery({
    queryKey: ["performance"],
    queryFn: api.performance,
    refetchInterval: 300_000,
  });

  const { data: compliance, isLoading: loadingCompliance } = useQuery({
    queryKey: ["compliance"],
    queryFn: api.compliance,
    refetchInterval: 60_000,
  });

  const cashPct = account && account.portfolio_value > 0
    ? ((account.cash / account.portfolio_value) * 100).toFixed(1)
    : null;

  const complianceValue = compliance?.compliant ? (
    <span className="text-brand-green">Screened</span>
  ) : (
    <span className="text-brand-red">
      {compliance?.violations.length ?? 0} Violation{compliance?.violations.length !== 1 ? "s" : ""}
    </span>
  );
  const complianceSub = (
    <>
      {compliance?.held_count ?? 0} held · {compliance?.universe_size ?? 0} in universe
      <span className="block mt-0.5 text-faint">Debt-ratio screen · Universe pre-screened by SPUS</span>
      {compliance && !compliance.compliant && compliance.violations.length > 0 && (
        <span className="block mt-0.5 text-brand-red">
          {compliance.violations.join(", ")}
        </span>
      )}
    </>
  );

  return (
    <div className="space-y-6">


      {rebalanceResult && (
        <div
          className={`border rounded-xl p-4 flex items-center justify-between gap-3 text-xs font-mono animate-fadeIn ${
            rebalanceResult.success
              ? "bg-brand-green/10 border-brand-green/40 text-brand-green"
              : "bg-brand-red/10 border-brand-red/40 text-brand-red"
          }`}
        >
          <div className="flex items-center gap-2.5">
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

      {positions && positions.length === 0 && account && account.portfolio_value > 0 && (
        <div className="bg-gradient-to-r from-amber-950/40 via-yellow-950/30 to-amber-950/40 border border-brand-gold/40 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[0_0_25px_rgba(212,175,55,0.1)] animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-gold/20 border border-brand-gold/40 flex items-center justify-center text-brand-gold shrink-0">
              <Zap size={20} className="animate-pulse" />
            </div>
            <div>
              <span className="font-bold text-foreground text-xs uppercase tracking-wider block">
                ⚡ Account Ready — Initial Portfolio Allocation Available
              </span>
              <span className="text-muted text-[11px] font-sans leading-relaxed block mt-0.5">
                Your account holds <strong>0 stock positions</strong> with <strong>{formatCurrency(account.portfolio_value)}</strong> capital. Click below to instantly trigger factor ranking and allocate your portfolio.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-brand-gold text-slate-950 font-bold text-xs uppercase tracking-wider rounded hover:bg-brand-gold/90 transition-all shadow-md shrink-0 cursor-pointer"
          >
            ⚡ Initialise Portfolio & Rebalance Now
          </button>
        </div>
      )}

      {account?.fee_status_label === "Connect Alpaca API in Settings" && (
        <OnboardingTutorial />
      )}
      <Hero>
        <HeroStat
          label="Portfolio Value"
          value={account ? formatCurrency(account.portfolio_value) : "—"}
          sub={
            account ? (
              <span className={plColor(account.dayl_pl_pct)}>
                {formatPct(account.dayl_pl_pct)} today
              </span>
            ) : undefined
          }
          loading={loadingAccount}
        />
        <HeroFacts
          facts={[
            {
              label: "Daily P&L",
              loading: loadingAccount,
              value: account ? (
                <span className={plColor(account.dayl_pl)}>{formatCurrency(account.dayl_pl)}</span>
              ) : (
                "—"
              ),
              sub: account ? (
                <span className={plColor(account.dayl_pl_pct)}>
                  {formatPct(account.dayl_pl_pct)} vs prior close
                </span>
              ) : undefined,
            },
            {
              label: "Cash",
              loading: loadingAccount,
              value: account ? formatCurrency(account.cash) : "—",
              sub: cashPct != null ? `${cashPct}% of book` : undefined,
            },
            {
              label: "Shariah Screen",
              loading: loadingCompliance,
              value: complianceValue,
              sub: complianceSub,
            },
            {
              label: "Fee Drag & Cost",
              loading: loadingAccount,
              value: account ? formatCurrency(account.estimated_fees ?? 0) : "—",
              sub: (
                <span className="block text-faint">
                  {account?.fee_status_label ?? "Ultra-Low Drag (<0.05%)"}
                </span>
              ),
            },
          ]}
        />
      </Hero>

      {/* Middle row: chart + scheduler */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <div className="border-b border-divider pb-3 mb-4">
            <p className="text-[11px] font-semibold text-section uppercase tracking-[0.09em]">
              Performance vs SPUS
            </p>
            <p className="text-[11px] text-faint mt-0.5">Cumulative return · Last 30 days</p>
          </div>
          {loadingPerf ? (
            <Skeleton className="h-64 w-full" />
          ) : performance && performance.dates.length > 0 ? (
            <PerformanceChart data={performance} />
          ) : (
            <p className="text-faint text-sm py-8 text-center">No performance data</p>
          )}
        </div>
        <SchedulerStatus />
      </div>

      {/* Bottom row: holdings + activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Top Holdings</CardTitle>
            <Link to="/app/portfolio" className="text-[11px] text-brand-blue hover:text-brand-blue/80 transition-colors">
              View all →
            </Link>
          </CardHeader>
          <CardContent>
            {loadingPortfolio ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <HoldingsTable positions={positions ?? []} compact />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Activity</CardTitle>
            <Link to="/app/activity" className="text-[11px] text-brand-blue hover:text-brand-blue/80 transition-colors">
              View log →
            </Link>
          </CardHeader>
          <CardContent>
            <ActivityFeed entries={activity?.entries ?? []} compact />
          </CardContent>
        </Card>
      </div>

      <RebalanceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["portfolio"] });
          queryClient.invalidateQueries({ queryKey: ["account"] });
          queryClient.invalidateQueries({ queryKey: ["activity"] });
        }}
        accountData={account ? { portfolio_value: account.portfolio_value, cash: account.cash, trading_mode: status?.is_live ? "live" : "paper" } : undefined}
      />
    </div>
  );
}
