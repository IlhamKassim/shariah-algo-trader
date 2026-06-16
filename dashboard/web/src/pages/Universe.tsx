import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { api } from "../lib/api";
import { FactorScoreTable } from "../components/FactorScoreTable";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Skeleton } from "../components/ui/Skeleton";

export function Universe() {
  const queryClient = useQueryClient();

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-100">Universe</h1>
          {universe?.last_computed_at && (
            <p className="text-xs text-neutral-500 mt-0.5">
              Last computed: {universe.last_computed_at.replace("T", " ").slice(0, 19)} UTC
            </p>
          )}
        </div>
        <button
          onClick={() => triggerRefresh()}
          disabled={computing}
          className="flex items-center gap-2 px-3 py-1.5 text-sm rounded bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-200 transition-colors"
        >
          <RefreshCw size={13} className={computing ? "animate-spin" : ""} />
          {computing ? "Computing…" : "Refresh Scores"}
        </button>
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
            <FactorScoreTable stocks={universe.stocks} topN={status?.top_n ?? 20} />
          ) : (
            <p className="text-neutral-500 text-sm py-8 text-center">
              No factor scores yet. Click "Refresh Scores" to compute.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
