import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type ActivityEntry } from "../lib/api";
import { ConsoleShell } from "../components/ConsoleShell";

type SideFilter = "All" | "Buy" | "Sell";

const money = (n: number, dp = 2) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  }).format(n);

const isBuy = (e: ActivityEntry) => (e.side ?? "").toUpperCase() === "BUY";
const isSell = (e: ActivityEntry) => (e.side ?? "").toUpperCase() === "SELL";

/** Local calendar day key, so grouping and the header agree outside UTC. */
function dayKey(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "2026-09-07" -> "Mon, Sep 7, 2026" for the group headers. */
function dayLabel(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function timeLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function Tile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0 bg-[var(--c-card)] border border-[var(--c-line)] rounded-[var(--r-inset)] px-5 py-4">
      <div className="text-[11px] text-[var(--c-mute)] uppercase tracking-[0.06em] whitespace-nowrap">
        {label}
      </div>
      <div
        className="console-figure text-[24px] font-medium tracking-[-0.02em] mt-1.5 tabular-nums truncate"
        style={tone ? { color: tone } : undefined}
      >
        {value}
      </div>
      {sub && <div className="text-[12px] text-[var(--c-mid)] mt-1">{sub}</div>}
    </div>
  );
}

export function Ledger() {
  const [side, setSide] = useState<SideFilter>("All");
  const [symbol, setSymbol] = useState("");
  const [date, setDate] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["activity", date],
    queryFn: () => api.activity(undefined, date || undefined),
    refetchInterval: 30_000,
  });

  const entries = useMemo(() => data?.entries ?? [], [data]);

  const rows = useMemo(() => {
    const q = symbol.trim().toUpperCase();
    return entries
      .filter((e) => {
        if (side === "Buy" && !isBuy(e)) return false;
        if (side === "Sell" && !isSell(e)) return false;
        if (q) {
          const hit =
            (e.symbol ?? "").toUpperCase().includes(q) ||
            e.tickers.some((t) => t.toUpperCase().includes(q));
          if (!hit) return false;
        }
        return true;
      })
      .slice()
      .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  }, [entries, side, symbol]);

  const totals = useMemo(() => {
    let bought = 0;
    let sold = 0;
    let buys = 0;
    let sells = 0;
    let unpriced = 0;
    for (const e of rows) {
      if (e.notional == null) {
        unpriced++;
        continue;
      }
      if (isBuy(e)) {
        bought += e.notional;
        buys++;
      } else if (isSell(e)) {
        sold += e.notional;
        sells++;
      }
    }
    // Realized P&L totals only the sells whose basis was actually derivable;
    // `unmatched` counts the rest so the figure is never read as complete.
    let realized = 0;
    let realizedSells = 0;
    let unmatched = 0;
    for (const e of rows) {
      if (!isSell(e)) continue;
      if (e.realized_pl == null) unmatched++;
      else {
        realized += e.realized_pl;
        realizedSells++;
      }
    }
    return {
      bought, sold, buys, sells, unpriced,
      net: bought - sold,
      realized, realizedSells, unmatched,
    };
  }, [rows]);

  // Group by calendar day so the ledger reads as a statement, not a flat list.
  const groups = useMemo(() => {
    const out: { day: string; entries: ActivityEntry[]; net: number }[] = [];
    for (const e of rows) {
      const day = dayKey(e.timestamp);
      let g = out.find((x) => x.day === day);
      if (!g) {
        g = { day, entries: [], net: 0 };
        out.push(g);
      }
      g.entries.push(e);
      if (e.notional != null) g.net += isBuy(e) ? e.notional : -e.notional;
    }
    return out;
  }, [rows]);

  return (
    <ConsoleShell
      breadcrumb="Ledger"
      aside={
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="search"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="Filter by symbol…"
            aria-label="Filter the ledger by symbol"
            className="bg-[var(--c-card)] rounded-[var(--r-btn)] px-4 py-2.5 text-[13px] w-[180px] text-[var(--c-ink)] placeholder:text-[var(--c-mute)] border-0 shadow-[var(--sh-card)] focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)]/30"
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Filter the ledger by date"
            className="bg-[var(--c-card)] rounded-[var(--r-btn)] px-4 py-2.5 text-[13px] text-[var(--c-ink)] border-0 shadow-[var(--sh-card)] focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)]/30 cursor-pointer"
          />
          {date && (
            <button
              type="button"
              onClick={() => setDate("")}
              className="border-0 rounded-[var(--r-btn)] bg-[var(--c-ink)] text-white font-[inherit] text-[12px] font-semibold px-4 py-2.5 cursor-pointer hover:opacity-85 transition-opacity"
            >
              Clear date ×
            </button>
          )}
        </div>
      }
    >
      <div className="bg-[var(--c-sheet)] rounded-t-[var(--r-sheet)] p-3.5 sm:p-[26px] flex flex-col gap-4 sm:gap-[22px] min-h-[70vh]">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(210px,100%),1fr))] gap-3.5">
          <Tile
            label="Bought"
            value={money(totals.bought, 0)}
            sub={`${totals.buys} fill${totals.buys === 1 ? "" : "s"}`}
            tone="var(--c-green)"
          />
          <Tile
            label="Sold"
            value={money(totals.sold, 0)}
            sub={`${totals.sells} fill${totals.sells === 1 ? "" : "s"}`}
            tone="var(--c-red)"
          />
          <Tile
            label="Net deployed"
            value={`${totals.net >= 0 ? "+" : "−"}${money(Math.abs(totals.net), 0)}`}
            sub="Bought minus sold"
            tone={totals.net >= 0 ? "var(--c-blue)" : "var(--c-amber)"}
          />
          <Tile
            label="Realized P&L"
            value={
              totals.realizedSells > 0
                ? `${totals.realized >= 0 ? "+" : "−"}${money(Math.abs(totals.realized))}`
                : "—"
            }
            sub={
              totals.realizedSells > 0
                ? `${totals.realizedSells} closed lot${totals.realizedSells === 1 ? "" : "s"}${
                    totals.unmatched > 0 ? ` · ${totals.unmatched} basis unknown` : ""
                  }`
                : totals.unmatched > 0
                  ? `${totals.unmatched} sell${totals.unmatched === 1 ? "" : "s"} — basis outside window`
                  : "No closed lots yet"
            }
            tone={
              totals.realizedSells === 0
                ? undefined
                : totals.realized >= 0
                  ? "var(--c-green)"
                  : "var(--c-red)"
            }
          />
          <Tile
            label="Fills"
            value={String(rows.length)}
            sub={date ? `On ${dayLabel(date)}` : "All recorded fills"}
          />
        </div>

        <section className="bg-[var(--c-card)] border border-[var(--c-line)] rounded-[var(--r-card)] p-4 sm:p-[22px] flex flex-col gap-4 min-w-0">
          <div className="flex items-center justify-between gap-x-3.5 gap-y-1 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-[22px] h-[22px] shrink-0 rounded-[var(--r-chip)] bg-[var(--c-ink)] block" />
              <h2 className="text-[16px] font-semibold tracking-[-0.01em]">Trade ledger</h2>
              <span className="text-[12.5px] text-[var(--c-mute)] tabular-nums whitespace-nowrap">
                {rows.length} of {entries.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {(["All", "Buy", "Sell"] as SideFilter[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSide(s)}
                  aria-pressed={side === s}
                  className={`border-0 rounded-[var(--r-btn)] cursor-pointer font-[inherit] text-[12px] font-semibold px-[15px] py-2 whitespace-nowrap transition-opacity hover:opacity-85 ${
                    side === s
                      ? "bg-[var(--c-ink)] text-white"
                      : "bg-[var(--c-soft)] text-[var(--c-mid)]"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <p className="text-[13px] text-[var(--c-mid)] py-10 text-center">Loading fills…</p>
          ) : entries.length === 0 ? (
            <p className="text-[13px] text-[var(--c-mid)] py-10 text-center">
              No fills recorded yet. Trades appear here once the engine places its first order.
            </p>
          ) : rows.length === 0 ? (
            <p className="text-[13px] text-[var(--c-mid)] py-10 text-center">
              No fills match these filters.
            </p>
          ) : (
            <div className="flex flex-col gap-5">
              {groups.map((g) => (
                <div key={g.day} className="min-w-0">
                  <div className="flex items-baseline justify-between gap-3 pb-2 border-b border-[var(--c-line)]">
                    <span className="text-[12px] font-semibold text-[var(--c-mid)] uppercase tracking-[0.06em]">
                      {dayLabel(g.day)}
                    </span>
                    <span
                      className="text-[12px] font-semibold tabular-nums whitespace-nowrap"
                      style={{ color: g.net >= 0 ? "var(--c-blue)" : "var(--c-amber)" }}
                    >
                      {g.net >= 0 ? "+" : "−"}
                      {money(Math.abs(g.net), 0)} net
                    </span>
                  </div>

                  {g.entries.map((e, i) => {
                    const buy = isBuy(e);
                    const tone = buy ? "var(--c-green)" : "var(--c-red)";
                    return (
                      <div
                        key={`${e.timestamp}-${i}`}
                        className="flex items-center gap-4 py-3 border-b border-[var(--c-line)] last:border-b-0"
                      >
                        <span
                          className="w-[46px] shrink-0 text-[11px] font-bold text-center rounded-[var(--r-chip)] py-1"
                          style={{
                            color: tone,
                            background: buy ? "rgba(31,169,113,0.13)" : "rgba(222,74,79,0.12)",
                          }}
                        >
                          {(e.side ?? "—").toUpperCase()}
                        </span>

                        <span className="w-[86px] shrink-0 min-w-0">
                          <span className="block text-[13.5px] font-semibold truncate">
                            {e.symbol ?? e.tickers[0] ?? "—"}
                          </span>
                          <span className="block text-[11.5px] text-[var(--c-mute)] tabular-nums">
                            {timeLabel(e.timestamp)}
                          </span>
                        </span>

                        <span className="flex-1 min-w-0 text-[12.5px] text-[var(--c-mid)] tabular-nums hidden sm:block">
                          {e.qty != null && e.price != null ? (
                            <>
                              {e.qty.toLocaleString("en-US")} sh @ {money(e.price)}
                            </>
                          ) : (
                            e.message
                          )}
                        </span>

                        {/* Realized P&L: only a sell can have one, and only when
                            its opening buys are inside the fetched window. A
                            dash means not derivable — it never means break-even. */}
                        <span className="w-[92px] shrink-0 text-right whitespace-nowrap hidden sm:block">
                          {e.realized_pl != null ? (
                            <>
                              <span
                                className="text-[13px] font-semibold tabular-nums"
                                style={{
                                  color:
                                    e.realized_pl >= 0 ? "var(--c-green)" : "var(--c-red)",
                                }}
                              >
                                {e.realized_pl >= 0 ? "+" : "−"}
                                {money(Math.abs(e.realized_pl))}
                              </span>
                              <span className="block text-[11px] text-[var(--c-mute)] tabular-nums">
                                {e.realized_pl_pct != null
                                  ? `${e.realized_pl_pct >= 0 ? "+" : "−"}${Math.abs(
                                      e.realized_pl_pct,
                                    ).toFixed(2)}%`
                                  : "realized"}
                              </span>
                            </>
                          ) : (
                            <span
                              className="text-[12.5px] text-[var(--c-mute)]"
                              title={
                                isSell(e)
                                  ? "Opening buy is outside the fetched fill window, so cost basis cannot be derived"
                                  : "Realized P&L is recorded on the sell that closes a position"
                              }
                            >
                              —
                            </span>
                          )}
                        </span>

                        <span className="text-right whitespace-nowrap shrink-0">
                          {e.notional != null ? (
                            <>
                              <span className="text-[13.5px] font-semibold tabular-nums">
                                {money(e.notional, 0)}
                              </span>
                              <span className="block text-[11px] text-[var(--c-mute)]">
                                {buy ? "cash out" : "cash in"}
                              </span>
                            </>
                          ) : (
                            <span className="text-[12.5px] text-[var(--c-mute)]">—</span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {totals.unpriced > 0 && (
            <p className="text-[11.5px] text-[var(--c-amber)]">
              {totals.unpriced} fill{totals.unpriced === 1 ? "" : "s"} had no price or quantity and
              are excluded from the totals above.
            </p>
          )}

          {/* Cost basis is derived FIFO from the fill stream itself. Cash flows
              and dividends still need a transfer feed — see issue #19. */}
          <p className="text-[11.5px] text-[var(--c-mute)] leading-[1.55]">
            Every row is a settled fill from the broker. Amounts are quantity × fill price, so they
            show cash moved. Realized P&amp;L is derived by matching each sell FIFO against its
            earlier buys; where the opening buy falls outside the fetched window the figure shows
            “—”, meaning not derivable rather than break-even. Trading fees, deposits, withdrawals
            and dividends are not recorded here, so “net deployed” covers trading only and realized
            P&amp;L is gross of costs.
          </p>
        </section>
      </div>
    </ConsoleShell>
  );
}
