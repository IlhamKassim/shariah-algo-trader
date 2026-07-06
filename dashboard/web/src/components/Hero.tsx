import type { ReactNode } from "react";
import { StatBlock } from "./ui/StatBlock";

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
    <div className="flex flex-wrap divide-x divide-divider">
      {facts.map((f) => (
        <div key={f.label} className="px-6 first:pl-0 last:pr-0">
          <StatBlock label={f.label} value={f.value} sub={f.sub} loading={f.loading} />
        </div>
      ))}
    </div>
  );
}
