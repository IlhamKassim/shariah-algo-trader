import { useState, useRef, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  ArrowUpRight,
  SlidersHorizontal,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type NotificationItem } from "../lib/api";

// ── Notification preferences (localStorage) ───────────────────────────────────

const PREFS_KEY = "notif_muted_sources";

const SOURCES = [
  { id: "shariah_trader", label: "Shariah Trader" },
  { id: "day_trader",     label: "Day Trader" },
  { id: "platform",       label: "Platform" },
] as const;

function useNotificationPrefs() {
  const [muted, setMuted] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(PREFS_KEY);
      return stored ? new Set<string>(JSON.parse(stored)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  const toggle = (source: string) => {
    setMuted((prev) => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      localStorage.setItem(PREFS_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  return { muted, toggle };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatAbsoluteTime(ts: string): string {
  return (
    new Date(ts).toLocaleString("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }) + " ET"
  );
}

/** Severity styling in Console tokens (DESIGN.md §A) — colour carries meaning. */
function severityConfig(severity: string) {
  switch (severity) {
    case "critical":
      return { accent: "var(--c-red)", Icon: AlertCircle, label: "Critical" };
    case "warning":
      return { accent: "var(--c-amber)", Icon: AlertTriangle, label: "Warning" };
    default:
      return { accent: "var(--c-blue)", Icon: Info, label: "Info" };
  }
}

const SOURCE_LABEL: Record<string, string> = {
  shariah_trader: "Shariah Algo Trader",
  day_trader:     "Day Trader",
  platform:       "Platform",
};

const CATEGORY_LABEL: Record<string, string> = {
  trade:      "Trade",
  compliance: "Compliance",
  platform:   "Platform Alert",
};

/** Current Console routes. The old /app/* paths still redirect, but linking
 *  straight to the destination avoids a pointless bounce. */
function getNavInfo(item: NotificationItem): { path: string; label: string } {
  if (item.source === "day_trader") return { path: "/day-trader", label: "Day Trader" };
  if (item.source === "shariah_trader") {
    if (item.category === "compliance") return { path: "/console",  label: "Console"  };
    if (item.category === "trade")      return { path: "/ledger",   label: "Ledger"   };
    if (item.category === "platform")   return { path: "/universe", label: "Universe" };
  }
  return { path: "/console", label: "Console" };
}

// ── Detail modal ──────────────────────────────────────────────────────────────

function NotificationModal({
  item,
  onClose,
}: {
  item: NotificationItem;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { accent, Icon, label } = severityConfig(item.severity);
  const { path, label: pageLabel } = getNavInfo(item);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const chip =
    "text-[11px] px-2 py-0.5 rounded-[var(--r-chip)] bg-[var(--c-soft)] text-[var(--c-mid)]";

  return (
    <div className="console-root fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-[rgba(16,17,20,0.45)]" onClick={onClose} />

      <div
        className="relative w-full max-w-[420px] max-h-[85vh] overflow-y-auto bg-[var(--c-card)] border border-[var(--c-line)] rounded-[var(--r-card)] shadow-[var(--sh-pop)]"
        role="dialog"
        aria-modal="true"
        aria-label={item.title}
      >
        <div className="flex items-start gap-3 px-5 pt-5 pb-3.5">
          <span
            className="w-[22px] h-[22px] shrink-0 rounded-[var(--r-chip)] flex items-center justify-center mt-0.5"
            style={{ background: accent }}
          >
            <Icon size={13} strokeWidth={2} className="text-white" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold tracking-[-0.01em] leading-snug">{item.title}</p>
            <p className="text-[12px] text-[var(--c-mute)] mt-1">
              {formatAbsoluteTime(item.created_at)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--c-mute)] hover:text-[var(--c-ink)] transition-colors cursor-pointer shrink-0 p-1"
            aria-label="Close"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        <div className="px-5 pb-4">
          <p className="text-[12.5px] text-[var(--c-mid)] leading-[1.55]">{item.body}</p>
        </div>

        <div className="flex flex-wrap gap-1.5 px-5 pb-5">
          <span className={chip} style={{ color: accent }}>
            {label}
          </span>
          <span className={chip}>{SOURCE_LABEL[item.source] ?? item.source}</span>
          <span className={chip}>{CATEGORY_LABEL[item.category] ?? item.category}</span>
        </div>

        <div className="border-t border-[var(--c-line)] px-5 py-3 flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-[12.5px] text-[var(--c-mid)] hover:text-[var(--c-ink)] transition-colors cursor-pointer"
          >
            Dismiss
          </button>
          <button
            onClick={() => { onClose(); navigate(path); }}
            className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--c-blue)] hover:opacity-80 transition-opacity cursor-pointer"
          >
            View in {pageLabel}
            <ArrowUpRight size={12} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Notification row ──────────────────────────────────────────────────────────

function NotificationRow({
  item,
  onSelect,
}: {
  item: NotificationItem;
  onSelect: (item: NotificationItem) => void;
}) {
  const queryClient = useQueryClient();
  const markOne = useMutation({
    mutationFn: () => api.markRead(item.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const { accent, Icon } = severityConfig(item.severity);

  const handleClick = () => {
    if (!item.read) markOne.mutate();
    onSelect(item);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={`flex gap-2.5 px-4 py-3 border-b border-[var(--c-line)] last:border-b-0 transition-colors cursor-pointer select-none hover:bg-[var(--c-soft)] ${
        item.read ? "opacity-60" : ""
      }`}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === "Enter") handleClick(); }}
    >
      <Icon size={13} strokeWidth={2} className="mt-0.5 shrink-0" style={{ color: accent }} />
      <div className="flex-1 min-w-0">
        <p
          className={`text-[12.5px] leading-tight truncate ${
            item.read ? "text-[var(--c-mid)] font-medium" : "font-semibold"
          }`}
        >
          {item.title}
        </p>
        <p className="text-[12px] text-[var(--c-mid)] leading-snug mt-1 line-clamp-2">{item.body}</p>
        <p className="text-[11px] text-[var(--c-mute)] mt-1.5 tabular-nums">
          {relativeTime(item.created_at)}
        </p>
      </div>
      {!item.read && (
        <span
          className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
          style={{ background: accent }}
        />
      )}
    </div>
  );
}

// ── Bell + dropdown ───────────────────────────────────────────────────────────

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [selected, setSelected] = useState<NotificationItem | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { muted, toggle } = useNotificationPrefs();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: api.notifications,
    refetchInterval: 30_000,
  });

  const markAll = useMutation({
    mutationFn: api.markAllRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  // Close on outside click
  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowFilter(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !selected) { setOpen(false); setShowFilter(false); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected]);

  const handleSelect = (item: NotificationItem) => {
    setOpen(false);
    setShowFilter(false);
    setSelected(item);
  };

  // Apply muted-source filter
  const allItems   = data?.items ?? [];
  const visible    = allItems.filter((n) => !muted.has(n.source));
  const unreadAll  = data?.unread_count ?? 0;
  const unreadMuted = allItems.filter((n) => muted.has(n.source) && !n.read).length;
  const unread     = Math.max(0, unreadAll - unreadMuted);

  return (
    <>
      <div ref={containerRef} className="relative">
        {/* Bell button */}
        <button
          id="notification-bell-btn"
          onClick={() => { setOpen((o) => !o); setShowFilter(false); }}
          className="relative w-[38px] h-[38px] flex items-center justify-center rounded-[var(--r-btn)] bg-[var(--c-card)] border border-[var(--c-line)] shadow-[var(--sh-card)] text-[var(--c-mid)] hover:text-[var(--c-ink)] transition-colors cursor-pointer"
          aria-label={`Notifications${unread > 0 ? ` — ${unread} unread` : ""}`}
          aria-haspopup="true"
          aria-expanded={open}
        >
          <Bell size={15} strokeWidth={1.75} />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] rounded-full bg-[var(--c-red)] text-[10px] font-semibold text-white flex items-center justify-center px-1 leading-none tabular-nums pointer-events-none">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>

        {/* Dropdown */}
        {open && (
          <div
            id="notification-dropdown"
            className="absolute right-0 top-full mt-2 w-[min(320px,calc(100vw-24px))] bg-[var(--c-card)] border border-[var(--c-line)] rounded-[var(--r-card)] shadow-[var(--sh-pop)] z-50 flex flex-col overflow-hidden"
            style={{ maxHeight: "440px" }}
            role="dialog"
            aria-label="Notifications"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[var(--c-line)] shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[13.5px] font-semibold tracking-[-0.01em]">
                  Notifications
                </span>
                {unread > 0 && (
                  <span className="text-[10px] font-semibold bg-[var(--c-red)] text-white rounded-full px-1.5 py-0.5 leading-none tabular-nums">
                    {unread}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                {/* Filter toggle */}
                <button
                  onClick={() => setShowFilter((f) => !f)}
                  className={`transition-colors cursor-pointer ${
                    showFilter || muted.size > 0
                      ? "text-[var(--c-blue)]"
                      : "text-[var(--c-mute)] hover:text-[var(--c-ink)]"
                  }`}
                  title="Notification filters"
                  aria-label="Toggle notification filters"
                >
                  <SlidersHorizontal size={12} strokeWidth={2} />
                </button>
                {unread > 0 && (
                  <button
                    onClick={() => markAll.mutate()}
                    disabled={markAll.isPending}
                    className="flex items-center gap-1 text-[12px] text-[var(--c-mid)] hover:text-[var(--c-ink)] transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap"
                    title="Mark all as read"
                  >
                    <CheckCheck size={11} strokeWidth={2} />
                    Mark all read
                  </button>
                )}
                {/* The dropdown is a preview; the full history lives on its own page. */}
                <NavLink
                  to="/notifications"
                  onClick={() => { setOpen(false); setShowFilter(false); }}
                  className="text-[12px] font-semibold text-[var(--c-blue)] hover:opacity-80 transition-opacity whitespace-nowrap"
                >
                  See all
                </NavLink>
                <button
                  onClick={() => { setOpen(false); setShowFilter(false); }}
                  className="text-[var(--c-mute)] hover:text-[var(--c-ink)] transition-colors cursor-pointer"
                  aria-label="Close notifications"
                >
                  <X size={12} strokeWidth={2} />
                </button>
              </div>
            </div>

            {/* Filter panel */}
            {showFilter && (
              <div className="px-4 py-3 border-b border-[var(--c-line)] bg-[var(--c-soft)] shrink-0">
                <p className="text-[11px] text-[var(--c-mute)] uppercase tracking-[0.06em] mb-2">
                  Show notifications from
                </p>
                <div className="flex flex-col gap-1.5">
                  {SOURCES.map(({ id, label }) => {
                    const active = !muted.has(id);
                    return (
                      <button
                        key={id}
                        onClick={() => toggle(id)}
                        className="flex items-center justify-between w-full px-2 py-1.5 hover:bg-[var(--c-card)] transition-colors cursor-pointer rounded-[var(--r-chip)]"
                      >
                        <span className={`text-[12.5px] font-medium ${active ? "text-[var(--c-ink)]" : "text-[var(--c-mute)]"}`}>
                          {label}
                        </span>
                        {/* Toggle pill */}
                        <div className={`relative w-7 h-4 rounded-full transition-colors ${active ? "bg-[var(--c-blue)]" : "bg-[var(--c-line)]"}`}>
                          <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${active ? "left-[calc(100%-14px)]" : "left-0.5"}`} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Items list */}
            <div className="overflow-y-auto flex-1 overscroll-contain">
              {visible.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2.5">
                  <Bell size={22} strokeWidth={1.25} className="text-[var(--c-mute)]" />
                  <span className="text-[12.5px] text-[var(--c-mid)]">
                    {muted.size > 0 ? "No notifications for selected sources" : "No notifications yet"}
                  </span>
                </div>
              ) : (
                visible.map((item) => (
                  <NotificationRow key={item.id} item={item} onSelect={handleSelect} />
                ))
              )}
            </div>

            {/* Footer */}
            {visible.length > 0 && (
              <div className="px-4 py-2.5 border-t border-[var(--c-line)] shrink-0">
                <p className="text-[11px] text-[var(--c-mute)] text-center">
                  {muted.size > 0 && (
                    <span className="text-[var(--c-blue)]">
                      {muted.size} source{muted.size !== 1 ? "s" : ""} muted ·{" "}
                    </span>
                  )}
                  Showing last 30 days · {visible.length} event{visible.length !== 1 ? "s" : ""}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <NotificationModal item={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
