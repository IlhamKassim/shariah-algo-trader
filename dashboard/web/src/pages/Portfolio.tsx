import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { formatCurrency, formatPct, plColor } from "../lib/utils";
import { HoldingsTable } from "../components/HoldingsTable";
import { KPICard } from "../components/KPICard";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Skeleton } from "../components/ui/Skeleton";

export function Portfolio() {
  const { data: positions, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["portfolio"],
    queryFn: api.portfolio,
    refetchInterval: 30_000,
  });

  const { data: account, isLoading: loadingAccount } = useQuery({
    queryKey: ["account"],
    queryFn: api.account,
    refetchInterval: 30_000,
  });

  const updatedAt = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : null;

  const totalInvested = positions?.reduce((s, p) => s + p.market_value, 0) ?? 0;
  const totalPL = positions?.reduce((s, p) => s + p.unrealized_pl, 0) ?? 0;
  const totalCost = totalInvested - totalPL;
  const totalPLPct = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Open Positions"
          value={positions ? String(positions.length) : "—"}
          loading={isLoading}
        />
        <KPICard
          label="Invested"
          value={positions ? formatCurrency(totalInvested) : "—"}
          loading={isLoading}
        />
        <KPICard
          label="Cash"
          value={account ? formatCurrency(account.cash) : "—"}
          loading={loadingAccount}
        />
        <KPICard
          label="Unrealized P&L"
          value={
            positions ? (
              <span className={plColor(totalPL)}>{formatCurrency(totalPL)}</span>
            ) : (
              "—"
            )
          }
          sub={
            positions ? (
              <span className={plColor(totalPLPct)}>{formatPct(totalPLPct)}</span>
            ) : undefined
          }
          loading={isLoading}
        />
      </div>

      {/* Positions table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            Open Positions {positions ? `(${positions.length})` : ""}
          </CardTitle>
          {updatedAt && (
            <span className="font-mono text-[11px] text-faint tabular-nums">
              As of {updatedAt}
            </span>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : (
            <HoldingsTable positions={positions ?? []} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
