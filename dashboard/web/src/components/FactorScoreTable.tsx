import { useState } from "react";
import { createPortal } from "react-dom";
import type { StockScore } from "../lib/api";
import { Badge } from "./ui/Badge";

interface FactorScoreTableProps {
  stocks: StockScore[];
  topN: number;
}

function fmt(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;
}

interface TooltipState {
  name: string;
  x: number;
  y: number;
}

export function FactorScoreTable({ stocks, topN }: FactorScoreTableProps) {
  const maxScore = stocks.length > 0 ? Math.max(...stocks.map((s) => s.factor_score)) : 1;
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  return (
    <div className="overflow-x-auto">
      {/* Portal tooltip — attached directly to <body>, immune to overflow clipping */}
      {tooltip &&
        createPortal(
          <div
            style={{
              position: "fixed",
              left: tooltip.x + 14,
              top: tooltip.y - 12,
              zIndex: 9999,
              pointerEvents: "none",
              background: "var(--color-card, #1a1a1a)",
              border: "1px solid var(--color-card-border, #333)",
              padding: "4px 10px",
              fontSize: "12px",
              color: "var(--color-primary, #e5e5e5)",
              whiteSpace: "nowrap",
              boxShadow: "0 4px 24px 0 rgba(0,0,0,0.5)",
              lineHeight: 1.5,
            }}
          >
            {tooltip.name}
          </div>,
          document.body
        )}
      <table className="w-full text-sm" aria-label="Factor score rankings">
        <thead>
          <tr className="text-left border-b border-divider">
            <th scope="col" className="pb-2.5 pr-3 text-[10px] font-semibold text-section uppercase tracking-[0.09em] w-10 pl-2">
              Rank
            </th>
            <th scope="col" className="pb-2.5 pr-3 text-[10px] font-semibold text-section uppercase tracking-[0.09em]">
              Symbol
            </th>
            <th scope="col" className="pb-2.5 pr-3 text-[10px] font-semibold text-section uppercase tracking-[0.09em] text-right" title="12-month price return minus 1-month (z-score)">
              Momentum Z
            </th>
            <th scope="col" className="pb-2.5 pr-3 text-[10px] font-semibold text-section uppercase tracking-[0.09em] text-right" title="ROE, profit margin, low debt composite (z-score)">
              Quality Z
            </th>
            <th scope="col" className="pb-2.5 pr-3 text-[10px] font-semibold text-section uppercase tracking-[0.09em] text-right" title="Inverse annualised volatility (z-score) — higher = less volatile">
              Low-Vol Z
            </th>
            <th scope="col" className="pb-2.5 pr-3 text-[10px] font-semibold text-section uppercase tracking-[0.09em] text-right" title="Earnings yield E/P (z-score)">
              Value Z
            </th>
            <th scope="col" className="pb-2.5 pr-3 text-[10px] font-semibold text-section uppercase tracking-[0.09em] text-right" title="Equal-weighted average of all four factor z-scores">
              Factor Score
            </th>
            <th scope="col" className="pb-2.5 text-[10px] font-semibold text-section uppercase tracking-[0.09em]">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {stocks.map((s) => {
            const barPct = maxScore > 0 ? (s.factor_score / maxScore) * 100 : 0;
            return (
              <tr
                key={s.symbol}
                className={`border-b border-divider/60 last:border-0 transition-colors hover:bg-card-hover ${
                  s.in_top_n
                    ? "bg-brand-gold/[0.03] border-l-2 border-l-brand-gold"
                    : "border-l-2 border-l-transparent"
                }`}
              >
                <td className="py-2.5 pr-3 font-mono text-faint text-xs tabular-nums pl-2">
                  #{s.rank}
                </td>
                <th scope="row" className="py-2.5 pr-3 font-mono font-semibold text-primary text-left">
                  <a
                    href={`https://finance.yahoo.com/quote/${s.symbol}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline hover:text-brand-gold transition-colors"
                    onMouseEnter={(e) =>
                      setTooltip({ name: s.company_name || s.symbol, x: e.clientX, y: e.clientY })
                    }
                    onMouseMove={(e) =>
                      setTooltip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : null)
                    }
                    onMouseLeave={() => setTooltip(null)}
                  >
                    {s.symbol}
                  </a>
                </th>
                <td className="py-2.5 pr-3 text-right font-mono text-muted tabular-nums">
                  {fmt(s.momentum_score)}
                </td>
                <td className="py-2.5 pr-3 text-right font-mono text-muted tabular-nums">
                  {fmt(s.quality_score)}
                </td>
                <td className="py-2.5 pr-3 text-right font-mono text-muted tabular-nums">
                  {fmt(s.volatility_score)}
                </td>
                <td className="py-2.5 pr-3 text-right font-mono text-muted tabular-nums">
                  {fmt(s.value_score)}
                </td>
                <td className="py-2.5 pr-3">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 h-1.5 bg-card-border overflow-hidden">
                      <div
                        className="h-full bg-brand-gold"
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                    <span className="font-mono font-semibold text-primary tabular-nums w-10 text-right">
                      {fmt(s.factor_score)}
                    </span>
                  </div>
                </td>
                <td className="py-2.5">
                  <div className="flex gap-1 flex-wrap">
                    {s.in_top_n && <Badge variant="amber">Top {topN}</Badge>}
                    {s.in_portfolio && <Badge variant="blue">Held</Badge>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
