
interface TickerBarProps {
  totalTesters: number | null;
  activeTesters: number | null;
  compliancePct?: number | null;
  portfolioValue?: number | null;
}

export function TickerBar({
  totalTesters,
  activeTesters,
  compliancePct,
  portfolioValue,
}: TickerBarProps) {
  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-3 border-b-2 border-[#333333] bg-[#1a1918] px-8 py-2 font-mono text-xs text-secondary-fixed-dim select-none">
      <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
        {/* System telemetry */}
        <div className="flex items-center gap-2 border-2 border-[#333333] px-2.5 py-1 bg-[#0a0a0a]">
          <span className="h-2 w-2 bg-[#10b981]" />
          <span className="font-bold text-[#f2f0f1] uppercase tracking-wider">
            SYS STATUS: ONLINE
          </span>
        </div>

        <div className="flex items-center gap-2 border-2 border-[#333333] px-2.5 py-1 bg-[#242322]">
          <span className="text-secondary-fixed-dim uppercase tracking-wider">TOTAL CUSTOMERS:</span>
          <span className="font-bold text-[#ffffff]">{totalTesters ?? "—"}</span>
        </div>

        <div className="flex items-center gap-2 border-2 border-[#333333] px-2.5 py-1 bg-[#242322]">
          <span className="text-secondary-fixed-dim uppercase tracking-wider">ACTIVE TRADERS:</span>
          <span className="font-bold text-[#10b981]">{activeTesters ?? "—"}</span>
        </div>

        {compliancePct !== undefined && compliancePct !== null && (
          <div className="flex items-center gap-2 border-2 border-[#333333] px-2.5 py-1 bg-[#242322]">
            <span className="text-secondary-fixed-dim uppercase tracking-wider">COMPLIANCE:</span>
            <span className="font-bold text-[#10b981]">{compliancePct.toFixed(1)}%</span>
          </div>
        )}

        {portfolioValue !== undefined && portfolioValue !== null && (
          <div className="hidden lg:flex items-center gap-2 border-2 border-[#333333] px-2.5 py-1 bg-[#242322]">
            <span className="text-secondary-fixed-dim uppercase tracking-wider">AGGREGATE AUM:</span>
            <span className="font-bold text-[#ffffff]">
              ${portfolioValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-2 border-[#333333] px-2.5 py-1 bg-[#0a0a0a] text-[11px]">
        <span className="h-1.5 w-1.5 bg-[#f9e37a]" />
        <span className="uppercase tracking-widest text-secondary-fixed-dim">ENVIRONMENT:</span>
        <span className="font-bold text-[#f9e37a]">PAPER ONLY (G5)</span>
      </div>
    </div>
  );
}
