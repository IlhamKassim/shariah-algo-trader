import type { ReactNode } from "react";
import { Skeleton } from "./ui/Skeleton";

export function Hero({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-end gap-10 flex-wrap border-b border-divider pb-5 mb-6">
      {children}
    </div>
  );
}

interface HeroStatProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  loading?: boolean;
}

export function HeroStat({ label, value, sub, loading = false }: HeroStatProps) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-section uppercase tracking-[0.09em] mb-2">
        {label}
      </p>
      {loading ? (
        <>
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-4 w-28" />
        </>
      ) : (
        <>
          <div className="font-mono text-4xl md:text-5xl font-bold text-primary tabular-nums leading-none">
            {value}
          </div>
          {sub && <div className="mt-2 text-xs text-muted">{sub}</div>}
        </>
      )}
    </div>
  );
}

export interface HeroFactItem {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}

export function HeroFacts({
  facts,
  loading = false,
}: {
  facts: HeroFactItem[];
  loading?: boolean;
}) {
  return (
    <div className="flex flex-wrap divide-x divide-divider">
      {facts.map((f) => (
        <div key={f.label} className="px-6 first:pl-0 last:pr-0">
          <p className="text-[10px] font-semibold text-section uppercase tracking-[0.09em] mb-2">
            {f.label}
          </p>
          {loading ? (
            <Skeleton className="h-6 w-20" />
          ) : (
            <>
              <div className="font-mono text-xl font-semibold text-primary tabular-nums leading-tight">
                {f.value}
              </div>
              {f.sub && <div className="mt-1 text-[11px] text-faint">{f.sub}</div>}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
