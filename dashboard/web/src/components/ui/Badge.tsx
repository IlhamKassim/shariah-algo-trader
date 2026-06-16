import type { ReactNode } from "react";

type BadgeVariant = "green" | "red" | "amber" | "blue" | "neutral";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  green: "bg-[#34E3AE]/10 text-brand-green border-[#34E3AE]/20",
  red: "bg-[#FF8A94]/10 text-brand-red border-[#FF8A94]/20",
  amber: "bg-[#D8BE86]/10 text-brand-gold border-[#D8BE86]/20",
  blue: "bg-[#7FB4FF]/10 text-brand-blue border-[#7FB4FF]/20",
  neutral: "bg-card-hover text-muted border-card-border",
};

export function Badge({ children, variant = "neutral" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${VARIANT_CLASSES[variant]}`}
    >
      {children}
    </span>
  );
}
