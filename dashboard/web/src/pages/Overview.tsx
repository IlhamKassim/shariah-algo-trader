import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
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

  const { data: compliance, isLoading: loadingCompliance } = useQuery({
    queryKey: ["compliance"],
    queryFn: api.compliance,
    refetchInterval: 60_000,
  });

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
        {/* Shariah Compliance — real-time check against universe cache */}
        <Card className="p-5">
          <p className="text-[10px] font-semibold text-section uppercase tracking-[0.09em] mb-3">
            Shariah Compliance
          </p>
          {loadingCompliance ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  compliance?.compliant
                    ? "border-brand-green/20 bg-[#34E3AE]/10"
                    : "border-brand-red/20 bg-[#FF8A94]/10"
                }`}>
                  {compliance?.compliant
                    ? <CheckCircle2 size={20} className="text-brand-green" aria-hidden="true" />
                    : <AlertTriangle size={20} className="text-brand-red" aria-hidden="true" />
                  }
                </div>
                <div>
                  {compliance?.compliant ? (
                    <p className="text-[15px] font-semibold text-brand-green leading-tight">
                      Fully Compliant
                    </p>
                  ) : (
                    <p className="text-[15px] font-semibold text-brand-red leading-tight">
                      {compliance?.violations.length} Violation{compliance?.violations.length !== 1 ? "s" : ""}
                    </p>
                  )}
                  <p className="text-[11px] text-muted mt-0.5">
                    {compliance?.held_count ?? 0} held · {compliance?.universe_size ?? 0} in universe
                  </p>
                </div>
              </div>
              {compliance && !compliance.compliant && compliance.violations.length > 0 && (
                <div className="flex gap-1 flex-wrap mb-3">
                  {compliance.violations.map((v) => (
                    <span key={v} className="text-[11px] font-mono bg-[#FF8A94]/10 border border-[#FF8A94]/20 text-brand-red px-2 py-0.5 rounded">
                      {v}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-1.5 flex-wrap">
                <span className="text-[10px] bg-card-hover border border-card-border text-faint px-2.5 py-1 rounded-full">
                  AAOIFI screens
                </span>
                <span className="text-[10px] bg-card-hover border border-card-border text-faint px-2.5 py-1 rounded-full">
                  No interest income
                </span>
              </div>
            </>
          )}
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
