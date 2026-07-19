import type { ReactNode } from "react";
import { StatBlock } from "./ui/StatBlock";

export function Hero({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 sm:gap-0 sm:divide-x sm:divide-divider border-b border-divider pb-5 mb-6 w-full items-start">
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
    <div className="sm:pr-6 sm:first:pl-0">
      <StatBlock
        label={label}
        value={value}
        sub={sub}
        loading={loading}
        valueClassName="text-3xl lg:text-4xl font-bold text-primary leading-tight"
        skeletonClassName="h-9 w-40 mb-2"
      />
    </div>
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
    <>
      {facts.map((f) => (
        <div key={f.label} className="sm:px-6 sm:last:pr-0">
          <StatBlock label={f.label} value={f.value} sub={f.sub} loading={f.loading} />
        </div>
      ))}
    </>
  );
}
