import { useState, useEffect } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  TrendingUp,
  LogOut,
  LayoutDashboard,
  Briefcase,
  Globe,
  ScrollText,
  GitCompareArrows,
  Zap,
  BookOpen,
  SlidersHorizontal,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Overview } from "./pages/Overview";
import { Portfolio } from "./pages/Portfolio";
import { Universe } from "./pages/Universe";
import { Activity } from "./pages/Activity";
import { Compare } from "./pages/Compare";
import { DayTrader } from "./pages/DayTrader";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { NotificationBell } from "./components/NotificationBell";
import { Login } from "./pages/Login";
import { Learn } from "./pages/Learn";
import { Settings } from "./pages/Settings";
import { api, setTokenProvider } from "./lib/api";
import { useAuth } from "@clerk/clerk-react";

const NAV = [
  { to: "/", label: "Overview", end: true, icon: LayoutDashboard },
  { to: "/portfolio", label: "Portfolio", end: false, icon: Briefcase },
  { to: "/universe", label: "Universe", end: false, icon: Globe },
  { to: "/activity", label: "Activity", end: false, icon: ScrollText },
  { to: "/compare", label: "Compare", end: false, icon: GitCompareArrows },
  { to: "/day-trader", label: "Day Trader", end: false, icon: Zap },
  { to: "/learn", label: "Learn", end: false, icon: BookOpen },
  { to: "/settings", label: "Settings", end: false, icon: SlidersHorizontal },
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
  "/learn": {
    title: "Learn",
    sub: "Understanding factor investing, strategy logic, and Shariah compliance",
  },
  "/settings": {
    title: "Settings Profile",
    sub: "Manage Alpaca API credentials, ETF targets, factor weights, and user authentication",
  },
};

function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const isDayTraderPage = location.pathname === "/day-trader";
  const [time, setTime] = useState(new Date());
  const isDemo = localStorage.getItem("shariah_demo_mode") === "true";

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
    const nyParts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "numeric",
      weekday: "short",
      hour12: false,
    }).formatToParts(time);

    const getPart = (type: string) => nyParts.find((p) => p.type === type)?.value || "";
    const weekday = getPart("weekday"); // "Mon", "Tue", etc.
    const hour = parseInt(getPart("hour"), 10);
    const minute = parseInt(getPart("minute"), 10);

    if (weekday === "Sat" || weekday === "Sun") return false;
    const mins = hour * 60 + minute;
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

  const queryClient = useQueryClient();
  const { data: auth } = useQuery({
    queryKey: ["authStatus"],
    queryFn: api.authStatus,
    refetchOnWindowFocus: false,
  });

  const { signOut } = useAuth();

  const handleLogout = async () => {
    try {
      if (isDemo) {
        localStorage.removeItem("shariah_demo_mode");
      } else if (auth?.clerk_enabled) {
        await signOut();
      } else {
        await api.logout();
      }
      await queryClient.invalidateQueries();
      navigate("/login", { replace: true });
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const navCounts: Record<string, number | undefined> = {
    "/portfolio": positions?.length,
    "/universe": universe?.stocks.length,
  };

  return (
    <header className="border-b border-divider bg-sidebar shrink-0 px-6">
      {/* Brand row */}
      <div className="min-h-14 py-3 md:py-0 md:h-14 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center justify-between w-full md:w-auto gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 flex items-center justify-center shrink-0 bg-brand-gold">
              <TrendingUp size={15} className="text-page" strokeWidth={2.5} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-primary tracking-[0.02em] whitespace-nowrap">
                SHARIAH ALGO TRADER
              </span>
              <span
                className={`text-[9px] font-medium tracking-[0.03em] whitespace-nowrap ${
                  isDayTraderPage ? "text-brand-gold" : "text-muted"
                }`}
              >
                {isDayTraderPage ? "Benchmark bot · Not Shariah-screened" : "Long-only · No leverage · Halal"}
              </span>
            </div>
          </div>
          {/* Mobile-only session actions */}
          <div className="flex items-center gap-2 md:hidden">
            <NotificationBell />
            {auth?.auth_enabled && auth?.authenticated && (
              <button
                onClick={handleLogout}
                className="text-muted hover:text-brand-red p-1.5 border border-divider hover:border-brand-red/30 transition-colors cursor-pointer"
                title={isDemo ? "Exit demo console" : "Logout session"}
              >
                <LogOut size={12} />
              </button>
            )}
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold transition-all select-none shrink-0 border ${
                  isActive
                    ? "bg-brand-gold text-page border-brand-gold ring-2 ring-brand-gold/30 scale-105"
                    : "bg-card-border text-muted border-transparent hover:border-muted/30 hover:scale-105"
                }`
              }
              title="User Profile & Settings"
            >
              IK
            </NavLink>
          </div>
        </div>
        
        {/* Status block */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 w-full md:w-auto text-muted">
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
          <div className="flex items-center gap-2 md:ml-1">
            {isDemo ? (
              <span className="border border-brand-blue text-brand-blue text-[10px] font-semibold px-2 py-0.5 rounded-none tracking-[0.08em] whitespace-nowrap animate-pulse">
                DEMO MODE
              </span>
            ) : (
              <span className="border border-brand-gold text-brand-gold text-[10px] font-semibold px-2 py-0.5 rounded-none tracking-[0.08em] whitespace-nowrap">
                PAPER
              </span>
            )}
            <div className="hidden md:flex">
              <NotificationBell />
            </div>
            {auth?.auth_enabled && auth?.authenticated && (
              <button
                onClick={handleLogout}
                className="hidden md:flex text-muted hover:text-brand-red px-2.5 py-1 border border-divider hover:border-brand-red/30 transition-colors items-center gap-1.5 text-[10px] font-semibold tracking-wider cursor-pointer"
                title={isDemo ? "Exit demo console" : "Logout session"}
              >
                <LogOut size={12} />
                {isDemo ? "EXIT DEMO" : "LOGOUT"}
              </button>
            )}
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `hidden md:flex w-7 h-7 rounded-full items-center justify-center text-[11px] font-semibold transition-all select-none shrink-0 border ${
                  isActive
                    ? "bg-brand-gold text-page border-brand-gold ring-2 ring-brand-gold/30 scale-105"
                    : "bg-card-border text-muted border-transparent hover:border-muted/30 hover:scale-105"
                }`
              }
              title="User Profile & Settings"
            >
              IK
            </NavLink>
          </div>
        </div>
      </div>

      {/* Nav tabs */}
      <nav className="flex gap-6 border-b border-divider overflow-x-auto">
        {NAV.map(({ to, label, end, icon: Icon }) => (
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
            <Icon size={13} strokeWidth={1.75} />
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
  const { getToken, isLoaded } = useAuth();

  useEffect(() => {
    if (isLoaded) {
      setTokenProvider(getToken);
    }
  }, [getToken, isLoaded]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="*"
        element={
          <ProtectedRoute>
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
                  <Route path="/learn" element={<Learn />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </main>
            </div>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
