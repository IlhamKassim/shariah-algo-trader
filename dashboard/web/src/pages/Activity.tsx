import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { ActivityFeed } from "../components/ActivityFeed";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Skeleton } from "../components/ui/Skeleton";

const TYPES = ["all", "rebalance", "compliance", "order", "error", "system"] as const;
type TypeFilter = (typeof TYPES)[number];

export function Activity() {
  const [activeType, setActiveType] = useState<TypeFilter>("all");
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
    <div className="space-y-5">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-0.5 bg-card border border-card-border rounded-xl p-1">
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setActiveType(t)}
              className={`px-3 py-1.5 text-[12px] font-medium rounded-lg capitalize transition-colors ${
                activeType === t
                  ? "bg-card-border text-primary"
                  : "text-faint hover:text-muted"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <label className="relative flex items-center">
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="bg-card border border-card-border rounded-xl px-3 py-2 text-[12px] font-mono text-muted focus:outline-none focus:border-brand-green/50 transition-colors cursor-pointer"
          />
        </label>
        {dateFilter && (
          <button
            onClick={() => setDateFilter("")}
            className="text-[11px] text-faint hover:text-muted transition-colors"
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
