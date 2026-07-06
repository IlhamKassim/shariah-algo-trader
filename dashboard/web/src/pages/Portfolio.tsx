import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { formatCurrency, formatPct, plColor } from "../lib/utils";
import { HoldingsTable } from "../components/HoldingsTable";
import { Hero, HeroStat, HeroFacts } from "../components/Hero";
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
    <div className="space-y-6">
      <Hero>
        <HeroStat
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
        <HeroFacts
          facts={[
            { label: "Open Positions", loading: isLoading, value: positions ? String(positions.length) : "—" },
            { label: "Invested", loading: isLoading, value: positions ? formatCurrency(totalInvested) : "—" },
            { label: "Cash", loading: loadingAccount, value: account ? formatCurrency(account.cash) : "—" },
          ]}
        />
      </Hero>

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
