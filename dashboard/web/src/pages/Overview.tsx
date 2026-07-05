import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { formatCurrency, formatPct, plColor } from "../lib/utils";
import { ActivityFeed } from "../components/ActivityFeed";
import { HoldingsTable } from "../components/HoldingsTable";
import { Hero, HeroStat, HeroFacts } from "../components/Hero";
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

  const complianceValue = compliance?.compliant ? (
    <span className="text-brand-green">Compliant</span>
  ) : (
    <span className="text-brand-red">
      {compliance?.violations.length ?? 0} Violation{compliance?.violations.length !== 1 ? "s" : ""}
    </span>
  );
  const complianceSub = (
    <>
      {compliance?.held_count ?? 0} held · {compliance?.universe_size ?? 0} in universe
      <span className="block mt-0.5 text-faint">AAOIFI screens · No interest income</span>
      {compliance && !compliance.compliant && compliance.violations.length > 0 && (
        <span className="block mt-0.5 text-brand-red">
          {compliance.violations.join(", ")}
        </span>
      )}
    </>
  );

  return (
    <div className="space-y-6">
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
          loading={loadingAccount || loadingCompliance}
          facts={[
            {
              label: "Daily P&L",
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
              value: account ? formatCurrency(account.cash) : "—",
              sub: cashPct != null ? `${cashPct}% of book` : undefined,
            },
            {
              label: "Shariah Compliance",
              value: complianceValue,
              sub: complianceSub,
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
