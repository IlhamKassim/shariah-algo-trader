import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { api } from "../lib/api";
import { ActivityFeed } from "../components/ActivityFeed";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Skeleton } from "../components/ui/Skeleton";

export function Activity() {
  const [symbolFilter, setSymbolFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const { data: activity, isLoading } = useQuery({
    queryKey: ["activity", dateFilter],
    queryFn: () => api.activity(undefined, dateFilter || undefined),
    refetchInterval: 30_000,
  });

  const filtered = activity?.entries.filter((e) => {
    if (!symbolFilter) return true;
    const q = symbolFilter.toUpperCase();
    return e.tickers.some((t) => t.includes(q)) || e.message.toUpperCase().includes(q);
  }) ?? [];

  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Symbol search */}
        <label className="relative flex items-center">
          <Search size={13} className="absolute left-3 text-faint pointer-events-none" aria-hidden="true" />
          <input
            type="text"
            placeholder="Filter by symbol…"
            value={symbolFilter}
            onChange={(e) => setSymbolFilter(e.target.value)}
            aria-label="Filter trades by symbol"
            className="bg-card border border-card-border rounded-none pl-8 pr-3 py-2 text-[12px] text-muted placeholder:text-faint focus:outline-none focus:border-brand-gold/50 transition-colors w-44"
          />
          {symbolFilter && (
            <button
              onClick={() => setSymbolFilter("")}
              aria-label="Clear symbol filter"
              className="absolute right-2.5 text-faint hover:text-muted"
            >
              <X size={12} />
            </button>
          )}
        </label>

        {/* Date filter */}
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          aria-label="Filter trades by date"
          className="appearance-none bg-card border border-card-border rounded-none px-3 py-2 text-[12px] font-mono text-muted focus:outline-none focus:border-brand-gold/50 transition-colors cursor-pointer"
        />
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
            Trade Activity{" "}
            {!isLoading && `(${filtered.length} trade${filtered.length !== 1 ? "s" : ""})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3" aria-label="Loading activity">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-faint text-sm py-8 text-center">
              {activity?.entries.length === 0
                ? "No trades recorded yet. The bot will appear here once it places its first order."
                : "No trades match your filters."}
            </p>
          ) : (
            <ActivityFeed entries={filtered} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
