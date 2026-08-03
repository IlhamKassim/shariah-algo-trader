import { useEffect, useState } from "react";
import { ShieldCheck, Activity, Globe } from "lucide-react";

interface TopTickerBarProps {
  isLive?: boolean;
}

export function TopTickerBar({ isLive = false }: TopTickerBarProps) {
  const [nyseOpen, setNyseOpen] = useState(false);

  useEffect(() => {
    const checkMarketHours = () => {
      const now = new Date();
      // Estimate NYSE hours (09:30 - 16:00 ET, Mon-Fri)
      const nyseTimeString = now.toLocaleString("en-US", { timeZone: "America/New_York" });
      const nyseDate = new Date(nyseTimeString);
      const day = nyseDate.getDay();
      const hours = nyseDate.getHours();
      const mins = nyseDate.getMinutes();
      const timeInMins = hours * 60 + mins;

      const isOpen = day >= 1 && day <= 5 && timeInMins >= 570 && timeInMins < 960;
      setNyseOpen(isOpen);
    };

    checkMarketHours();
    const interval = setInterval(checkMarketHours, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full bg-[#0B0D14]/80 backdrop-blur-md border-b border-white/10 px-4 py-2 flex flex-wrap items-center justify-between text-xs font-mono gap-3 text-slate-300">
      {/* Ticker marquee / badges */}
      <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
          <ShieldCheck size={14} />
          <span className="font-semibold tracking-wider">SPUS</span>
          <span className="text-emerald-300 font-sans font-bold">$38.45</span>
          <span className="text-[10px] text-emerald-400/80">+0.42%</span>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
          <ShieldCheck size={14} />
          <span className="font-semibold tracking-wider">HLAL</span>
          <span className="text-emerald-300 font-sans font-bold">$42.10</span>
          <span className="text-[10px] text-emerald-400/80">+0.15%</span>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/60 border border-white/10 text-slate-300 shrink-0">
          <Globe size={14} className="text-indigo-400" />
          <span className="font-semibold tracking-wider text-indigo-300">SPY</span>
          <span className="font-sans font-bold">$540.20</span>
          <span className="text-[10px] text-slate-400">+0.30%</span>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-slate-400 text-[11px] shrink-0 border-l border-white/10 pl-3">
          <span className="uppercase text-slate-500">Shariah Benchmark Strategy</span>
          <span className="text-emerald-400 font-medium">Spot Equities Only</span>
        </div>
      </div>

      {/* Status Indicators */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900 border border-white/10 text-[11px]">
          <Activity size={12} className={nyseOpen ? "text-emerald-400 animate-pulse" : "text-amber-400"} />
          <span className="text-slate-400 uppercase tracking-wider text-[10px]">NYSE</span>
          <span className={nyseOpen ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
            {nyseOpen ? "OPEN" : "CLOSED"}
          </span>
        </div>

        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-bold ${
          isLive
            ? "bg-rose-500/10 border-rose-500/30 text-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.2)]"
            : "bg-indigo-500/10 border-indigo-500/30 text-indigo-300"
        }`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
          <span>ALPACA: {isLive ? "LIVE MONEY" : "PAPER TRADING"}</span>
        </div>
      </div>
    </div>
  );
}
