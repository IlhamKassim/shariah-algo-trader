import { useState, useEffect } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate, Navigate } from "react-router-dom";
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
  Flame,
  Shield,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AccountModeModal } from "./components/AccountModeModal";
import { UserAvatar } from "./components/UserAvatar";
import { Overview } from "./pages/Overview";
import { OverviewV2 } from "./pages/OverviewV2";
import { Portfolio } from "./pages/Portfolio";
import { Universe } from "./pages/Universe";
import { Activity } from "./pages/Activity";
import { Compare } from "./pages/Compare";
import { DayTrader } from "./pages/DayTrader";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { NotificationBell } from "./components/NotificationBell";
import { Login } from "./pages/Login";
import { Landing } from "./pages/Landing";
import { RiskDisclosure } from "./pages/RiskDisclosure";
import { Learn } from "./pages/Learn";
import { Settings } from "./pages/Settings";
import { api, setTokenProvider } from "./lib/api";
import { useAuth } from "@clerk/react";
import { supabase } from "./lib/supabaseClient";

const NAV = [
  { to: "/app", label: "Overview", end: true, icon: LayoutDashboard },
  { to: "/app/portfolio", label: "Portfolio", end: false, icon: Briefcase },
  { to: "/app/universe", label: "Universe", end: false, icon: Globe },
  { to: "/app/activity", label: "Activity", end: false, icon: ScrollText },
  { to: "/app/compare", label: "Compare", end: false, icon: GitCompareArrows },
  { to: "/app/day-trader", label: "Day Trader", end: false, icon: Zap },
  { to: "/app/learn", label: "Learn", end: false, icon: BookOpen },
  { to: "/app/settings", label: "Settings", end: false, icon: SlidersHorizontal },
];

const PAGE_META: Record<string, { title: string; sub: string }> = {
  "/app": {
    title: "Overview",
    sub: "Portfolio health, performance and compliance at a glance",
  },
  "/app/portfolio": {
    title: "Portfolio",
    sub: "Open positions held in the Shariah-compliant strategy",
  },
  "/app/universe": {
    title: "Universe",
    sub: "Eligible stocks ranked by composite Factor Score",
  },
  "/app/activity": {
    title: "Activity Log",
    sub: "Audit trail of compliance checks, rebalances and orders",
  },
  "/app/compare": {
    title: "Strategy Comparison",
    sub: "Shariah Algo vs Day Trader — risk-adjusted performance side by side",
  },
  "/app/day-trader": {
    title: "Day Trader",
    sub: "Gap & Go intraday positions, fills and scanner config",
  },
  "/app/learn": {
    title: "Learn",
    sub: "Understanding factor investing, strategy logic, and Shariah compliance",
  },
  "/app/settings": {
    title: "Settings Profile",
    sub: "Manage Alpaca API credentials, ETF targets, factor weights, and user authentication",
  },
};

interface TopbarProps {
  isV2UI?: boolean;
  onToggleV2UI?: () => void;
}

function Topbar({ isV2UI = false, onToggleV2UI }: TopbarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isDayTraderPage = location.pathname === "/app/day-trader";
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

  const [showAccountModal, setShowAccountModal] = useState(false);

  const { data: status } = useQuery({
    queryKey: ["status"],
    queryFn: api.status,
    refetchInterval: 30_000,
  });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
    refetchInterval: 30_000,
  });

  const currentMode: "paper" | "live" = (status?.trading_mode || settings?.trading_mode || (status?.broker_url?.includes("paper") ? "paper" : "live")) as "paper" | "live";

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

  const { signOut, isSignedIn, isLoaded: clerkLoaded } = useAuth();
  const showLogout = isDemo || auth?.authenticated || (clerkLoaded && isSignedIn);

  const handleLogout = async () => {
    try {
      if (isDemo) {
        localStorage.removeItem("shariah_demo_mode");
      } else if (auth?.clerk_enabled) {
        await signOut();
      } else {
        if (supabase) {
          await supabase.auth.signOut();
        }
        await api.logout();
      }
      queryClient.clear();
      await queryClient.invalidateQueries();
      navigate("/landing", { replace: true });
    } catch (err) {
      console.error("Logout failed:", err);
      navigate("/landing", { replace: true });
    }
  };

  const navCounts: Record<string, number | undefined> = {
    "/portfolio": positions?.length,
    "/universe": universe?.stocks.length,
  };  
  const visibleNav = isDemo ? NAV.filter((item) => item.to !== "/app/settings") : NAV;

  return (
    <header className={`border-b border-divider shrink-0 px-6 ${isV2UI ? "bg-[#0B0D14] border-white/10" : "bg-sidebar"}`}>
      {/* Brand row */}
      <div className="min-h-14 py-3 md:py-0 md:h-14 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center justify-between w-full md:w-auto gap-4">
          <div className="flex items-center gap-3 min-w-0 select-none">
            <div className={`w-8 h-8 flex items-center justify-center shrink-0 ${isV2UI ? "bg-indigo-600 rounded-lg text-white" : "bg-brand-gold text-page"}`}>
              <TrendingUp size={15} strokeWidth={2.5} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-primary tracking-[0.02em] whitespace-nowrap">
                SHARIAHTRADING
              </span>
              <span
                className={`text-[9px] font-medium tracking-[0.03em] whitespace-nowrap ${
                  isDayTraderPage ? "text-brand-gold" : "text-muted"
                }`}
              >
                {isDayTraderPage ? "Benchmark bot · Not Shariah-screened" : "Long-only · No leverage · Shariah-screened"}
              </span>
            </div>
          </div>
          {/* Mobile-only session actions */}
          <div className="flex items-center gap-2 md:hidden">
            {onToggleV2UI && (
              <button
                type="button"
                onClick={onToggleV2UI}
                className="px-2 py-1 text-[10px] font-mono font-bold rounded bg-indigo-600/20 border border-indigo-500/40 text-indigo-300"
              >
                {isV2UI ? "Classic UI" : "Try New Quantix Glass UI (Beta)"}
              </button>
            )}
            <NotificationBell />
            {showLogout && (
              <button
                onClick={handleLogout}
                className="text-muted hover:text-brand-red p-1.5 border border-divider hover:border-brand-red/30 transition-colors flex items-center justify-center text-xs font-semibold cursor-pointer"
                title={isDemo ? "Exit demo console" : "Logout session"}
              >
                <LogOut size={14} />
              </button>
            )}
            {!isDemo && (
              <NavLink
                to="/app/settings"
                className="w-7 h-7 rounded-full flex items-center justify-center select-none shrink-0"
                title="User Profile & Settings"
              >
                <UserAvatar />
              </NavLink>
            )}
          </div>
        </div>

        {/* Status block */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 w-full md:w-auto text-muted">
          {/* Toggle Button for V2 Glass UI */}
          {onToggleV2UI && (
            <button
              type="button"
              onClick={onToggleV2UI}
              className={`px-3 py-1 text-[11px] font-mono font-bold rounded-xl transition-all cursor-pointer border ${
                isV2UI
                  ? "bg-indigo-600/30 border-indigo-500/50 text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.3)]"
                  : "bg-slate-800/80 border-white/10 text-slate-300 hover:bg-slate-700/80"
              }`}
              title="Switch UI design between Classic Shariah and Quantix Glass"
            >
              {isV2UI ? "Return to Classic UI" : "Try New Quantix Glass UI (Beta)"}
            </button>
          )}

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
            ) : currentMode === "live" ? (
              <button
                onClick={() => setShowAccountModal(true)}
                className="flex items-center gap-1 border border-rose-500 bg-rose-950/30 hover:bg-rose-950/60 text-rose-300 text-[10px] font-bold px-2 py-0.5 rounded-none tracking-[0.08em] whitespace-nowrap cursor-pointer transition-all shadow-[0_0_10px_rgba(244,63,94,0.3)] animate-pulse"
                title="Click to switch trading environment"
              >
                <Flame size={12} className="text-rose-400" />
                <span>LIVE REAL MONEY</span>
              </button>
            ) : (
              <button
                onClick={() => setShowAccountModal(true)}
                className="flex items-center gap-1 border border-brand-gold bg-brand-gold/10 hover:bg-brand-gold/20 text-brand-gold text-[10px] font-semibold px-2 py-0.5 rounded-none tracking-[0.08em] whitespace-nowrap cursor-pointer transition-all"
                title="Click to switch trading environment"
              >
                <Shield size={11} className="text-brand-gold" />
                <span>PAPER ACCOUNT</span>
              </button>
            )}
            <div className="hidden md:flex">
              <NotificationBell />
            </div>
            {showLogout && (
              <button
                onClick={handleLogout}
                className="hidden md:flex text-muted hover:text-brand-red px-2.5 py-1 border border-divider hover:border-brand-red/30 transition-colors items-center gap-1.5 text-[10px] font-semibold tracking-wider cursor-pointer"
                title={isDemo ? "Exit demo console" : "Logout session"}
              >
                <LogOut size={12} />
                {isDemo ? "EXIT DEMO" : "LOGOUT"}
              </button>
            )}
            {!isDemo && (
              <NavLink
                to="/app/settings"
                className="hidden md:flex w-7 h-7 rounded-full items-center justify-center select-none shrink-0"
                title="User Profile & Settings"
              >
                <UserAvatar />
              </NavLink>
            )}
          </div>
        </div>

        {/* Environment Switcher Modal */}
        <AccountModeModal
          isOpen={showAccountModal}
          onClose={() => setShowAccountModal(false)}
          currentMode={currentMode}
        />
      </div>

      {/* Nav tabs */}
      <nav className="flex gap-6 border-b border-divider overflow-x-auto">
        {visibleNav.map(({ to, label, end, icon: Icon }) => (
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
  const meta = PAGE_META[location.pathname] ?? PAGE_META["/app"];
  return (
    <div className="mb-6">
      <h1 className="text-[15px] font-semibold text-primary leading-tight">{meta.title}</h1>
      <p className="text-[11px] text-muted leading-tight mt-0.5">{meta.sub}</p>
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    const mainEl = document.querySelector("main");
    if (mainEl) {
      mainEl.scrollTop = 0;
    }
  }, [pathname]);

  return null;
}

import { ServerStatusBanner } from "./components/ServerStatusBanner";

export default function App() {
  const { getToken, isLoaded } = useAuth();
  const [isV2UI, setIsV2UI] = useState(() => localStorage.getItem("shariah_ui_v2_enabled") === "true");

  const toggleV2UI = () => {
    const next = !isV2UI;
    setIsV2UI(next);
    localStorage.setItem("shariah_ui_v2_enabled", String(next));
  };

  useEffect(() => {
    if (isLoaded) {
      setTokenProvider(async () => {
        try {
          return await getToken();
        } catch {
          return null;
        }
      });
    }
  }, [getToken, isLoaded]);

  const isDemo = localStorage.getItem("shariah_demo_mode") === "true";

  return (
    <>
      <ServerStatusBanner />
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/risk-disclosure" element={<RiskDisclosure />} />
        <Route
          path="/app/*"
          element={
            <ProtectedRoute>
              <div className={`min-h-screen ${isV2UI ? "bg-[#08090E] text-slate-100" : "bg-page"} flex flex-col`}>
                <Topbar isV2UI={isV2UI} onToggleV2UI={toggleV2UI} />
                <main className={`flex-1 overflow-y-auto ${isV2UI ? "px-2 sm:px-6 py-4 max-w-[1500px]" : "px-6 py-6 max-w-[1400px]"} w-full mx-auto`}>
                  {!isV2UI && <PageHeading />}
                  <Routes>
                    <Route path="/" element={isV2UI ? <OverviewV2 /> : <Overview />} />
                    <Route path="/portfolio" element={<Portfolio />} />
                    <Route path="/universe" element={<Universe />} />
                    <Route path="/activity" element={<Activity />} />
                    <Route path="/compare" element={<Compare />} />
                    <Route path="/day-trader" element={<DayTrader />} />
                    <Route path="/learn" element={<Learn />} />
                    <Route path="/settings" element={isDemo ? <Navigate to="/app" replace /> : <Settings />} />
                  </Routes>
                </main>
              </div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
}
