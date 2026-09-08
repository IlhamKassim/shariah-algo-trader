import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type DayTraderPositionResponse } from "../lib/api";
import { ConsoleShell } from "../components/ConsoleShell";
import { Ticker } from "../components/console/controls";

const money = (n: number, dp = 2) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  }).format(n);

const signed = (n: number, dp = 2) => `${n >= 0 ? "+" : ""}${n.toFixed(dp)}%`;

function Card({
  title,
  sub,
  aside,
  accent,
  children,
}: {
  title: string;
  sub?: string;
  aside?: React.ReactNode;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-[var(--c-card)] rounded-[26px] p-[22px] flex flex-col gap-4 min-w-0">
      <div className="flex items-start justify-between gap-3.5 flex-wrap">
        <div className="flex items-start gap-2.5 min-w-0">
          <span
            className="w-[22px] h-[22px] shrink-0 rounded-[6px] block mt-0.5"
            style={{ background: accent ?? "var(--c-violet)" }}
          />
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold tracking-[-0.01em]">{title}</h2>
            {sub && <p className="text-[12.5px] text-[var(--c-mid)] mt-1 leading-[1.5]">{sub}</p>}
          </div>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: string }) {
  return (
    <div className="min-w-0 bg-[var(--c-card)] rounded-[20px] px-5 py-4">
      <div className="text-[11px] text-[var(--c-mute)] uppercase tracking-[0.06em] whitespace-nowrap">
        {label}
      </div>
      <div
        className="console-display text-[24px] font-medium tracking-[-0.02em] mt-1.5 tabular-nums truncate"
        style={tone ? { color: tone } : undefined}
      >
        {value}
      </div>
      {sub && <div className="text-[12px] text-[var(--c-mid)] mt-1">{sub}</div>}
    </div>
  );
}

function PositionRow({ p, total }: { p: DayTraderPositionResponse; total: number }) {
  const up = p.unrealized_pl >= 0;
  const weight = total > 0 ? (p.market_value / total) * 100 : 0;
  return (
    <div className="flex items-center gap-4 py-3 border-b border-[var(--c-line)] last:border-b-0">
      <span className="w-[86px] shrink-0 min-w-0">
        <span className="block text-[13.5px] font-semibold truncate">{p.symbol}</span>
        <span className="block text-[11.5px] text-[var(--c-mute)] tabular-nums">
          {p.qty.toLocaleString("en-US")} sh · {p.side}
        </span>
      </span>
      <span className="flex-1 min-w-0 hidden sm:block text-[12px] text-[var(--c-mute)] tabular-nums">
        {money(p.avg_entry_price)} → {money(p.current_price)} · {weight.toFixed(1)}% of book
      </span>
      <span className="text-right whitespace-nowrap shrink-0">
        <span className="block text-[13.5px] font-semibold tabular-nums">
          {money(p.market_value, 0)}
        </span>
        <span
          className="block text-[12px] font-semibold tabular-nums mt-0.5"
          style={{ color: up ? "var(--c-green)" : "var(--c-red)" }}
        >
          {up ? "+" : "−"}
          {money(Math.abs(p.unrealized_pl), 0)} ({signed(p.unrealized_pl_pct)})
        </span>
      </span>
    </div>
  );
}

export function DayTrader() {
  const { data, isLoading } = useQuery({
    queryKey: ["day-trader"],
    queryFn: api.dayTrader,
    refetchInterval: 15_000,
  });

  const account = data?.account;
  const positions = useMemo(() => data?.positions ?? [], [data]);
  const trades = useMemo(() => data?.trades_today ?? [], [data]);
  const available = account?.available ?? false;
  const invested = positions.reduce((s, p) => s + p.market_value, 0);

  const dayPl = account?.dayl_pl ?? 0;
  const dayTone = dayPl >= 0 ? "var(--c-green)" : "var(--c-red)";

  const scanner = data
    ? [
        { label: "Max positions", value: String(data.max_positions) },
        { label: "Gap threshold", value: `${data.gap_threshold_pct.toFixed(1)}%` },
        { label: "Relative volume", value: `${data.rvol_threshold.toFixed(1)}×` },
        { label: "Stop loss", value: `${data.stop_loss_pct.toFixed(1)}%` },
        { label: "Min price", value: money(data.min_price) },
        { label: "Min avg volume", value: `${(data.min_adv / 1_000_000).toFixed(1)}M` },
        { label: "Watchlist", value: `${data.watchlist_size} symbols` },
      ]
    : [];

  return (
    <ConsoleShell breadcrumb="Day Trader">
      <div className="bg-[var(--c-sheet)] rounded-t-[34px] p-[26px] flex flex-col gap-[22px] min-h-[70vh]">
        {/* This bot exists purely as an unrestricted benchmark. Saying so once,
            prominently, is the point — it must never read as a Shariah product. */}
        <div className="bg-[rgba(124,92,252,0.12)] text-[#5B3FD6] rounded-[20px] px-5 py-3.5 text-[12.5px] leading-[1.55]">
          <strong className="font-semibold">Benchmark strategy — not Shariah-screened.</strong> This
          Gap &amp; Go bot trades an unrestricted universe with stop losses and intraday exits. It
          exists only to give the Shariah Algo something honest to be measured against, and it does
          not follow the Shariah mandate.
        </div>

        {!isLoading && !available ? (
          <Card title="Not configured" sub="The benchmark is optional." accent="var(--c-mute)">
            <p className="text-[13px] text-[var(--c-mid)] leading-[1.6]">
              Set <code className="text-[12px]">DAY_ALPACA_API_KEY</code> and{" "}
              <code className="text-[12px]">DAY_ALPACA_API_SECRET</code> to enable it. Until then
              the Performance page shows the Shariah strategy alone.
            </p>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(210px,100%),1fr))] gap-3.5">
              <Tile
                label="Daily P&L"
                value={
                  <Ticker
                    value={dayPl}
                    format={(v) => `${v >= 0 ? "+" : "−"}${money(Math.abs(v))}`}
                  />
                }
                tone={dayTone}
                sub={`${signed(account?.dayl_pl_pct ?? 0)} vs prior close`}
              />
              <Tile
                label="Equity"
                value={<Ticker value={account?.equity ?? 0} format={(v) => money(v, 0)} />}
                sub="Benchmark account"
              />
              <Tile
                label="Buying power"
                value={<Ticker value={account?.buying_power ?? 0} format={(v) => money(v, 0)} />}
                sub={`${money(account?.cash ?? 0, 0)} cash`}
              />
              <Tile
                label="Open positions"
                value={<Ticker value={positions.length} />}
                sub={`${trades.length} fill${trades.length === 1 ? "" : "s"} today`}
              />
            </div>

            <Card
              title="Open positions"
              sub="Intraday only — the strategy flattens rather than holding overnight."
              aside={
                <span className="text-[12.5px] text-[var(--c-mute)] tabular-nums whitespace-nowrap">
                  {positions.length} of {data?.max_positions ?? "—"} slots · {money(invested, 0)}
                </span>
              }
            >
              {isLoading ? (
                <p className="text-[13px] text-[var(--c-mid)] py-8 text-center">Loading positions…</p>
              ) : positions.length === 0 ? (
                <p className="text-[13px] text-[var(--c-mid)] py-8 text-center">
                  Flat — no open positions.
                </p>
              ) : (
                <div className="flex flex-col">
                  {positions.map((p) => (
                    <PositionRow key={p.symbol} p={p} total={invested} />
                  ))}
                </div>
              )}
            </Card>

            <Card title="Fills today" sub="Every execution the benchmark made this session." accent="var(--c-ink)">
              {trades.length === 0 ? (
                <p className="text-[13px] text-[var(--c-mid)] py-8 text-center">
                  No fills yet today.
                </p>
              ) : (
                <div className="flex flex-col">
                  {trades.map((t, i) => {
                    const buy = t.side.toUpperCase() === "BUY";
                    return (
                      <div
                        key={`${t.timestamp}-${t.symbol}-${i}`}
                        className="flex items-center gap-4 py-3 border-b border-[var(--c-line)] last:border-b-0"
                      >
                        <span
                          className="w-[46px] shrink-0 text-[11px] font-bold text-center rounded-full py-1"
                          style={{
                            color: buy ? "var(--c-green)" : "var(--c-red)",
                            background: buy ? "rgba(31,169,113,0.13)" : "rgba(222,74,79,0.12)",
                          }}
                        >
                          {t.side.toUpperCase()}
                        </span>
                        <span className="w-[86px] shrink-0 min-w-0">
                          <span className="block text-[13.5px] font-semibold truncate">
                            {t.symbol}
                          </span>
                          <span className="block text-[11.5px] text-[var(--c-mute)] tabular-nums">
                            {t.timestamp}
                          </span>
                        </span>
                        <span className="flex-1 min-w-0 hidden sm:block text-[12.5px] text-[var(--c-mid)] tabular-nums">
                          {t.qty.toLocaleString("en-US")} sh @ {money(t.price)}
                        </span>
                        <span className="text-right whitespace-nowrap shrink-0 text-[13.5px] font-semibold tabular-nums">
                          {money(t.notional, 0)}
                          <span className="block text-[11px] text-[var(--c-mute)] font-normal">
                            {buy ? "cash out" : "cash in"}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card
              title="Scanner configuration"
              sub="The filters a candidate must clear before the bot will take it."
              accent="var(--c-amber)"
            >
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(160px,100%),1fr))] gap-4">
                {scanner.map((s) => (
                  <div key={s.label} className="bg-[var(--c-soft)] rounded-[16px] px-4 py-3 min-w-0">
                    <div className="text-[11px] text-[var(--c-mute)] uppercase tracking-[0.06em] whitespace-nowrap">
                      {s.label}
                    </div>
                    <div className="console-display text-[20px] tabular-nums mt-1 tracking-[-0.02em]">
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}
      </div>
    </ConsoleShell>
  );
}
