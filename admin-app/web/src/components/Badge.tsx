import type { ReactNode } from "react";

export type Tone = "green" | "amber" | "red" | "slate";

// Quantix Glass V2 status pills: mono type, colored glass badge (emerald /
// rose / amber) — matches the dashboard header pills (App.tsx:281-300).
const TONE_CLASSES: Record<Tone, string> = {
  green: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  amber: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  red: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  slate: "border-white/10 bg-white/5 text-muted",
};

/** Small pill badge carrying one of the four allowed state colors (SPEC §5.3). */
export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-[0.08em] ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
