import type { ReactNode } from "react";
import { StatBlock } from "./ui/StatBlock";

export function Hero({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-end gap-6 lg:gap-10 border-b border-divider pb-5 mb-6">
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
    <StatBlock
      label={label}
      value={value}
      sub={sub}
      loading={loading}
      valueClassName="text-4xl md:text-5xl font-bold text-primary leading-none"
      skeletonClassName="h-10 w-48 mb-2"
    />
  );
}

export interface HeroFactItem {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  loading?: boolean;
}

export function HeroFacts({ facts }: { facts: HeroFactItem[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-0 sm:divide-x sm:divide-divider w-full lg:w-auto">
      {facts.map((f) => (
        <div key={f.label} className="sm:px-6 sm:first:pl-0 sm:last:pr-0">
          <StatBlock label={f.label} value={f.value} sub={f.sub} loading={f.loading} />
        </div>
      ))}
    </div>
  );
}
