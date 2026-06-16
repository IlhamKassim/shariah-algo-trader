import type { PositionResponse } from "../lib/api";
import { formatCurrency, formatPct, plColor } from "../lib/utils";

interface HoldingsTableProps {
  positions: PositionResponse[];
  compact?: boolean;
}

export function HoldingsTable({ positions, compact = false }: HoldingsTableProps) {
  const rows = compact ? positions.slice(0, 5) : positions;
  const totalValue = positions.reduce((s, p) => s + p.market_value, 0);
  const maxWeight = positions.length > 0
    ? Math.max(...positions.map((p) => totalValue > 0 ? p.market_value / totalValue : 0))
    : 1;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b border-divider">
            <th className="pb-2.5 pr-4 text-[10px] font-semibold text-section uppercase tracking-[0.09em]">
              Symbol
            </th>
            <th className="pb-2.5 pr-4 text-[10px] font-semibold text-section uppercase tracking-[0.09em] text-right">
              Shares
            </th>
            {!compact && (
              <th className="pb-2.5 pr-4 text-[10px] font-semibold text-section uppercase tracking-[0.09em] text-right">
                Avg Cost
              </th>
            )}
            {!compact && (
              <th className="pb-2.5 pr-4 text-[10px] font-semibold text-section uppercase tracking-[0.09em] text-right">
                Price
              </th>
            )}
            <th className="pb-2.5 pr-4 text-[10px] font-semibold text-section uppercase tracking-[0.09em] text-right">
              {compact ? "Value" : "Mkt Value"}
            </th>
            {!compact && (
              <th className="pb-2.5 pr-4 text-[10px] font-semibold text-section uppercase tracking-[0.09em] text-right">
                Weight
              </th>
            )}
            <th className="pb-2.5 text-[10px] font-semibold text-section uppercase tracking-[0.09em] text-right">
              Unreal. P&amp;L
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((pos) => {
            const weight = totalValue > 0 ? (pos.market_value / totalValue) * 100 : 0;
            const barWidth = maxWeight > 0 ? (pos.market_value / totalValue / maxWeight) * 100 : 0;
            return (
              <tr
                key={pos.symbol}
                className="border-b border-divider/60 hover:bg-card-hover transition-colors last:border-0"
              >
                <td className="py-2.5 pr-4 font-mono font-semibold text-primary tabular-nums">
                  {pos.symbol}
                </td>
                <td className="py-2.5 pr-4 text-right font-mono text-muted tabular-nums">
                  {pos.qty}
                </td>
                {!compact && (
                  <td className="py-2.5 pr-4 text-right font-mono text-muted tabular-nums">
                    {formatCurrency(pos.avg_entry_price)}
                  </td>
                )}
                {!compact && (
                  <td className="py-2.5 pr-4 text-right font-mono text-muted tabular-nums">
                    {formatCurrency(pos.current_price)}
                  </td>
                )}
                <td className="py-2.5 pr-4 text-right font-mono text-muted tabular-nums">
                  {formatCurrency(pos.market_value)}
                </td>
                {!compact && (
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-10 h-1 bg-card-border rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-green rounded-full"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <span className="font-mono text-muted tabular-nums text-xs w-9 text-right">
                        {weight.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                )}
                <td className="py-2.5 text-right">
                  <span className={`font-mono tabular-nums text-sm ${plColor(pos.unrealized_pl)}`}>
                    {formatCurrency(pos.unrealized_pl)}
                  </span>
                  <span className={`ml-1 font-mono tabular-nums text-xs ${plColor(pos.unrealized_pl_pct)}`}>
                    {formatPct(pos.unrealized_pl_pct)}
                  </span>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={compact ? 3 : 7}
                className="py-8 text-center text-faint text-sm"
              >
                No open positions
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
