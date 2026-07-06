import type { ReactNode } from "react";
import { Skeleton } from "./Skeleton";

interface StatBlockProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  loading?: boolean;
  valueClassName?: string;
  skeletonClassName?: string;
}

/** Caption label above a mono value, with an optional sub-line and loading skeleton. */
export function StatBlock({
  label,
  value,
  sub,
  loading = false,
  valueClassName = "text-xl font-semibold text-primary",
  skeletonClassName = "h-6 w-20",
}: StatBlockProps) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-section uppercase tracking-[0.09em] mb-2">
        {label}
      </p>
      {loading ? (
        <Skeleton className={skeletonClassName} />
      ) : (
        <>
          <div className={`font-mono tabular-nums leading-tight ${valueClassName}`}>{value}</div>
          {sub && <div className="mt-1 text-[11px] text-faint">{sub}</div>}
        </>
      )}
    </div>
  );
}
