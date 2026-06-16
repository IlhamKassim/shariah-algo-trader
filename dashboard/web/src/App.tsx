import { useState, useEffect } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { BarChart2, Layers, Clock, LayoutDashboard, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Overview } from "./pages/Overview";
import { Portfolio } from "./pages/Portfolio";
import { Universe } from "./pages/Universe";
import { Activity } from "./pages/Activity";
import { api } from "./lib/api";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/portfolio", label: "Portfolio", icon: BarChart2, end: false },
  { to: "/universe", label: "Universe", icon: Layers, end: false },
  { to: "/activity", label: "Activity", icon: Clock, end: false },
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
};

function Header() {
  const location = useLocation();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const meta = PAGE_META[location.pathname] ?? PAGE_META["/"];
  const etTime = time.toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return (
    <header className="h-14 px-6 flex items-center justify-between border-b border-divider bg-sidebar shrink-0">
      <div>
        <h1 className="text-[15px] font-semibold text-primary leading-tight">{meta.title}</h1>
        <p className="text-[11px] text-muted leading-tight">{meta.sub}</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-green" />
          <span className="text-xs text-muted">NYSE Open</span>
          <span className="font-mono text-xs text-muted tabular-nums ml-1">{etTime} ET</span>
        </div>
        <span className="border border-brand-gold text-brand-gold text-[10px] font-semibold px-2 py-0.5 rounded tracking-[0.08em]">
          PAPER
        </span>
        <div className="w-7 h-7 rounded-full bg-card-border flex items-center justify-center text-[11px] font-semibold text-muted select-none">
          IK
        </div>
      </div>
    </header>
  );
}

function Sidebar() {
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

  const nextFireDisplay = status?.next_fire_at
    ? (() => {
        const d = new Date(status.next_fire_at);
        const mon = d.toLocaleDateString("en-US", { month: "short" });
        const day = d.getDate();
        const time = status.next_fire_at.slice(11, 16);
        return `${mon} ${day}, ${time}`;
      })()
    : "—";

  return (
    <aside className="w-56 shrink-0 bg-sidebar border-r border-divider flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-divider">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #34E3AE 0%, #0FA674 100%)" }}
          >
            <TrendingUp size={17} className="text-[#0A0E13]" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-muted uppercase tracking-[0.12em] leading-none">
              Shariah
            </p>
            <p className="text-sm font-bold text-primary leading-tight">Algo Trader</p>
          </div>
        </div>
        <p className="text-[10px] text-brand-green font-medium tracking-[0.03em]">
          Long-only · No leverage · Halal
        </p>
      </div>

      {/* Nav label */}
      <div className="px-5 pt-4 pb-1">
        <p className="text-[10px] font-semibold text-section uppercase tracking-[0.09em]">
          Menu
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 pt-1 space-y-0.5">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-[#0D1F18] text-brand-green"
                  : "text-muted hover:text-primary hover:bg-card-hover"
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-brand-green" />
                )}
                <Icon size={15} />
                <span className="flex-1 text-sm">{label}</span>
                {navCounts[to] != null && (
                  <span className="font-mono text-[11px] text-faint tabular-nums">
                    {navCounts[to]}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Scheduler mini-card */}
      <div className="mx-3 mb-4 mt-3 rounded-xl border border-card-border bg-card p-3">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[10px] font-semibold text-section uppercase tracking-[0.09em]">
            Scheduler
          </span>
          <div className="flex items-center gap-1">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                status?.scheduler_running ? "bg-brand-green" : "bg-brand-red"
              }`}
            />
            <span className="text-[11px] text-muted">
              {status?.scheduler_running ? "Active" : "Offline"}
            </span>
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px]">
            <span className="text-faint">Next</span>
            <span className="font-mono text-muted tabular-nums">{nextFireDisplay}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-faint">Universe</span>
            <span className="font-mono text-muted">
              {status?.etf_symbol ?? "—"} · {status?.top_n ?? "—"}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default function App() {
  return (
    <div className="flex h-screen bg-page overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/universe" element={<Universe />} />
            <Route path="/activity" element={<Activity />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
