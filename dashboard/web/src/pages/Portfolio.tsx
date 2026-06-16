import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { HoldingsTable } from "../components/HoldingsTable";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Skeleton } from "../components/ui/Skeleton";

export function Portfolio() {
  const { data: positions, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["portfolio"],
    queryFn: api.portfolio,
    refetchInterval: 30_000,
  });

  const updatedAt = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-100">Portfolio</h1>
        {updatedAt && (
          <p className="text-xs text-neutral-500">As of {updatedAt}</p>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>
            Open Positions {positions ? `(${positions.length})` : ""}
          </CardTitle>
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
