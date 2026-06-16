import { useQuery } from "@tanstack/react-query";
import { Menu } from "lucide-react";
import { api } from "../lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/Card";
import { Skeleton } from "./ui/Skeleton";

export function SchedulerStatus() {
  const { data, isLoading } = useQuery({
    queryKey: ["status"],
    queryFn: api.status,
    refetchInterval: 30_000,
  });

  const fmtDate = (iso: string) =>
    iso.slice(0, 16).replace("T", " ");

  const jobTime = data?.next_fire_at
    ? data.next_fire_at.slice(11, 16) + " ET"
    : "—";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Menu size={13} className="text-section" />
          <CardTitle>Scheduler</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-0">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : data ? (
          <div className="space-y-0">
            {/* Status row */}
            <div className="flex items-center justify-between pb-3 border-b border-divider">
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    data.scheduler_running ? "bg-brand-green" : "bg-brand-red"
                  }`}
                />
                <span className="text-sm font-medium text-primary">
                  {data.scheduler_running ? "Active" : "Stopped"}
                </span>
              </div>
              <span className="text-[11px] text-faint">Fires on NYSE trading days</span>
            </div>

            {/* Key-value rows */}
            <div className="pt-3 space-y-2.5">
              <Row
                label="Last run"
                value={data.last_started_at ? fmtDate(data.last_started_at) : "—"}
              />
              <Row
                label="Next run"
                value={data.next_fire_at ? fmtDate(data.next_fire_at) : "—"}
                highlight
              />
              <Row label="Job time" value={jobTime} />
              <Row label="Universe" value={data.etf_symbol} />
              <Row label="Top N" value={String(data.top_n)} />
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-faint">{label}</span>
      <span
        className={`font-mono text-[12px] tabular-nums ${
          highlight ? "text-brand-blue" : "text-muted"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
