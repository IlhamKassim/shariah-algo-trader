import { useState, useEffect } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Overview } from "./pages/Overview";
import { Portfolio } from "./pages/Portfolio";
import { Universe } from "./pages/Universe";
import { Activity } from "./pages/Activity";
import { Compare } from "./pages/Compare";
import { DayTrader } from "./pages/DayTrader";
import { api } from "./lib/api";

const NAV = [
  { to: "/", label: "Overview", end: true },
  { to: "/portfolio", label: "Portfolio", end: false },
  { to: "/universe", label: "Universe", end: false },
  { to: "/activity", label: "Activity", end: false },
  { to: "/compare", label: "Compare", end: false },
  { to: "/day-trader", label: "Day Trader", end: false },
];

const PAGE_META: Record<string, { title: string; sub: string }> = {
  "/": {
    title: "Overview",
    sub: "Portfolio health, performance and compliance at a glance",
  },
  "/portfolio": {
    title: "Portfolio",
    sub: "Open positions held in the Shariah-compliant strategy",
  },
  "/universe": {
    title: "Universe",
    sub: "Eligible stocks ranked by composite Factor Score",
  },
  "/activity": {
    title: "Activity Log",
    sub: "Audit trail of compliance checks, rebalances and orders",
  },
  "/compare": {
    title: "Strategy Comparison",
    sub: "Shariah Algo vs Day Trader — risk-adjusted performance side by side",
  },
  "/day-trader": {
    title: "Day Trader",
    sub: "Gap & Go intraday positions, fills and scanner config",
  },
};

function Topbar() {
  const location = useLocation();
  const isDayTraderPage = location.pathname === "/day-trader";
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const etTime = time.toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const isMarketOpen = (() => {
    const day = time.getDay(); // 0=Sun, 6=Sat
    if (day === 0 || day === 6) return false;
    const etHour = parseInt(time.toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }));
    const etMin = time.getMinutes();
    const mins = etHour * 60 + etMin;
    return mins >= 9 * 60 + 30 && mins < 16 * 60;
  })();

  const { data: status } = useQuery({
    queryKey: ["status"],
    queryFn: api.status,
    refetchInterval: 30_000,
  });

  const { data: positions } = useQuery({
    queryKey: ["portfolio"],
    queryFn: api.portfolio,
    refetchInterval: 30_000,
  });

  const { data: universe } = useQuery({
    queryKey: ["universe"],
    queryFn: api.universe,
    refetchInterval: false,
  });

  const navCounts: Record<string, number | undefined> = {
    "/portfolio": positions?.length,
    "/universe": universe?.stocks.length,
  };

  return (
    <header className="border-b border-divider bg-sidebar shrink-0 px-6">
      {/* Brand row */}
      <div className="h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 flex items-center justify-center shrink-0 bg-brand-gold">
            <TrendingUp size={15} className="text-page" strokeWidth={2.5} />
          </div>
          <div className="flex items-baseline gap-2.5 min-w-0 flex-wrap">
            <span className="text-sm font-bold text-primary tracking-[0.02em] whitespace-nowrap">
              SHARIAH ALGO TRADER
            </span>
            <span
              className={`text-[10px] font-medium tracking-[0.03em] whitespace-nowrap ${
                isDayTraderPage ? "text-brand-gold" : "text-muted"
              }`}
            >
              {isDayTraderPage ? "Benchmark bot · Not Shariah-screened" : "Long-only · No leverage · Halal"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${isMarketOpen ? "bg-brand-green" : "bg-brand-red"}`} />
            <span className="text-xs text-muted whitespace-nowrap">{isMarketOpen ? "NYSE Open" : "Market Closed"}</span>
            <span className="font-mono text-xs text-muted tabular-nums ml-1">{etTime} ET</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${status?.scheduler_running ? "bg-brand-green" : "bg-brand-red"}`}
            />
            <span className="text-xs text-muted whitespace-nowrap">
              Scheduler {status?.scheduler_running ? "Active" : "Offline"}
            </span>
          </div>
          <span className="border border-brand-gold text-brand-gold text-[10px] font-semibold px-2 py-0.5 rounded-none tracking-[0.08em]">
            PAPER
          </span>
          <div className="w-7 h-7 rounded-full bg-card-border flex items-center justify-center text-[11px] font-semibold text-muted select-none shrink-0">
            IK
          </div>
        </div>
      </div>

      {/* Nav tabs */}
      <nav className="flex gap-6 border-b border-divider overflow-x-auto">
        {NAV.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `pb-2.5 -mb-px text-[12px] font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                isActive
                  ? "text-brand-gold border-brand-gold"
                  : "text-muted border-transparent hover:text-primary"
              }`
            }
          >
            {label}
            {navCounts[to] != null && (
              <span className="font-mono text-[10px] text-faint tabular-nums">{navCounts[to]}</span>
            )}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}

function PageHeading() {
  const location = useLocation();
  const meta = PAGE_META[location.pathname] ?? PAGE_META["/"];
  return (
    <div className="mb-6">
      <h1 className="text-[15px] font-semibold text-primary leading-tight">{meta.title}</h1>
      <p className="text-[11px] text-muted leading-tight mt-0.5">{meta.sub}</p>
    </div>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-page flex flex-col">
      <Topbar />
      <main className="flex-1 overflow-y-auto px-6 py-6 max-w-[1400px] w-full mx-auto">
        <PageHeading />
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/universe" element={<Universe />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/day-trader" element={<DayTrader />} />
        </Routes>
      </main>
    </div>
  );
}
