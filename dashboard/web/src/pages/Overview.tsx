import { useQuery } from "@tanstack/react-query";
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

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-neutral-100">Overview</h1>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Portfolio Value"
          value={account ? formatCurrency(account.portfolio_value) : "—"}
          loading={loadingAccount}
        />
        <KPICard
          label="Daily P&L"
          value={
            account ? (
              <span className={plColor(account.dayl_pl)}>
                {formatCurrency(account.dayl_pl)}
              </span>
            ) : "—"
          }
          sub={account ? <span className={plColor(account.dayl_pl_pct)}>{formatPct(account.dayl_pl_pct)}</span> : undefined}
          loading={loadingAccount}
        />
        <KPICard
          label="Cash"
          value={account ? formatCurrency(account.cash) : "—"}
          loading={loadingAccount}
        />
        <KPICard
          label="Compliance"
          value={
            complianceExits === 0 ? (
              <span className="text-emerald-400">Fully Compliant</span>
            ) : (
              <span className="text-amber-400">{complianceExits} Exit{complianceExits !== 1 ? "s" : ""} Today</span>
            )
          }
        />
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Performance vs SPUS (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPerf ? (
              <Skeleton className="h-64 w-full" />
            ) : performance && performance.dates.length > 0 ? (
              <PerformanceChart data={performance} />
            ) : (
              <p className="text-neutral-500 text-sm py-8 text-center">No performance data</p>
            )}
          </CardContent>
        </Card>
        <SchedulerStatus />
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Top Holdings</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPortfolio ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : (
              <HoldingsTable positions={positions ?? []} compact />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityFeed entries={activity?.entries ?? []} compact />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
