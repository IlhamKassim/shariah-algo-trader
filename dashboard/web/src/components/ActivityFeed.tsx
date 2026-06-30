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

function fmtTimestamp(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "America/New_York",
  }) + " ET";
}

export function ActivityFeed({ entries, compact = false }: ActivityFeedProps) {
  const rows = compact ? entries.slice(0, 5) : entries;

  if (rows.length === 0) {
    return <p className="text-xs text-faint py-6 text-center">No activity entries</p>;
  }

  return (
    <ul className="space-y-0" role="list" aria-label="Trade activity">
      {rows.map((entry, idx) => {
        const badge = TYPE_BADGE[entry.type] ?? TYPE_BADGE.system;
        return (
          <li
            key={`${entry.timestamp}-${idx}`}
            className="flex gap-4 py-3 border-b border-divider/60 last:border-0"
          >
            <time
              dateTime={entry.timestamp}
              className="font-mono text-[11px] text-faint whitespace-nowrap tabular-nums pt-0.5 min-w-[130px]"
            >
              {fmtTimestamp(entry.timestamp)}
            </time>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <Badge variant={badge.variant}>{badge.label}</Badge>
                {entry.tickers.slice(0, 3).map((t) => (
                  <span
                    key={t}
                    className="font-mono text-[11px] text-brand-green bg-[#34E3AE]/10 border border-[#34E3AE]/20 px-1.5 py-0.5 rounded"
                    aria-label={`Ticker: ${t}`}
                  >
                    {t}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted leading-snug">{entry.message}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
