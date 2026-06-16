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
  const mon = d.toLocaleDateString("en-US", { month: "short" });
  const day = d.getDate();
  const time = iso.slice(11, 19);
  return `${mon} ${day} ${time}`;
}

export function ActivityFeed({ entries, compact = false }: ActivityFeedProps) {
  const rows = compact ? entries.slice(0, 5) : entries;

  return (
    <div className="space-y-0">
      {rows.map((entry, idx) => {
        const badge = TYPE_BADGE[entry.type] ?? TYPE_BADGE.system;
        return (
          <div
            key={idx}
            className="flex gap-4 py-3 border-b border-divider/60 last:border-0"
          >
            <span className="font-mono text-[11px] text-faint whitespace-nowrap tabular-nums pt-0.5 min-w-[112px]">
              {fmtTimestamp(entry.timestamp)}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <Badge variant={badge.variant}>{badge.label}</Badge>
                {entry.tickers.slice(0, 3).map((t) => (
                  <span
                    key={t}
                    className="font-mono text-[11px] text-brand-green bg-[#34E3AE]/10 border border-[#34E3AE]/20 px-1.5 py-0.5 rounded"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted leading-snug">{entry.message}</p>
            </div>
          </div>
        );
      })}
      {rows.length === 0 && (
        <p className="text-xs text-faint py-6 text-center">No activity entries</p>
      )}
    </div>
  );
}
