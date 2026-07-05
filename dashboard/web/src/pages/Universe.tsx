import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Search } from "lucide-react";
import { api } from "../lib/api";
import { FactorScoreTable } from "../components/FactorScoreTable";
import { Badge } from "../components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Skeleton } from "../components/ui/Skeleton";

export function Universe() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: status } = useQuery({
    queryKey: ["status"],
    queryFn: api.status,
  });

  const { data: universe, isLoading } = useQuery({
    queryKey: ["universe"],
    queryFn: api.universe,
    refetchInterval: (query) => (query.state.data?.computing ? 10_000 : false),
  });

  const { mutate: triggerRefresh, isPending } = useMutation({
    mutationFn: api.refreshUniverse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["universe"] });
    },
  });

  const computing = universe?.computing || isPending;
  const topN = status?.top_n ?? 20;
  const heldCount = universe?.stocks.filter((s) => s.in_portfolio).length ?? 0;
  const topHeldCount = universe?.stocks.filter((s) => s.in_top_n && s.in_portfolio).length ?? 0;

  const visibleStocks = universe?.stocks.filter((s) =>
    !search || s.symbol.toUpperCase().includes(search.toUpperCase())
  ) ?? [];

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] text-muted font-medium">
              Top {topN}{" "}
              {topHeldCount > 0 && (
                <span className="text-faint">({topHeldCount} held)</span>
              )}
            </span>
          </div>
          {heldCount > 0 && (
            <div className="flex items-center gap-1.5">
              <Badge variant="blue">Held</Badge>
              <span className="text-[11px] text-faint">in portfolio</span>
            </div>
          )}
          {universe?.last_computed_at && (
            <span className="font-mono text-[11px] text-faint tabular-nums">
              Last computed: {universe.last_computed_at.replace("T", " ").slice(0, 16)} UTC
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Symbol search */}
          <label className="relative flex items-center">
            <Search size={13} className="absolute left-3 text-faint pointer-events-none" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search symbol…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Filter stocks by symbol"
              className="bg-card border border-card-border rounded-none pl-8 pr-3 py-1.5 text-[12px] text-muted placeholder:text-faint focus:outline-none focus:border-brand-gold/50 transition-colors w-36"
            />
          </label>
          <button
            onClick={() => triggerRefresh()}
            disabled={computing}
            aria-label={computing ? "Computing factor scores" : "Refresh factor scores"}
            className="flex items-center gap-2 px-3 py-1.5 text-[12px] font-medium rounded-none bg-card border border-card-border hover:bg-card-hover disabled:opacity-50 disabled:cursor-not-allowed text-muted transition-colors"
          >
            <RefreshCw size={12} className={computing ? "animate-spin" : ""} aria-hidden="true" />
            {computing ? "Computing…" : "Refresh Scores"}
          </button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Factor Score Rankings{" "}
            {universe?.stocks.length ? `(${universe.stocks.length} stocks)` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading || (computing && !universe?.stocks.length) ? (
            <div className="space-y-2">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : universe?.stocks.length ? (
            <FactorScoreTable stocks={visibleStocks} topN={topN} />
          ) : (
            <p className="text-faint text-sm py-8 text-center">
              No factor scores yet. Click "Refresh Scores" to compute.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
