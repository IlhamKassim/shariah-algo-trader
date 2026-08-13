interface TickerBarProps {
  totalTesters: number | null;
  activeTesters: number | null;
}

function ShieldGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    </svg>
  );
}

function UsersGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

/**
 * Signature top strip mirroring the dashboard's TopTickerBar (Quantix Glass
 * V2): mono pills on a translucent #0B0D14 bar with a bottom hairline. The
 * dashboard ticks market prices; the admin console ticks pilot telemetry —
 * PILOT · N TESTERS · N ACTIVE · PAPER ONLY.
 */
export function TickerBar({ totalTesters, activeTesters }: TickerBarProps) {
  return (
    <div className="w-full bg-[#0B0D14]/80 backdrop-blur-md border-b border-white/10 px-4 py-2 flex flex-wrap items-center justify-between text-xs font-mono gap-3 text-slate-300">
      <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 shrink-0">
          <ShieldGlyph />
          <span className="font-bold tracking-wider">PILOT</span>
          <span className="text-indigo-200 font-sans font-bold">BETA</span>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/60 border border-white/10 text-slate-300 shrink-0">
          <UsersGlyph />
          <span className="font-semibold tracking-wider text-indigo-300">TESTERS</span>
          <span className="font-sans font-bold tabular-nums">{totalTesters ?? "—"}</span>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold tracking-wider">ACTIVE</span>
          <span className="font-sans font-bold tabular-nums">{activeTesters ?? "—"}</span>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-slate-400 text-[11px] shrink-0 border-l border-white/10 pl-3">
          <span className="uppercase text-slate-500">Shariah Trading Platform</span>
          <span className="text-indigo-300 font-medium">Admin Console</span>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900 border border-white/10 text-[11px]">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
          <span className="text-slate-400 uppercase tracking-wider text-[10px]">MODE</span>
          <span className="text-indigo-300 font-bold">PAPER ONLY</span>
        </div>
      </div>
    </div>
  );
}
