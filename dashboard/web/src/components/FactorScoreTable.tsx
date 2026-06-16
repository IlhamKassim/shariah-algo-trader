import type { StockScore } from "../lib/api";
import { Badge } from "./ui/Badge";

interface FactorScoreTableProps {
  stocks: StockScore[];
  topN: number;
}

export function FactorScoreTable({ stocks, topN }: FactorScoreTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-neutral-500 uppercase tracking-wider border-b border-neutral-700">
            <th className="pb-2 pr-3 font-medium">Rank</th>
            <th className="pb-2 pr-3 font-medium">Symbol</th>
            <th className="pb-2 pr-3 font-medium text-right">Momentum Z</th>
            <th className="pb-2 pr-3 font-medium text-right">Quality Z</th>
            <th className="pb-2 pr-3 font-medium text-right">Factor Score</th>
            <th className="pb-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {stocks.map((s, idx) => (
            <tr
              key={s.symbol}
              className={`border-b border-neutral-700/50 ${
                s.in_top_n
                  ? "border-l-2 border-l-emerald-500/40 bg-emerald-500/5"
                  : idx % 2 === 0
                  ? "bg-neutral-800/30"
                  : ""
              }`}
            >
              <td className="py-2 pr-3 text-neutral-500 text-xs">#{s.rank}</td>
              <td className="py-2 pr-3 font-mono font-semibold text-neutral-100">
                {s.symbol}
              </td>
              <td className="py-2 pr-3 text-right text-neutral-300">
                {s.momentum_score.toFixed(3)}
              </td>
              <td className="py-2 pr-3 text-right text-neutral-300">
                {s.quality_score.toFixed(3)}
              </td>
              <td className="py-2 pr-3 text-right font-semibold text-neutral-200">
                {s.factor_score.toFixed(3)}
              </td>
              <td className="py-2">
                <div className="flex gap-1 flex-wrap">
                  {s.in_top_n && <Badge variant="green">Top {topN}</Badge>}
                  {s.in_portfolio && <Badge variant="blue">Held</Badge>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
