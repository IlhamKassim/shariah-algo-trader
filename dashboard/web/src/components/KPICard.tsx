import type { ReactNode } from "react";
import { Card } from "./ui/Card";
import { Skeleton } from "./ui/Skeleton";

interface KPICardProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  loading?: boolean;
}

export function KPICard({ label, value, sub, loading = false }: KPICardProps) {
  return (
    <Card className="p-5">
      <p className="text-[10px] font-semibold text-section uppercase tracking-[0.09em] mb-3">
        {label}
      </p>
      {loading ? (
        <>
          <Skeleton className="h-8 w-36 mb-2" />
          <Skeleton className="h-4 w-24" />
        </>
      ) : (
        <>
          <div className="font-mono text-2xl font-semibold text-primary tabular-nums leading-tight">
            {value}
          </div>
          {sub && <div className="mt-1.5 text-xs text-muted">{sub}</div>}
        </>
      )}
    </Card>
  );
}
