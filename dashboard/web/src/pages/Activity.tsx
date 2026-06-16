import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { ActivityFeed } from "../components/ActivityFeed";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Skeleton } from "../components/ui/Skeleton";

const TYPES = ["all", "rebalance", "compliance", "order", "error", "system"];

export function Activity() {
  const [activeType, setActiveType] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");

  const { data: activity, isLoading } = useQuery({
    queryKey: ["activity", activeType, dateFilter],
    queryFn: () =>
      api.activity(
        activeType !== "all" ? activeType : undefined,
        dateFilter || undefined
      ),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-neutral-100">Activity Log</h1>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-neutral-800 border border-neutral-700 rounded-lg p-1">
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setActiveType(t)}
              className={`px-3 py-1 text-sm rounded-md capitalize transition-colors ${
                activeType === t
                  ? "bg-neutral-600 text-neutral-100"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-sm text-neutral-300 focus:outline-none focus:border-emerald-500"
        />
        {dateFilter && (
          <button
            onClick={() => setDateFilter("")}
            className="text-xs text-neutral-500 hover:text-neutral-300"
          >
            Clear date
          </button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Entries {activity ? `(${activity.entries.length})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <ActivityFeed entries={activity?.entries ?? []} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
