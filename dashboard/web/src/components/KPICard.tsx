import type { ReactNode } from "react";
import { Card, CardContent } from "./ui/Card";
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
      <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
        {label}
      </p>
      {loading ? (
        <>
          <Skeleton className="h-7 w-32 mb-1" />
          <Skeleton className="h-4 w-20" />
        </>
      ) : (
        <>
          <p className="text-2xl font-semibold text-neutral-100">{value}</p>
          {sub && <p className="text-sm mt-0.5 text-neutral-400">{sub}</p>}
        </>
      )}
    </Card>
  );
}

// Re-export CardContent for convenience
export { CardContent };
