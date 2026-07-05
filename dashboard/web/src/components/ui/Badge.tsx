import type { ReactNode } from "react";

type BadgeVariant = "green" | "red" | "amber" | "blue" | "neutral";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  green: "bg-brand-green/10 text-brand-green border-brand-green/20",
  red: "bg-brand-red/10 text-brand-red border-brand-red/20",
  amber: "bg-brand-gold/10 text-brand-gold border-brand-gold/20",
  blue: "bg-brand-blue/10 text-brand-blue border-brand-blue/20",
  neutral: "bg-card-hover text-muted border-card-border",
};

export function Badge({ children, variant = "neutral" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-none text-[11px] font-medium border ${VARIANT_CLASSES[variant]}`}
    >
      {children}
    </span>
  );
}
