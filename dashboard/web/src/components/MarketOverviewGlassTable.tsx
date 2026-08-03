import { useState, useMemo } from "react";
import { Search, ShieldCheck, Zap } from "lucide-react";
import { GlassCard } from "./ui/GlassCard";
import type { PositionResponse, StockScore } from "../lib/api";
import { formatCurrency, formatPct, plColor } from "../lib/utils";

interface MarketOverviewGlassTableProps {
  positions: PositionResponse[];
  universe: StockScore[];
  onTriggerRebalance: () => void;
  loadingPositions?: boolean;
  loadingUniverse?: boolean;
}

export function MarketOverviewGlassTable({
  positions,
  universe,
  onTriggerRebalance,
  loadingPositions = false,
  loadingUniverse = false,
}: MarketOverviewGlassTableProps) {
  const [activeTab, setActiveTab] = useState<"holdings" | "universe">("holdings");
  const [search, setSearch] = useState("");

  const filteredPositions = useMemo(() => {
    return positions.filter((p) => {
      return (
        p.symbol.toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [positions, search]);

  const filteredUniverse = useMemo(() => {
    return universe.filter((u) => {
      return (
        u.symbol.toLowerCase().includes(search.toLowerCase()) ||
        (u.company_name && u.company_name.toLowerCase().includes(search.toLowerCase()))
      );
    });
  }, [universe, search]);

  return (
    <GlassCard className="space-y-4">
      {/* Table Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        {/* Dual Tab Buttons */}
        <div className="flex items-center gap-2 p-1 rounded-xl bg-slate-950/60 border border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab("holdings")}
            className={`px-4 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
              activeTab === "holdings"
                ? "bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Portfolio Holdings ({positions.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("universe")}
            className={`px-4 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
              activeTab === "universe"
                ? "bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Factor Universe ({universe.length})
          </button>
        </div>

        {/* Filter Controls & Actions */}
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Search bar */}
          <div className="relative flex-1 sm:w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search ticker or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950/60 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
            />
          </div>

          <button
            type="button"
            onClick={onTriggerRebalance}
            className="px-3.5 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
          >
            <Zap size={14} />
            <span>Rebalance</span>
          </button>
        </div>
      </div>

      {/* Table Data View */}
      <div className="overflow-x-auto">
        {activeTab === "holdings" ? (
          <table className="w-full text-xs font-mono text-left">
            <thead>
              <tr className="text-slate-400 border-b border-white/5 uppercase text-[10px] tracking-wider">
                <th className="py-3 px-3">#</th>
                <th className="py-3 px-3">Ticker</th>
                <th className="py-3 px-3 text-right">Shares</th>
                <th className="py-3 px-3 text-right">Price</th>
                <th className="py-3 px-3 text-right">Market Value</th>
                <th className="py-3 px-3 text-right">Unrealized P&L</th>
                <th className="py-3 px-3 text-center">Shariah Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loadingPositions ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                    Loading positions...
                  </td>
                </tr>
              ) : filteredPositions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                    No positions found matching filter.
                  </td>
                </tr>
              ) : (
                filteredPositions.map((pos, idx) => (
                  <tr key={pos.symbol} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-3 text-slate-500">#{idx + 1}</td>
                    <td className="py-3 px-3 font-bold text-white flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-[11px]">
                        {pos.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <span className="block text-white font-mono">{pos.symbol}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-slate-300">
                      {pos.qty}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-slate-200">
                      {formatCurrency(pos.current_price)}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-slate-200">
                      {formatCurrency(pos.market_value)}
                    </td>
                    <td className={`py-3 px-3 text-right font-bold ${plColor(pos.unrealized_pl_pct)}`}>
                      {formatPct(pos.unrealized_pl_pct)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold">
                        <ShieldCheck size={12} />
                        SPUS Verified
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-xs font-mono text-left">
            <thead>
              <tr className="text-slate-400 border-b border-white/5 uppercase text-[10px] tracking-wider">
                <th className="py-3 px-3">Rank</th>
                <th className="py-3 px-3">Ticker</th>
                <th className="py-3 px-3 text-right">Factor Score</th>
                <th className="py-3 px-3 text-right">Mom (25%)</th>
                <th className="py-3 px-3 text-right">Qual (25%)</th>
                <th className="py-3 px-3 text-right">Vol (25%)</th>
                <th className="py-3 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loadingUniverse ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                    Loading factor universe...
                  </td>
                </tr>
              ) : filteredUniverse.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                    No universe stocks found.
                  </td>
                </tr>
              ) : (
                filteredUniverse.map((item) => (
                  <tr key={item.symbol} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-3 text-slate-400 font-bold">#{item.rank}</td>
                    <td className="py-3 px-3 font-bold text-white flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-[11px]">
                        {item.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <span className="block text-white font-mono">{item.symbol}</span>
                        <span className="block text-[10px] text-slate-400 font-sans font-normal truncate max-w-[140px]">
                          {item.company_name || "Equities"}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-amber-400">
                      +{item.factor_score.toFixed(2)} z
                    </td>
                    <td className="py-3 px-3 text-right text-slate-300">
                      {item.momentum_score > 0 ? `+${item.momentum_score.toFixed(2)}` : item.momentum_score.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-300">
                      {item.quality_score > 0 ? `+${item.quality_score.toFixed(2)}` : item.quality_score.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-300">
                      {item.volatility_score > 0 ? `+${item.volatility_score.toFixed(2)}` : item.volatility_score.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {item.in_portfolio ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                          Held (#1-20)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px]">
                          Candidate
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </GlassCard>
  );
}
