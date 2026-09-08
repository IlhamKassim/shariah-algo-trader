import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../lib/api";
import { ConsoleShell } from "../components/ConsoleShell";

/**
 * Explanations are bound to the reader's live configuration rather than the
 * defaults, so the page describes the system they actually own.
 */

interface Topic {
  id: string;
  title: string;
  summary: string;
  body: (ctx: Ctx) => React.ReactNode;
}

interface Ctx {
  topN: number;
  sectorCap: number;
  drift: number;
  etf: string;
  universeSize: number;
  maxPerSector: number;
}

const FACTORS = [
  {
    name: "Momentum",
    weight: "25%",
    what: "Twelve-month price return, excluding the most recent month.",
    why: "Recent winners have historically kept winning over medium horizons. The last month is dropped because very-short-term moves tend to reverse.",
    tone: "var(--c-blue)",
  },
  {
    name: "Quality",
    weight: "25%",
    what: "Return on equity, profit margin and low debt, combined.",
    why: "Durable earnings survive downturns. It also aligns naturally with the Shariah screen — heavily indebted firms score poorly on both.",
    tone: "var(--c-green)",
  },
  {
    name: "Low volatility",
    weight: "25%",
    what: "Inverse of annualised daily return volatility.",
    why: "Calmer stocks have historically delivered better risk-adjusted returns than their beta would predict.",
    tone: "var(--c-violet)",
  },
  {
    name: "Value",
    weight: "25%",
    what: "Earnings yield — earnings over price.",
    why: "Paying less per unit of earnings has been rewarded over long horizons. It also counterbalances momentum, which tends to buy expensive things.",
    tone: "var(--c-amber)",
  },
];

const TOPICS: Topic[] = [
  {
    id: "screen",
    title: "How a stock becomes eligible",
    summary: "The Shariah screen is inherited from an ETF, not run in-house.",
    body: (c) => (
      <>
        <p>
          The Eligible Universe is the set of holdings inside <strong>{c.etf}</strong>. That ETF
          already applies an AAOIFI-style screen — excluding conventional finance, alcohol,
          gambling, adult entertainment and tobacco, and capping debt and interest income — so
          every one of the {c.universeSize || "screened"} names in it has passed a Shariah review
          before this engine sees it.
        </p>
        <p>
          Inheriting the screen means compliance does not depend on us re-deriving it. It also
          means the universe carries the ETF's characteristics: because this screen family measures
          debt against <em>market capitalisation</em> rather than total assets, external research
          (MSCI, Oct 2025) finds it tilts toward growth and momentum names. Some of the momentum
          factor's contribution may reflect that pre-existing tilt rather than the scoring itself.
        </p>
        <p>
          A daily Compliance Check re-reads the holdings. If a stock you own has left, it is sold
          on the next open — a Compliance Exit, independent of any score.
        </p>
      </>
    ),
  },
  {
    id: "score",
    title: "How stocks are scored",
    summary: "Four factors, equally weighted, each normalised to the same scale.",
    body: () => (
      <>
        <p>
          Each factor is converted to a <strong>z-score</strong> — how many standard deviations a
          stock sits from the universe average on that measure. Normalising matters: raw
          return percentages and raw profit margins are not comparable, but their z-scores are.
          That is what makes an equal-weighted average meaningful.
        </p>
        <p>
          The Factor Score is simply the mean of the four. A score of 0 is exactly average; +1 is
          one standard deviation better than the universe. On the Universe page the leading figure
          is the share of the universe a stock outranks, because a percentile reads more plainly
          than a z-score.
        </p>
      </>
    ),
  },
  {
    id: "select",
    title: "How the portfolio is chosen",
    summary: "Top-ranked stocks, subject to a sector ceiling.",
    body: (c) => (
      <>
        <p>
          Stocks are ranked by Factor Score and the best <strong>{c.topN}</strong> are bought — but
          not blindly. A sector cap of <strong>{(c.sectorCap * 100).toFixed(0)}%</strong> limits any
          one GICS sector to <strong>{c.maxPerSector}</strong> position
          {c.maxPerSector === 1 ? "" : "s"}. When a sector fills, the next-best stock from a
          different sector takes the slot instead.
        </p>
        <p>
          This is why rank order and holdings are not the same list, and why the Universe page
          marks what was actually selected rather than assuming it is the first {c.topN} rows. The
          cap exists because the screen already tilts toward technology; without it a
          momentum-weighted model would concentrate there.
        </p>
        <p>
          Position sizes are inverse-volatility weighted — calmer stocks get more — capped at twice
          equal weight so nothing dominates.
        </p>
      </>
    ),
  },
  {
    id: "rebalance",
    title: "When it trades",
    summary: "Monthly by schedule, sooner on drift or a compliance breach.",
    body: (c) => (
      <>
        <p>
          A full Rebalance runs on the first trading day of each month: scores are recomputed, a
          new target list is produced, and the portfolio is moved to match.
        </p>
        <p>
          Between rebalances two things can trigger a trade. A <strong>Compliance Exit</strong>
          fires immediately if a holding leaves the Eligible Universe. A{" "}
          <strong>drift rebalance</strong> fires when a position moves more than{" "}
          <strong>{(c.drift * 100).toFixed(1)}%</strong> from its target weight — a position that
          has run up is trimmed back rather than left to concentrate.
        </p>
        <p>
          There is also a market regime filter: when the S&amp;P 500 sits below its 200-day moving
          average, new buys are skipped.
        </p>
      </>
    ),
  },
  {
    id: "limits",
    title: "What this does not do",
    summary: "The honest list of constraints and gaps.",
    body: () => (
      <>
        <p>
          <strong>No leverage, shorting, options or margin.</strong> Long-only spot equity, by
          mandate. That is a Shariah requirement, not a risk preference, and it is enforced at the
          execution layer rather than by convention.
        </p>
        <p>
          <strong>Returns are not yet cash-flow adjusted.</strong> Deposits and withdrawals are not
          tracked, so the performance figures reflect equity movement rather than a true
          time-weighted return. Realized profit and dividend income are not recorded either — the
          Ledger shows cash moved, not profit earned.
        </p>
        <p>
          <strong>Past factor premiums are not promises.</strong> Every rationale above describes
          what has historically been rewarded. Factors underperform for years at a time, and a
          Shariah-screened universe is narrower than the market, which concentrates that risk.
        </p>
      </>
    ),
  },
];

function Accordion({ topic, ctx, open, onToggle }: {
  topic: Topic;
  ctx: Ctx;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-[var(--c-card)] border border-[var(--c-line)] rounded-[var(--r-card)] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 p-[22px] text-left cursor-pointer"
      >
        <span className="min-w-0">
          <span className="block text-[16px] font-semibold tracking-[-0.01em]">{topic.title}</span>
          <span className="block text-[12.5px] text-[var(--c-mid)] mt-1">{topic.summary}</span>
        </span>
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          className="w-8 h-8 shrink-0 rounded-full bg-[var(--c-soft)] flex items-center justify-center text-[18px] text-[var(--c-mid)] leading-none"
          aria-hidden="true"
        >
          +
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <div className="px-[22px] pb-[22px] flex flex-col gap-3 text-[13px] text-[var(--c-mid)] leading-[1.65] [&_strong]:text-[var(--c-ink)] [&_strong]:font-semibold">
              {topic.body(ctx)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Learn() {
  const [open, setOpen] = useState<string | null>("screen");

  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });
  const { data: status } = useQuery({ queryKey: ["status"], queryFn: api.status });
  const { data: compliance } = useQuery({ queryKey: ["compliance"], queryFn: api.compliance });

  const topN = status?.top_n ?? settings?.top_n ?? 20;
  const sectorCap = settings?.sector_cap ?? 0.2;
  const ctx: Ctx = {
    topN,
    sectorCap,
    drift: settings?.drift_threshold ?? 0.03,
    etf: status?.etf_symbol ?? settings?.etf_symbol ?? "SPUS",
    universeSize: compliance?.universe_size ?? 0,
    maxPerSector: Math.max(1, Math.floor(sectorCap * topN)),
  };

  return (
    <ConsoleShell breadcrumb="Learn">
      <div className="bg-[var(--c-sheet)] rounded-t-[var(--r-sheet)] p-3.5 sm:p-[26px] flex flex-col gap-4 sm:gap-[22px] min-h-[70vh]">
        <section className="bg-[var(--c-card)] border border-[var(--c-line)] rounded-[var(--r-card)] p-[26px] flex flex-col gap-4">
          <h1 className="console-display text-[38px] tracking-[-0.005em] leading-[1.15]">
            How your engine decides
          </h1>
          <p className="text-[13.5px] text-[var(--c-mid)] leading-[1.6] max-w-[68ch]">
            Every number below is read from your live configuration, not from documentation
            defaults — so this describes the system you actually own. Change a setting in{" "}
            <Link to="/account" className="!text-[var(--c-blue)] font-semibold">
              Account
            </Link>{" "}
            and this page changes with it.
          </p>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(150px,100%),1fr))] gap-3.5 pt-1">
            {[
              { k: "Universe", v: ctx.etf, s: ctx.universeSize ? `${ctx.universeSize} screened` : "ETF holdings" },
              { k: "Holds", v: `${ctx.topN} stocks`, s: "Top by Factor Score" },
              { k: "Sector cap", v: `${ctx.maxPerSector} per sector`, s: `${(ctx.sectorCap * 100).toFixed(0)}% ceiling` },
              { k: "Drift trigger", v: `${(ctx.drift * 100).toFixed(1)}%`, s: "Early rebalance" },
            ].map((t) => (
              <div key={t.k} className="bg-[var(--c-soft)] rounded-[var(--r-card)] px-4 py-3 min-w-0">
                <div className="text-[11px] text-[var(--c-mute)] uppercase tracking-[0.06em]">
                  {t.k}
                </div>
                <div className="console-figure text-[19px] mt-1 tracking-[-0.02em] truncate">
                  {t.v}
                </div>
                <div className="text-[11.5px] text-[var(--c-mute)] mt-0.5">{t.s}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-[var(--c-card)] border border-[var(--c-line)] rounded-[var(--r-card)] p-4 sm:p-[22px] flex flex-col gap-4">
          <div className="flex items-center gap-2.5">
            <span className="w-[22px] h-[22px] shrink-0 rounded-[var(--r-chip)] bg-[var(--c-ink)] block" />
            <h2 className="text-[16px] font-semibold tracking-[-0.01em]">The four factors</h2>
            <span className="text-[12.5px] text-[var(--c-mute)]">equally weighted</span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-4">
            {FACTORS.map((f) => (
              <div key={f.name} className="bg-[var(--c-soft)] rounded-[var(--r-inset)] p-5 min-w-0 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: f.tone }}
                  />
                  <span className="text-[13.5px] font-semibold">{f.name}</span>
                  <span className="text-[12px] text-[var(--c-mute)] tabular-nums ml-auto">
                    {f.weight}
                  </span>
                </div>
                <p className="text-[12.5px] text-[var(--c-ink)] leading-[1.55]">{f.what}</p>
                <p className="text-[12px] text-[var(--c-mid)] leading-[1.55]">{f.why}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-col gap-3.5">
          {TOPICS.map((t) => (
            <Accordion
              key={t.id}
              topic={t}
              ctx={ctx}
              open={open === t.id}
              onToggle={() => setOpen((cur) => (cur === t.id ? null : t.id))}
            />
          ))}
        </div>

        <p className="text-[11.5px] text-[var(--c-mute)] leading-[1.6] pb-4">
          Educational content describing how this system works. Not investment advice, and not a
          projection of future returns. All accounts referenced here are paper-trading accounts
          unless you have explicitly switched to live.
        </p>
      </div>
    </ConsoleShell>
  );
}
