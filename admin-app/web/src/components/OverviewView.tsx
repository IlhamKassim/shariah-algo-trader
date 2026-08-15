import React from "react";
import type { AnalyticsRiskResponse, Tester } from "../lib/api";

interface OverviewViewProps {
  analytics: AnalyticsRiskResponse | null;
  testers: Tester[];
  loading: boolean;
  onNavigateToCustomers: (selectedUserId?: string) => void;
  onRefresh: () => void;
}

/** Percentages are computed from the analytics payload ONLY — the audit found
 *  fabricated 55/30/15% allocation rows and a hardcoded SVG "trend" chart
 *  with no data source; both are removed (SPEC-ADMIN-SPECTATE §4). */
function riskPct(count: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.round((count / total) * 100)}%`;
}

export function OverviewView({
  analytics,
  testers,
  loading,
  onNavigateToCustomers,
  onRefresh,
}: OverviewViewProps) {
  const totalAum = analytics?.kpis.portfolio_value_usd ?? 0;
  const activeCount = analytics?.kpis.active_traders ?? testers.filter((t) => t.state === "active").length;
  const compliancePct = analytics?.kpis.compliance_pct;
  const complianceStatus = analytics?.kpis.compliance_status ?? "N/A";
  const alerts = analytics?.alerts ?? [];
  const flagged = analytics?.flagged ?? [];

  const riskTotal = analytics
    ? analytics.risk_distribution.low + analytics.risk_distribution.med + analytics.risk_distribution.high
    : 0;
  const lowPct = analytics ? riskPct(analytics.risk_distribution.low, riskTotal) : "0%";
  const medPct = analytics ? riskPct(analytics.risk_distribution.med, riskTotal) : "0%";
  const highPct = analytics ? riskPct(analytics.risk_distribution.high, riskTotal) : "0%";

  // Top customers by activity or paper status
  const topTesters = [...testers]
    .sort((a, b) => (b.has_paper_keys ? 1 : 0) - (a.has_paper_keys ? 1 : 0))
    .slice(0, 5);

  const exportReport = () => {
    const reportData = {
      timestamp: new Date().toISOString(),
      kpis: analytics?.kpis,
      risk_distribution: analytics?.risk_distribution,
      alerts_count: alerts.length,
      flagged_count: flagged.length,
      testers_count: testers.length,
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shariah-analytics-report-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b-2 border-[#333333] pb-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-[#ffffff] uppercase tracking-wider">
            Analytics &amp; Risk
          </h2>
          <p className="text-xs font-body text-secondary-fixed-dim mt-1 font-bold uppercase tracking-widest">
            Platform performance and Shariah risk telemetry
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onRefresh}
            className="px-4 py-2 bg-[#1a1918] border-2 border-[#333333] text-[#f2f0f1] text-xs font-label font-bold uppercase tracking-widest rounded-none flex items-center gap-2 hover:bg-[#242322] transition-none"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            {loading ? "Refreshing…" : "Live Sync"}
          </button>
          <button
            type="button"
            onClick={exportReport}
            className="px-4 py-2 bg-[#f2f0f1] text-[#0a0a0a] text-xs font-label font-bold uppercase tracking-widest border-2 border-[#f2f0f1] rounded-none flex items-center gap-2 hover:bg-[#d1d1d1] transition-none"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            Export Report
          </button>
        </div>
      </div>

      {/* Top Row: Metrics Grid */}
      <div className="data-grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* AUM Card */}
        <div className="flex flex-col justify-between h-32 border-2 border-transparent hover:border-[#555555]">
          <div className="flex justify-between items-start">
            <span className="text-xs font-label font-bold uppercase tracking-widest text-secondary-fixed-dim">
              Total AUM (Paper)
            </span>
            <span className="material-symbols-outlined text-[20px] text-[#f2f0f1]">
              account_balance_wallet
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-auto">
            <div className="text-2xl lg:text-3xl font-headline font-bold text-[#ffffff]">
              {analytics
                ? `$${totalAum.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : "—"}
            </div>
            <div className="flex items-center gap-1 text-secondary-fixed-dim text-xs font-label font-bold border-2 border-[#333333] px-2 py-0.5 bg-[#242322]">
              <span>{activeCount} Traders</span>
            </div>
          </div>
        </div>

        {/* Risk Exposure */}
        <div className="flex flex-col justify-between h-32 border-2 border-transparent hover:border-[#555555]">
          <div className="flex justify-between items-start">
            <span className="text-xs font-label font-bold uppercase tracking-widest text-secondary-fixed-dim">
              Risk Exposure
            </span>
            <span className="material-symbols-outlined text-[20px] text-[#f2f0f1]">warning</span>
          </div>
          <div className="mt-auto">
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-lg font-headline font-bold text-[#ffffff] uppercase tracking-wider">
                {complianceStatus}
              </span>
              <span className="text-xs font-mono font-bold text-[#10b981]">
                {compliancePct !== null && compliancePct !== undefined
                  ? `${compliancePct.toFixed(1)}%`
                  : "N/A"}
              </span>
            </div>
            {analytics && riskTotal > 0 ? (
              <div className="w-full bg-[#0a0a0a] h-3 border-2 border-[#333333] flex">
                <div
                  className="bg-[#10b981] h-full border-r-2 border-[#333333]"
                  style={{ width: lowPct }}
                  title={`Low Risk ${analytics.risk_distribution.low} accounts`}
                />
                <div
                  className="bg-[#f59e0b] h-full border-r-2 border-[#333333]"
                  style={{ width: medPct }}
                  title={`Medium Risk ${analytics.risk_distribution.med} accounts`}
                />
                <div
                  className="bg-[#ba1a1a] h-full"
                  style={{ width: highPct }}
                  title={`High Risk ${analytics.risk_distribution.high} accounts`}
                />
              </div>
            ) : (
              <div className="w-full bg-[#0a0a0a] h-3 border-2 border-[#333333]" />
            )}
          </div>
        </div>

        {/* Platform Liquidity */}
        <div className="flex flex-col justify-between h-32 border-2 border-transparent hover:border-[#555555]">
          <div className="flex justify-between items-start">
            <span className="text-xs font-label font-bold uppercase tracking-widest text-secondary-fixed-dim">
              Platform Liquidity
            </span>
            <span className="material-symbols-outlined text-[20px] text-[#f2f0f1]">water_drop</span>
          </div>
          <div className="flex items-baseline justify-between mt-auto">
            <div className="text-2xl lg:text-3xl font-headline font-bold text-[#ffffff]">—</div>
            <div className="text-[10px] font-mono font-bold text-secondary-fixed-dim uppercase tracking-widest border-2 border-[#333333] px-2 py-1 bg-[#242322]">
              No data
            </div>
          </div>
        </div>

        {/* Active Margin Calls / Alerts */}
        <div className="flex flex-col justify-between h-32 border-2 border-transparent hover:border-[#555555]">
          <div className="flex justify-between items-start">
            <span className="text-xs font-label font-bold uppercase tracking-widest text-secondary-fixed-dim">
              Active Alerts
            </span>
            <span className="material-symbols-outlined text-[20px] text-[#f2f0f1]">
              call_missed_outgoing
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-auto">
            <div className="text-2xl lg:text-3xl font-headline font-bold text-[#ffffff]">
              {analytics ? alerts.length : "—"}
            </div>
            <div className="flex items-center gap-1 text-[#f2f0f1] text-xs font-label font-bold border-2 border-[#333333] px-2 py-0.5 bg-[#242322]">
              <span className="material-symbols-outlined text-[14px]">notifications_active</span>
              <span>{activeCount} Traders</span>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Row: Real Data Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-[2px] bg-[#333333] border-2 border-[#333333]">
        {/* No time-series data — the analytics API exposes point-in-time KPIs only */}
        <div className="lg:col-span-2 bg-[#1a1918] flex flex-col min-h-[320px]">
          <div className="flex justify-between items-center p-4 border-b-2 border-[#333333] bg-[#242322]">
            <h3 className="text-xs font-label font-bold uppercase tracking-widest text-[#f2f0f1]">
              Portfolio Trends
            </h3>
          </div>
          <div className="flex-1 flex items-center justify-center p-6">
            <p className="text-xs font-mono text-secondary-fixed-dim text-center">
              No time-series data — the analytics API exposes point-in-time telemetry only.
            </p>
          </div>
        </div>

        {/* Account Risk Distribution — real counts from /analytics/risk */}
        <div className="bg-[#1a1918] flex flex-col min-h-[320px]">
          <div className="p-4 border-b-2 border-[#333333] bg-[#242322]">
            <h3 className="text-xs font-label font-bold uppercase tracking-widest text-[#f2f0f1]">
              Account Risk Distribution
            </h3>
          </div>
          <div className="data-grid grid-cols-1 flex-1 border-none bg-[#333333]">
            {!analytics ? (
              <div className="flex items-center justify-center h-full bg-[#1a1918]">
                <span className="text-xs font-mono text-secondary-fixed-dim">
                  No risk distribution data
                </span>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between h-full bg-[#1a1918]">
                  <div>
                    <div className="text-xs font-body font-bold text-[#10b981] uppercase tracking-wider">
                      Low Risk
                    </div>
                    <div className="text-[10px] font-label font-bold text-secondary-fixed-dim uppercase tracking-widest">
                      Compliant accounts
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-headline font-bold text-[#ffffff]">
                      {analytics.risk_distribution.low}
                    </div>
                    <div className="w-24 bg-[#0a0a0a] h-2.5 mt-1.5 border-2 border-[#333333]">
                      <div className="bg-[#10b981] h-full" style={{ width: lowPct }} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between h-full bg-[#1a1918]">
                  <div>
                    <div className="text-xs font-body font-bold text-[#f59e0b] uppercase tracking-wider">
                      Medium Risk
                    </div>
                    <div className="text-[10px] font-label font-bold text-secondary-fixed-dim uppercase tracking-widest">
                      Disabled or flagged
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-headline font-bold text-[#ffffff]">
                      {analytics.risk_distribution.med}
                    </div>
                    <div className="w-24 bg-[#0a0a0a] h-2.5 mt-1.5 border-2 border-[#333333]">
                      <div className="bg-[#f59e0b] h-full" style={{ width: medPct }} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between h-full bg-[#1a1918]">
                  <div>
                    <div className="text-xs font-body font-bold text-[#ba1a1a] uppercase tracking-wider">
                      High Risk
                    </div>
                    <div className="text-[10px] font-label font-bold text-secondary-fixed-dim uppercase tracking-widest">
                      Violations
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-headline font-bold text-[#ffffff]">
                      {analytics.risk_distribution.high}
                    </div>
                    <div className="w-24 bg-[#0a0a0a] h-2.5 mt-1.5 border-2 border-[#333333]">
                      <div className="bg-[#ba1a1a] h-full" style={{ width: highPct }} />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: Table & Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-[2px] bg-[#333333] border-2 border-[#333333]">
        {/* Table (Spans 2 columns) */}
        <div className="lg:col-span-2 bg-[#1a1918] p-6">
          <div className="flex justify-between items-center mb-4 px-1">
            <h3 className="text-xs font-label font-bold uppercase tracking-widest text-[#f2f0f1]">
              Active Pilot Customers
            </h3>
            <button
              type="button"
              onClick={() => onNavigateToCustomers()}
              className="text-[#f2f0f1] text-[10px] font-label font-bold uppercase tracking-widest hover:bg-[#333333] border-2 border-[#333333] px-3 py-1 bg-[#242322]"
            >
              View All CRM
            </button>
          </div>

          <div className="data-grid grid-cols-4 border-2 border-[#333333]">
            {/* Header Row */}
            <div className="data-grid-header">Customer</div>
            <div className="data-grid-header text-right">Role / Mode</div>
            <div className="data-grid-header text-right">Paper Keys</div>
            <div className="data-grid-header text-center">Status</div>

            {/* Data Rows */}
            {topTesters.length === 0 ? (
              <div className="col-span-4 p-8 text-center text-xs font-mono text-secondary-fixed-dim">
                No registered customers yet.
              </div>
            ) : (
              topTesters.map((t) => (
                <React.Fragment key={t.user_id}>
                  <div
                    onClick={() => onNavigateToCustomers(t.user_id)}
                    className="text-xs font-mono font-bold text-[#ffffff] truncate bg-[#1a1918] cursor-pointer hover:underline"
                  >
                    {t.email}
                  </div>
                  <div className="text-xs font-mono font-bold text-right text-[#f2f0f1] bg-[#1a1918] uppercase">
                    {t.role} / {t.trading_mode}
                  </div>
                  <div className="text-xs font-mono font-bold text-right bg-[#1a1918]">
                    {t.has_paper_keys ? (
                      <span className="text-[#10b981]">CONNECTED</span>
                    ) : (
                      <span className="text-secondary-fixed-dim">MISSING</span>
                    )}
                  </div>
                  <div className="text-center bg-[#1a1918]">
                    <span
                      className={`px-2 py-0.5 border-2 border-[#333333] text-[9px] font-bold uppercase tracking-widest ${
                        t.state === "active"
                          ? "bg-[#242322] text-[#10b981]"
                          : t.state === "pending"
                            ? "bg-[#0a0a0a] text-[#f59e0b]"
                            : "bg-[#0a0a0a] text-[#ba1a1a]"
                      }`}
                    >
                      {t.state}
                    </span>
                  </div>
                </React.Fragment>
              ))
            )}
          </div>
        </div>

        {/* Activity & Alerts Feed */}
        <div className="flex flex-col bg-[#1a1918]">
          <div className="p-6 pb-3 border-b-2 border-[#333333]">
            <h3 className="text-xs font-label font-bold uppercase tracking-widest text-[#f2f0f1]">
              Recent Alerts &amp; Audit Logs
            </h3>
          </div>
          <div className="data-grid grid-cols-1 flex-1 bg-[#333333]">
            {alerts.length === 0 ? (
              <div className="p-6 text-center text-xs font-mono text-secondary-fixed-dim">
                No active critical alerts.
              </div>
            ) : (
              alerts.slice(0, 3).map((a, idx) => (
                <div key={idx} className="bg-[#1a1918]">
                  <div className="flex justify-between items-baseline mb-1 border-b-2 border-[#333333] pb-1.5">
                    <span
                      className={`text-xs font-label font-bold uppercase tracking-widest ${
                        a.severity === "critical"
                          ? "text-[#ba1a1a]"
                          : a.severity === "warning"
                            ? "text-[#f59e0b]"
                            : "text-[#ffffff]"
                      }`}
                    >
                      {a.code.replace(/_/g, " ")}
                    </span>
                    <span className="text-[9px] font-mono text-secondary-fixed-dim uppercase bg-[#0a0a0a] border-2 border-[#333333] px-2 py-0.5">
                      {a.created_at ? new Date(a.created_at).toLocaleTimeString() : "Recent"}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-[#f2f0f1] leading-relaxed mt-1">
                    {a.message}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
