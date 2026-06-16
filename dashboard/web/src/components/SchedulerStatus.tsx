import { useQuery } from "@tanstack/react-query";
import { Clock, Server } from "lucide-react";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Skeleton } from "./ui/Skeleton";

export function SchedulerStatus() {
  const { data, isLoading } = useQuery({
    queryKey: ["status"],
    queryFn: api.status,
    refetchInterval: 30_000,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Server size={14} className="text-neutral-400" />
          <CardTitle>Scheduler</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : data ? (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  data.scheduler_running ? "bg-emerald-500" : "bg-red-500"
                }`}
              />
              <span className="text-neutral-300">
                {data.scheduler_running ? "Active" : "Stopped"}
              </span>
            </div>
            <Row
              icon={<Clock size={12} className="text-neutral-500" />}
              label="Last started"
              value={data.last_started_at ? formatDateTime(data.last_started_at) : "—"}
            />
            <Row
              icon={<Clock size={12} className="text-neutral-500" />}
              label="Next run"
              value={
                data.next_fire_at
                  ? formatDateTime(data.next_fire_at).replace("T", " ").slice(0, 16)
                  : "—"
              }
            />
            <Row label="Universe" value={data.etf_symbol} mono />
            <Row label="Top N" value={String(data.top_n)} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Row({
  icon,
  label,
  value,
  mono,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5 text-neutral-500">
        {icon}
        <span>{label}</span>
      </div>
      <span className={`text-neutral-300 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
