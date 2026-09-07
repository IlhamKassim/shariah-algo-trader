import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type StockScore } from "../lib/api";
import { ConsoleShell } from "../components/ConsoleShell";

type SortKey = "rank" | "symbol" | "momentum" | "quality" | "volatility" | "value" | "score";
type Filter = "All" | "Top N" | "Held";

const FACTORS: { key: SortKey; label: string; field: keyof StockScore; hint: string }[] = [
  {
    key: "momentum",
    label: "Momentum",
    field: "momentum_score",
    hint: "12-month price return minus the most recent month (z-score)",
  },
  {
    key: "quality",
    label: "Quality",
    field: "quality_score",
    hint: "ROE, profit margin and low-debt composite (z-score)",
  },
  {
    key: "volatility",
    label: "Low-vol",
    field: "volatility_score",
    hint: "Inverse annualised volatility (z-score) — higher is less volatile",
  },
  {
    key: "value",
    label: "Value",
    field: "value_score",
    hint: "Earnings yield E/P (z-score)",
  },
];

const z = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;

interface Domain {
  min: number;
  max: number;
}

/**
 * Factor scores may arrive as z-scores straddling zero or as an all-positive
 * scale. A fixed centre line renders the all-positive case as identical stubs,
 * so the bar fills from zero when the data crosses it and from the observed
 * minimum when it does not.
 */
function ZCell({ value, domain }: { value: number; domain: Domain }) {
  const crossesZero = domain.min < 0;
  const positive = value >= 0;

  const { leftPct, widthPct } = (() => {
    if (crossesZero) {
      const span = Math.max(Math.abs(domain.min), Math.abs(domain.max)) || 1;
      const w = Math.min(50, (Math.abs(value) / span) * 50);
      return { leftPct: positive ? 50 : 50 - w, widthPct: w };
    }
    const span = domain.max - domain.min || 1;
    return { leftPct: 0, widthPct: Math.max(3, ((value - domain.min) / span) * 100) };
  })();

  return (
    <div className="flex items-center justify-end gap-2.5 min-w-0">
      <div className="relative h-1.5 w-[54px] shrink-0 hidden lg:block rounded-full bg-[var(--c-soft)]">
        {crossesZero && <span className="absolute inset-y-0 left-1/2 w-px bg-[var(--c-line)]" />}
        <span
          className="absolute inset-y-0 rounded-full"
          style={{
            left: `${leftPct}%`,
            width: `${widthPct}%`,
            background: positive ? "var(--c-green)" : "var(--c-red)",
            opacity: 0.6,
          }}
        />
      </div>
      <span className="text-[12.5px] tabular-nums w-[46px] text-right">{z(value)}</span>
    </div>
  );
}

function Chip({ tone, children }: { tone: "blue" | "green" | "mute"; children: React.ReactNode }) {
  const tones = {
    blue: "bg-[rgba(37,99,235,0.10)] text-[var(--c-blue)]",
    green: "bg-[rgba(31,169,113,0.13)] text-[var(--c-green)]",
    mute: "bg-[var(--c-soft)] text-[var(--c-mute)]",
  };
  return (
    <span
      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Hoisted out of Universe: an inline component would remount every render. */
function SortHead({
  label,
  sortKey,
  hint,
  align = "right",
  sort,
  desc,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  hint?: string;
  align?: "left" | "right";
  sort: SortKey;
  desc: boolean;
  onSort: (k: SortKey) => void;
}) {
  const activeSort = sort === sortKey;
  return (
    <th scope="col" className={`pb-3 ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title={hint}
        aria-sort={activeSort ? (desc ? "descending" : "ascending") : "none"}
        className={`text-[11px] font-semibold uppercase tracking-[0.06em] cursor-pointer transition-colors inline-flex items-center gap-1 ${
          activeSort ? "text-[var(--c-ink)]" : "text-[var(--c-mute)] hover:text-[var(--c-ink)]"
        }`}
      >
        {label}
        {activeSort && <span className="text-[9px]">{desc ? "\u25bc" : "\u25b2"}</span>}
      </button>
    </th>
  );
}

export function Universe() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [sort, setSort] = useState<SortKey>("rank");
  const [desc, setDesc] = useState(false);

  const { data: status } = useQuery({ queryKey: ["status"], queryFn: api.status });
  const { data: universe, isLoading } = useQuery({
    queryKey: ["universe"],
    queryFn: api.universe,
    refetchInterval: (query) => (query.state.data?.computing ? 10_000 : false),
  });

  const { mutate: refresh, isPending } = useMutation({
    mutationFn: api.refreshUniverse,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["universe"] }),
  });

  const computing = universe?.computing || isPending;
  const topN = status?.top_n ?? 20;
  const stocks = useMemo(() => universe?.stocks ?? [], [universe]);

  const heldCount = stocks.filter((s) => s.in_portfolio).length;
  const topHeld = stocks.filter((s) => s.in_top_n && s.in_portfolio).length;
  // Names inside the cut line that aren't held yet — the next Rebalance's buys.
  const pendingEntry = stocks.filter((s) => s.in_top_n && !s.in_portfolio).length;

  // One shared scale across all four factor columns, taken from the data so the
  // bars work whether scores are z-scores or an all-positive scale.
  const domain = useMemo<Domain>(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const s of stocks) {
      for (const f of FACTORS) {
        const v = s[f.field] as number;
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
    }
    if (!Number.isFinite(min)) return { min: 0, max: 1 };
    return { min: Math.min(0, min), max };
  }, [stocks]);

  const rows = useMemo(() => {
    const q = search.trim().toUpperCase();
    let out = stocks.filter((s) => {
      if (q && !s.symbol.toUpperCase().includes(q) && !(s.company_name ?? "").toUpperCase().includes(q))
        return false;
      if (filter === "Top N") return s.in_top_n;
      if (filter === "Held") return s.in_portfolio;
      return true;
    });
    const pick = (s: StockScore) => {
      switch (sort) {
        case "symbol":
          return s.symbol;
        case "score":
          return s.factor_score;
        case "rank":
          return s.rank;
        default: {
          const f = FACTORS.find((x) => x.key === sort);
          return f ? (s[f.field] as number) : s.rank;
        }
      }
    };
    out = out.slice().sort((a, b) => {
      const av = pick(a);
      const bv = pick(b);
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return desc ? -cmp : cmp;
    });
    return out;
  }, [stocks, search, filter, sort, desc]);

  const toggleSort = (key: SortKey) => {
    if (sort === key) {
      setDesc((d) => !d);
    } else {
      setSort(key);
      // Scores read best high-to-low; rank and symbol read best ascending.
      setDesc(key !== "rank" && key !== "symbol");
    }
  };

  return (
    <ConsoleShell
      breadcrumb="Universe"
      aside={
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search symbol or name…"
            aria-label="Filter the Eligible Universe"
            className="bg-[var(--c-card)] rounded-full px-4 py-2.5 text-[13px] w-[210px] text-[var(--c-ink)] placeholder:text-[var(--c-mute)] border-0 shadow-[0_1px_2px_rgba(20,25,35,0.06)] focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)]/30"
          />
          <button
            type="button"
            onClick={() => refresh()}
            disabled={!!computing}
            className="border-0 rounded-full bg-[var(--c-blue)] text-white font-[inherit] text-[12.5px] font-semibold px-5 py-[11px] whitespace-nowrap cursor-pointer disabled:cursor-wait hover:opacity-90 transition-opacity"
          >
            {computing ? "Computing…" : "Refresh scores"}
          </button>
        </div>
      }
    >
      <div className="bg-[var(--c-sheet)] rounded-t-[34px] p-[26px] flex flex-col gap-[22px] min-h-[70vh]">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(210px,100%),1fr))] gap-3.5">
          <Tile label="Scored stocks" value={String(stocks.length)} sub="Ranked this cycle" />
          <Tile label={`Inside top ${topN}`} value={String(Math.min(topN, stocks.length))} sub="Portfolio cut line" />
          <Tile
            label="Held"
            value={`${topHeld} of ${heldCount}`}
            sub="In portfolio and still ranked"
            tone="var(--c-blue)"
          />
          <Tile
            label="Pending entry"
            value={String(pendingEntry)}
            sub="Ranked in, not yet bought"
            tone={pendingEntry > 0 ? "var(--c-green)" : undefined}
          />
        </div>

        <section className="bg-[var(--c-card)] rounded-[26px] p-[22px] flex flex-col gap-4 min-w-0">
          <div className="flex items-center justify-between gap-3.5 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-[22px] h-[22px] shrink-0 rounded-[6px] bg-[var(--c-ink)] block" />
              <h2 className="text-[16px] font-semibold tracking-[-0.01em]">Factor Score rankings</h2>
              <span className="text-[12.5px] text-[var(--c-mute)] tabular-nums whitespace-nowrap">
                {rows.length} of {stocks.length}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {(["All", "Top N", "Held"] as Filter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  aria-pressed={filter === f}
                  className={`border-0 rounded-full cursor-pointer font-[inherit] text-[12px] font-semibold px-[15px] py-2 whitespace-nowrap transition-opacity hover:opacity-85 ${
                    filter === f
                      ? "bg-[var(--c-ink)] text-white"
                      : "bg-[var(--c-soft)] text-[var(--c-mid)]"
                  }`}
                >
                  {f}
                </button>
              ))}
              {universe?.last_computed_at && (
                <span className="text-[11.5px] text-[var(--c-mute)] tabular-nums whitespace-nowrap ml-1">
                  Computed {universe.last_computed_at.replace("T", " ").slice(0, 16)} UTC
                </span>
              )}
            </div>
          </div>

          {isLoading || (computing && stocks.length === 0) ? (
            <p className="text-[13px] text-[var(--c-mid)] py-10 text-center">
              Computing Factor Scores across the Eligible Universe…
            </p>
          ) : stocks.length === 0 ? (
            <p className="text-[13px] text-[var(--c-mid)] py-10 text-center">
              No Factor Scores yet. Run “Refresh scores” to rank the Eligible Universe.
            </p>
          ) : rows.length === 0 ? (
            <p className="text-[13px] text-[var(--c-mid)] py-10 text-center">
              No stocks match “{search}”.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full min-w-[720px]" aria-label="Factor Score rankings">
                <thead>
                  <tr className="border-b border-[var(--c-line)]">
                    <SortHead label="Rank" sortKey="rank" align="left" sort={sort} desc={desc} onSort={toggleSort} />
                    <SortHead label="Stock" sortKey="symbol" align="left" sort={sort} desc={desc} onSort={toggleSort} />
                    {FACTORS.map((f) => (
                      <SortHead key={f.key} label={f.label} sortKey={f.key} hint={f.hint} sort={sort} desc={desc} onSort={toggleSort} />
                    ))}
                    <SortHead
                      label="Factor Score"
                      sortKey="score"
                      hint="Equal-weighted average of all four factor z-scores"
                      sort={sort}
                      desc={desc}
                      onSort={toggleSort}
                    />
                    <th scope="col" className="pb-3 text-right">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--c-mute)]">
                        Status
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s, i) => {
                    // Only meaningful while sorted by rank, where the cut line is a real boundary.
                    const cutLineHere =
                      sort === "rank" && !desc && filter === "All" && !search && s.rank === topN + 1;
                    return (
                      <tr
                        key={s.symbol}
                        className={`border-b border-[var(--c-line)] last:border-b-0 ${
                          cutLineHere ? "border-t-2 border-t-[var(--c-amber)]" : ""
                        } ${i % 2 === 1 ? "bg-[var(--c-soft)]/45" : ""}`}
                      >
                        <td className="py-3 pr-3 text-[12.5px] tabular-nums text-[var(--c-mute)] w-12">
                          {s.rank}
                        </td>
                        <td className="py-3 pr-4 min-w-0">
                          <div className="text-[13.5px] font-semibold">{s.symbol}</div>
                          {s.company_name && (
                            <div className="text-[11.5px] text-[var(--c-mute)] truncate max-w-[220px]">
                              {s.company_name}
                            </div>
                          )}
                        </td>
                        {FACTORS.map((f) => (
                          <td key={f.key} className="py-3 pr-3">
                            <ZCell value={s[f.field] as number} domain={domain} />
                          </td>
                        ))}
                        <td className="py-3 pr-3 text-right">
                          <span className="text-[13.5px] font-semibold tabular-nums">
                            {z(s.factor_score)}
                          </span>
                        </td>
                        <td className="py-3 text-right whitespace-nowrap">
                          <div className="inline-flex gap-1.5">
                            {s.in_portfolio && <Chip tone="blue">Held</Chip>}
                            {s.in_top_n && !s.in_portfolio && <Chip tone="green">Entering</Chip>}
                            {!s.in_top_n && s.in_portfolio && <Chip tone="mute">Exiting</Chip>}
                            {!s.in_top_n && !s.in_portfolio && <Chip tone="mute">Ranked</Chip>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-[11.5px] text-[var(--c-mute)] leading-[1.55]">
            Factor Score is the equal-weighted average of the four z-scores. The Eligible Universe
            is pre-screened by the {status?.etf_symbol ?? "SPUS"} holdings, so every stock listed
            here already passes the Shariah screen.
          </p>
        </section>
      </div>
    </ConsoleShell>
  );
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
    <div className="min-w-0 bg-[var(--c-card)] rounded-[20px] px-5 py-4">
      <div className="text-[11px] text-[var(--c-mute)] uppercase tracking-[0.06em] whitespace-nowrap">
        {label}
      </div>
      <div
        className="console-display text-[24px] font-medium tracking-[-0.02em] mt-1.5 tabular-nums"
        style={tone ? { color: tone } : undefined}
      >
        {value}
      </div>
      {sub && <div className="text-[12px] text-[var(--c-mid)] mt-1">{sub}</div>}
    </div>
  );
}
