import { NavLink, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { NotificationBell } from "./NotificationBell";
import { UserAvatar } from "./UserAvatar";

/**
 * Chrome shared by every page migrated onto the Console design system
 * (DESIGN.md §A). Pages still on the obsidian system keep the dark Topbar in
 * AuthenticatedApp; MIGRATED/LEGACY below is the migration's progress marker —
 * each entry moves up as its page is ported.
 */

const MIGRATED = [
  { to: "/console", label: "Console" },
  { to: "/performance", label: "Performance" },
  { to: "/universe", label: "Universe" },
];

const LEGACY = [
  { to: "/app/activity", label: "Activity" },
  { to: "/app/day-trader", label: "Day Trader" },
  { to: "/app/settings", label: "Settings" },
];

export function ConsoleShell({
  breadcrumb,
  aside,
  children,
}: {
  /** Trailing crumb after "Dashboard/". */
  breadcrumb: string;
  /** Optional right-hand content on the breadcrumb row (ticker strip, filters). */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { data: status } = useQuery({
    queryKey: ["status"],
    queryFn: api.status,
    refetchInterval: 30_000,
  });
  const { data: compliance } = useQuery({
    queryKey: ["compliance"],
    queryFn: api.compliance,
    refetchInterval: 60_000,
  });

  const etf = status?.etf_symbol ?? "SPUS";

  return (
    <div className="console-root min-h-screen px-[22px] pt-[22px]">
      <div className="max-w-[1420px] mx-auto flex flex-col gap-[26px]">
        <nav className="flex items-center gap-[18px] flex-wrap">
          <Link to="/console" className="flex items-center gap-2.5 min-w-0 !text-[var(--c-ink)]">
            <span className="w-[26px] h-[26px] shrink-0 flex items-center justify-center">
              <span className="w-[15px] h-[15px] bg-[var(--c-ink)] rounded-[4px] rotate-45 block" />
            </span>
            <span className="text-[17px] font-bold tracking-[-0.02em] whitespace-nowrap">
              ShariahTrading
            </span>
          </Link>

          <div className="flex items-center gap-2 flex-1 justify-center flex-wrap">
            <div className="flex gap-1 p-[5px] bg-[var(--c-card)] rounded-full shadow-[0_1px_2px_rgba(20,25,35,0.06)] flex-wrap">
              {MIGRATED.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `rounded-full text-[12.5px] px-4 py-2 whitespace-nowrap transition-colors ${
                      isActive
                        ? "bg-[var(--c-soft)] !text-[var(--c-ink)] font-semibold shadow-[0_1px_3px_rgba(20,25,35,0.12)]"
                        : "!text-[var(--c-mid)] hover:!text-[var(--c-ink)] font-medium"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              {LEGACY.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className="rounded-full text-[12.5px] px-4 py-2 whitespace-nowrap !text-[var(--c-mute)] hover:!text-[var(--c-ink)] font-medium transition-colors"
                >
                  {item.label}
                </NavLink>
              ))}
            </div>

            {/* Universe is configured in Settings, so this reports rather than toggles. */}
            <Link
              to="/app/settings"
              className="flex items-center gap-2.5 px-4 py-2.5 bg-[var(--c-card)] rounded-full shadow-[0_1px_2px_rgba(20,25,35,0.06)] !text-[var(--c-mid)] hover:!text-[var(--c-ink)]"
              title="Change the Eligible Universe ETF in Settings"
            >
              <span className="w-[15px] h-[15px] shrink-0 rounded-full border-[1.5px] border-[var(--c-mute)] block" />
              <span className="text-[13px] whitespace-nowrap">Universe:</span>
              <span className="text-[12.5px] font-semibold text-[var(--c-ink)] whitespace-nowrap">
                {etf}
              </span>
              {compliance?.universe_size ? (
                <span className="text-[12.5px] tabular-nums whitespace-nowrap">
                  {compliance.universe_size}
                </span>
              ) : null}
            </Link>
          </div>

          <div className="flex items-center gap-2.5">
            <NotificationBell />
            <Link
              to="/app/profile"
              className="w-[38px] h-[38px] shrink-0 rounded-full flex items-center justify-center"
              title="Quant Operator Profile"
            >
              <UserAvatar />
            </Link>
          </div>
        </nav>

        <div className="flex items-center justify-between gap-[26px] flex-wrap">
          <div className="flex items-center gap-3.5 min-w-0">
            <Link
              to="/console"
              aria-label="Back to Console"
              className="w-11 h-11 shrink-0 rounded-full bg-[var(--c-card)] flex items-center justify-center shadow-[0_2px_6px_rgba(20,25,35,0.07)] !text-[var(--c-ink)] text-base"
            >
              ←
            </Link>
            <span className="text-[15px] text-[var(--c-mute)]">
              Dashboard
              <span className="text-[var(--c-ink)] font-semibold">/{breadcrumb}</span>
            </span>
          </div>
          {aside}
        </div>

        {children}
      </div>
    </div>
  );
}
