import type { StockScore } from "../lib/api";
import { Badge } from "./ui/Badge";

interface FactorScoreTableProps {
  stocks: StockScore[];
  topN: number;
}

function fmt(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;
}

export function FactorScoreTable({ stocks, topN }: FactorScoreTableProps) {
  const maxScore = stocks.length > 0 ? Math.max(...stocks.map((s) => s.factor_score)) : 1;

  return (
    <div className="overflow-x-auto">
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
                    ? "bg-[#34E3AE]/[0.03] border-l-2 border-l-brand-green"
                    : "border-l-2 border-l-transparent"
                }`}
              >
                <td className="py-2.5 pr-3 font-mono text-faint text-xs tabular-nums pl-2">
                  #{s.rank}
                </td>
                <th scope="row" className="py-2.5 pr-3 font-mono font-semibold text-primary text-left">
                  {s.symbol}
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
                    <div className="w-16 h-1.5 bg-card-border rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${barPct}%`,
                          background:
                            "linear-gradient(90deg, #34E3AE 0%, #0FA674 100%)",
                        }}
                      />
                    </div>
                    <span className="font-mono font-semibold text-primary tabular-nums w-10 text-right">
                      {fmt(s.factor_score)}
                    </span>
                  </div>
                </td>
                <td className="py-2.5">
                  <div className="flex gap-1 flex-wrap">
                    {s.in_top_n && <Badge variant="green">Top {topN}</Badge>}
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
