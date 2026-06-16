import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { api } from "../lib/api";
import { formatCurrency, formatPct, plColor } from "../lib/utils";
import { ActivityFeed } from "../components/ActivityFeed";
import { HoldingsTable } from "../components/HoldingsTable";
import { KPICard } from "../components/KPICard";
import { PerformanceChart } from "../components/PerformanceChart";
import { SchedulerStatus } from "../components/SchedulerStatus";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Skeleton } from "../components/ui/Skeleton";

export function Overview() {
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

  const complianceExits = activity?.entries.filter(
    (e) => e.type === "compliance" && e.message.includes("Compliance Exit")
  ).length ?? 0;

  const cashPct = account && account.portfolio_value > 0
    ? ((account.cash / account.portfolio_value) * 100).toFixed(1)
    : null;

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
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
        <KPICard
          label="Daily P&L"
          value={
            account ? (
              <span className={plColor(account.dayl_pl)}>
                {formatCurrency(account.dayl_pl)}
              </span>
            ) : (
              "—"
            )
          }
          sub={
            account ? (
              <span className={plColor(account.dayl_pl_pct)}>
                {formatPct(account.dayl_pl_pct)} vs prior close
              </span>
            ) : undefined
          }
          loading={loadingAccount}
        />
        <KPICard
          label="Cash"
          value={account ? formatCurrency(account.cash) : "—"}
          sub={cashPct != null ? `${cashPct}% of book` : undefined}
          loading={loadingAccount}
        />
        {/* Shariah Compliance — custom card, not KPICard */}
        <Card className="p-5">
          <p className="text-[10px] font-semibold text-section uppercase tracking-[0.09em] mb-3">
            Shariah Compliance
          </p>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full border-2 border-brand-green/20 bg-[#34E3AE]/10 flex items-center justify-center shrink-0">
              <CheckCircle2 size={20} className="text-brand-green" />
            </div>
            <div>
              {complianceExits === 0 ? (
                <p className="text-[15px] font-semibold text-brand-green leading-tight">
                  Fully Compliant
                </p>
              ) : (
                <p className="text-[15px] font-semibold text-brand-gold leading-tight">
                  {complianceExits} Exit{complianceExits !== 1 ? "s" : ""} Today
                </p>
              )}
              <p className="text-[11px] text-muted mt-0.5">
                {complianceExits} violations · {positions?.length ?? 0} screened
              </p>
            </div>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <span className="text-[10px] bg-card-hover border border-card-border text-faint px-2.5 py-1 rounded-full">
              AAOIFI screens
            </span>
            <span className="text-[10px] bg-card-hover border border-card-border text-faint px-2.5 py-1 rounded-full">
              No interest income
            </span>
          </div>
        </Card>
      </div>

      {/* Middle row: chart + scheduler */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Performance vs SPUS</CardTitle>
            <p className="text-[11px] text-faint mt-0.5">Cumulative return · Last 30 days</p>
          </CardHeader>
          <CardContent>
            {loadingPerf ? (
              <Skeleton className="h-64 w-full" />
            ) : performance && performance.dates.length > 0 ? (
              <PerformanceChart data={performance} />
            ) : (
              <p className="text-faint text-sm py-8 text-center">No performance data</p>
            )}
          </CardContent>
        </Card>
        <SchedulerStatus />
      </div>

      {/* Bottom row: holdings + activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Top Holdings</CardTitle>
            <a href="/portfolio" className="text-[11px] text-brand-blue hover:text-brand-blue/80 transition-colors">
              View all →
            </a>
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
            <a href="/activity" className="text-[11px] text-brand-blue hover:text-brand-blue/80 transition-colors">
              View log →
            </a>
          </CardHeader>
          <CardContent>
            <ActivityFeed entries={activity?.entries ?? []} compact />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
