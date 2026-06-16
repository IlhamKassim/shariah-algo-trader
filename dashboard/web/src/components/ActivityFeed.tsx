import type { ActivityEntry } from "../lib/api";
import { Badge } from "./ui/Badge";

interface ActivityFeedProps {
  entries: ActivityEntry[];
  compact?: boolean;
}

type BadgeVariant = "green" | "red" | "amber" | "blue" | "neutral";

const TYPE_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  compliance: { label: "Compliance", variant: "green" },
  rebalance: { label: "Rebalance", variant: "blue" },
  order: { label: "Order", variant: "amber" },
  error: { label: "Error", variant: "red" },
  system: { label: "System", variant: "neutral" },
};

export function ActivityFeed({ entries, compact = false }: ActivityFeedProps) {
  const rows = compact ? entries.slice(0, 5) : entries;

  return (
    <div className="space-y-2">
      {rows.map((entry, idx) => {
        const badge = TYPE_BADGE[entry.type] ?? TYPE_BADGE.system;
        return (
          <div
            key={idx}
            className="flex gap-3 py-2 border-b border-neutral-700/50 last:border-0"
          >
            <span className="text-xs text-neutral-500 font-mono whitespace-nowrap pt-0.5 min-w-[120px]">
              {entry.timestamp.slice(11, 19)}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <Badge variant={badge.variant}>{badge.label}</Badge>
                {entry.tickers.slice(0, 3).map((t) => (
                  <span
                    key={t}
                    className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <p className="text-sm text-neutral-300 truncate">{entry.message}</p>
            </div>
          </div>
        );
      })}
      {rows.length === 0 && (
        <p className="text-sm text-neutral-500 py-4 text-center">No activity entries</p>
      )}
    </div>
  );
}
