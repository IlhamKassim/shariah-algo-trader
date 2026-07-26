import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Flame } from "lucide-react";
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

export function Overview() {
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
      {status?.is_live && (
        <div className="bg-gradient-to-r from-rose-950/60 via-red-950/40 to-rose-950/60 border border-rose-500/40 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono shadow-[0_0_20px_rgba(244,63,94,0.15)] animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
              <Flame size={18} className="animate-pulse" />
            </div>
            <div>
              <span className="font-bold text-rose-300 uppercase tracking-wider block">
                🔴 LIVE REAL MONEY TRADING ENVIRONMENT ACTIVE
              </span>
              <span className="text-rose-200/70 font-sans text-[11px]">
                Orders and rebalance triggers are being executed with live capital on <code className="font-mono text-rose-300">https://api.alpaca.markets</code>.
              </span>
            </div>
          </div>
          <Link
            to="/settings"
            className="px-3.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/50 text-rose-200 text-[10px] uppercase font-bold tracking-widest rounded transition-all cursor-pointer whitespace-nowrap"
          >
            Manage Environment
          </Link>
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
            <Link to="/portfolio" className="text-[11px] text-brand-blue hover:text-brand-blue/80 transition-colors">
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
            <Link to="/activity" className="text-[11px] text-brand-blue hover:text-brand-blue/80 transition-colors">
              View log →
            </Link>
          </CardHeader>
          <CardContent>
            <ActivityFeed entries={activity?.entries ?? []} compact />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
