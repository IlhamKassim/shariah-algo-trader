import { useQuery } from "@tanstack/react-query";
import { Activity, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { api } from "../lib/api";
import { formatCurrency, formatPct, plColor } from "../lib/utils";
import { Hero, HeroStat, HeroFacts } from "../components/Hero";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Skeleton } from "../components/ui/Skeleton";

export function DayTrader() {
  const { data, isLoading } = useQuery({
    queryKey: ["day-trader"],
    queryFn: api.dayTrader,
    refetchInterval: 15_000,
  });

  const account = data?.account;
  const positions = data?.positions ?? [];
  const trades = data?.trades_today ?? [];
  const available = account?.available ?? false;

  if (!isLoading && !available) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <Zap size={32} className="text-faint" />
        <p className="text-muted font-medium">Day trader account not configured</p>
        <p className="text-faint text-sm">Set DAY_ALPACA_API_KEY and DAY_ALPACA_API_SECRET to enable</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Hero>
        <HeroStat
          label="Daily P&L"
          value={
            account ? (
              <span className={plColor(account.dayl_pl)}>
                {formatCurrency(account.dayl_pl)}
              </span>
            ) : "—"
          }
          sub={
            account ? (
              <span className={plColor(account.dayl_pl_pct)}>
                {formatPct(account.dayl_pl_pct)} today
              </span>
            ) : undefined
          }
          loading={isLoading}
        />
        <HeroFacts
          loading={isLoading}
          facts={[
            { label: "Equity", value: account ? formatCurrency(account.equity) : "—" },
            { label: "Buying Power", value: account ? formatCurrency(account.buying_power) : "—" },
          ]}
        />
      </Hero>

      {/* Scanner config strip */}
      <div className="border-b border-divider pb-4">
        <p className="text-[10px] font-semibold text-section uppercase tracking-[0.09em] mb-2.5">
          Scanner Config
        </p>
        {isLoading ? (
          <Skeleton className="h-4 w-full" />
        ) : (
          <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-[11px]">
            <span className="text-faint">Watchlist <span className="font-mono text-muted">{data?.watchlist_size} stocks</span></span>
            <span className="text-faint">Gap ≥ <span className="font-mono text-muted">{data?.gap_threshold_pct.toFixed(0)}%</span></span>
            <span className="text-faint">RVOL ≥ <span className="font-mono text-muted">{data?.rvol_threshold}×</span></span>
            <span className="text-faint">Min price <span className="font-mono text-muted">${data?.min_price.toFixed(0)}+</span></span>
            <span className="text-faint">Min ADV <span className="font-mono text-muted">{data ? (data.min_adv / 1_000_000).toFixed(0) : "—"}M+</span></span>
            <span className="text-faint">Stop loss <span className="font-mono text-muted">{data?.stop_loss_pct.toFixed(0)}%</span></span>
            <span className="text-faint">Max positions <span className="font-mono text-muted">{data?.max_positions}</span></span>
          </div>
        )}
      </div>

      {/* Open positions + today's trades */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Open positions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Open Positions</CardTitle>
            <span className="text-[11px] font-mono text-faint">
              {positions.length} / {data?.max_positions ?? 5}
            </span>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : positions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                <Activity size={22} className="text-faint" />
                <p className="text-faint text-sm">No open positions</p>
                <p className="text-[11px] text-faint">Scanner fires at 9:31 AM ET</p>
              </div>
            ) : (
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-faint text-[10px] uppercase tracking-[0.07em] border-b border-divider">
                    <th className="text-left pb-2 font-medium">Symbol</th>
                    <th className="text-right pb-2 font-medium">Entry</th>
                    <th className="text-right pb-2 font-medium">Price</th>
                    <th className="text-right pb-2 font-medium">P&amp;L</th>
                    <th className="text-right pb-2 font-medium">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider">
                  {positions.map((p) => (
                    <tr key={p.symbol}>
                      <td className="py-2.5 font-mono font-semibold text-primary">{p.symbol}</td>
                      <td className="py-2.5 text-right font-mono text-muted">
                        ${p.avg_entry_price.toFixed(2)}
                      </td>
                      <td className="py-2.5 text-right font-mono text-muted">
                        ${p.current_price.toFixed(2)}
                      </td>
                      <td className={`py-2.5 text-right font-mono font-semibold ${plColor(p.unrealized_pl)}`}>
                        <div>{p.unrealized_pl >= 0 ? "+" : ""}{formatCurrency(p.unrealized_pl)}</div>
                        <div className="text-[10px] font-normal">
                          {formatPct(p.unrealized_pl_pct)}
                        </div>
                      </td>
                      <td className="py-2.5 text-right font-mono text-muted">
                        {formatCurrency(p.market_value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Today's trades */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Today's Trades</CardTitle>
            <span className="text-[11px] font-mono text-faint">{trades.length} fills</span>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-7 w-full" />)}
              </div>
            ) : trades.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                <Activity size={22} className="text-faint" />
                <p className="text-faint text-sm">No trades yet today</p>
              </div>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {trades.map((t, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-1.5 border-b border-divider last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      {t.side === "BUY" ? (
                        <TrendingUp size={13} className="text-brand-green shrink-0" />
                      ) : (
                        <TrendingDown size={13} className="text-brand-red shrink-0" />
                      )}
                      <span className="font-mono font-semibold text-[12px] text-primary">{t.symbol}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-none ${
                        t.side === "BUY"
                          ? "bg-brand-green/10 text-brand-green"
                          : "bg-brand-red/10 text-brand-red"
                      }`}>
                        {t.side}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-[11px] text-muted">
                        {t.qty} @ ${t.price.toFixed(2)}
                      </p>
                      <p className="font-mono text-[10px] text-faint">{t.timestamp} ET</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
