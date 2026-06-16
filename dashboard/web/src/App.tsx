import { NavLink, Route, Routes } from "react-router-dom";
import { BarChart2, BookOpen, Clock, LayoutDashboard } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Overview } from "./pages/Overview";
import { Portfolio } from "./pages/Portfolio";
import { Universe } from "./pages/Universe";
import { Activity } from "./pages/Activity";
import { api } from "./lib/api";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/portfolio", label: "Portfolio", icon: BarChart2, end: false },
  { to: "/universe", label: "Universe", icon: BookOpen, end: false },
  { to: "/activity", label: "Activity", icon: Clock, end: false },
];

function Sidebar() {
  const { data: status } = useQuery({
    queryKey: ["status"],
    queryFn: api.status,
    refetchInterval: 30_000,
  });

  return (
    <aside className="w-56 shrink-0 bg-neutral-900 border-r border-neutral-700 flex flex-col">
      <div className="px-5 py-5 border-b border-neutral-700">
        <p className="text-xs text-neutral-500 font-medium uppercase tracking-widest mb-0.5">
          Shariah
        </p>
        <p className="text-base font-semibold text-neutral-100">Algo Trader</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-neutral-700 text-neutral-100"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-neutral-700">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              status?.scheduler_running ? "bg-emerald-500" : "bg-neutral-600"
            }`}
          />
          <span className="text-xs text-neutral-500">
            {status?.scheduler_running ? "Scheduler active" : "Scheduler offline"}
          </span>
        </div>
      </div>
    </aside>
  );
}

export default function App() {
  return (
    <div className="flex h-screen bg-neutral-900 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/universe" element={<Universe />} />
          <Route path="/activity" element={<Activity />} />
        </Routes>
      </main>
    </div>
  );
}
