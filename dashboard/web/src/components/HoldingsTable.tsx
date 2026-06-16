import type { PositionResponse } from "../lib/api";
import { formatCurrency, formatPct, plColor } from "../lib/utils";

interface HoldingsTableProps {
  positions: PositionResponse[];
  compact?: boolean;
}

export function HoldingsTable({ positions, compact = false }: HoldingsTableProps) {
  const rows = compact ? positions.slice(0, 5) : positions;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-neutral-500 uppercase tracking-wider border-b border-neutral-700">
            <th className="pb-2 pr-4 font-medium">Symbol</th>
            <th className="pb-2 pr-4 font-medium text-right">Shares</th>
            {!compact && <th className="pb-2 pr-4 font-medium text-right">Avg Cost</th>}
            {!compact && <th className="pb-2 pr-4 font-medium text-right">Price</th>}
            <th className="pb-2 pr-4 font-medium text-right">Value</th>
            <th className="pb-2 font-medium text-right">Unreal. P&L</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((pos, idx) => (
            <tr
              key={pos.symbol}
              className={`border-b border-neutral-700/50 ${
                idx % 2 === 0 ? "bg-neutral-800/30" : ""
              }`}
            >
              <td className="py-2 pr-4 font-mono font-semibold text-emerald-400">
                {pos.symbol}
              </td>
              <td className="py-2 pr-4 text-right text-neutral-300">{pos.qty}</td>
              {!compact && (
                <td className="py-2 pr-4 text-right text-neutral-300">
                  {formatCurrency(pos.avg_entry_price)}
                </td>
              )}
              {!compact && (
                <td className="py-2 pr-4 text-right text-neutral-300">
                  {formatCurrency(pos.current_price)}
                </td>
              )}
              <td className="py-2 pr-4 text-right text-neutral-300">
                {formatCurrency(pos.market_value)}
              </td>
              <td className="py-2 text-right">
                <span className={plColor(pos.unrealized_pl)}>
                  {formatCurrency(pos.unrealized_pl)}
                </span>
                <span className={`ml-1 text-xs ${plColor(pos.unrealized_pl_pct)}`}>
                  ({formatPct(pos.unrealized_pl_pct)})
                </span>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={compact ? 3 : 6} className="py-6 text-center text-neutral-500">
                No open positions
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
