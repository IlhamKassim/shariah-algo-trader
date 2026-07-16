import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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

function severityConfig(severity: string) {
  switch (severity) {
    case "critical":
      return {
        borderLeftClass: "border-l-brand-red",
        borderTopClass:  "border-t-brand-red",
        Icon: AlertCircle,
        iconClass: "text-brand-red",
        badge: "bg-brand-red/10 text-brand-red",
        label: "Critical",
      };
    case "warning":
      return {
        borderLeftClass: "border-l-brand-gold",
        borderTopClass:  "border-t-brand-gold",
        Icon: AlertTriangle,
        iconClass: "text-brand-gold",
        badge: "bg-brand-gold/10 text-brand-gold",
        label: "Warning",
      };
    default:
      return {
        borderLeftClass: "border-l-brand-green",
        borderTopClass:  "border-t-brand-green",
        Icon: Info,
        iconClass: "text-brand-green",
        badge: "bg-brand-green/10 text-brand-green",
        label: "Info",
      };
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

function getNavInfo(item: NotificationItem): { path: string; label: string } {
  if (item.source === "day_trader") return { path: "/day-trader", label: "Day Trader" };
  if (item.source === "shariah_trader") {
    if (item.category === "compliance") return { path: "/portfolio",  label: "Portfolio"    };
    if (item.category === "trade")      return { path: "/activity",   label: "Activity Log" };
    if (item.category === "platform")   return { path: "/universe",   label: "Universe"     };
  }
  return { path: "/", label: "Overview" };
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
  const { borderTopClass, Icon, iconClass, badge, label } = severityConfig(item.severity);
  const { path, label: pageLabel } = getNavInfo(item);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Card */}
      <div
        className={`relative w-full max-w-sm bg-sidebar border border-divider shadow-2xl border-t-2 ${borderTopClass}`}
        role="dialog"
        aria-modal="true"
        aria-label={item.title}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 pt-5 pb-4">
          <Icon size={16} strokeWidth={1.75} className={`${iconClass} mt-0.5 shrink-0`} />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-primary leading-snug">{item.title}</p>
            <p className="text-[10px] text-faint mt-0.5">{formatAbsoluteTime(item.created_at)}</p>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-primary transition-colors cursor-pointer shrink-0 -mt-0.5"
            aria-label="Close"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pb-4">
          <p className="text-[12px] text-muted leading-relaxed">{item.body}</p>
        </div>

        {/* Meta badges */}
        <div className="flex flex-wrap gap-1.5 px-5 pb-5">
          <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full tracking-wide uppercase ${badge}`}>
            {label}
          </span>
          <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-card-border text-muted uppercase tracking-wide">
            {SOURCE_LABEL[item.source] ?? item.source}
          </span>
          <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-card-border text-muted uppercase tracking-wide">
            {CATEGORY_LABEL[item.category] ?? item.category}
          </span>
        </div>

        {/* Footer */}
        <div className="border-t border-divider px-5 py-3 flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-[11px] text-muted hover:text-primary transition-colors cursor-pointer"
          >
            Dismiss
          </button>
          <button
            onClick={() => { onClose(); navigate(path); }}
            className="flex items-center gap-1.5 text-[11px] font-medium text-brand-gold hover:text-brand-gold/80 transition-colors cursor-pointer"
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

  const { borderLeftClass, Icon, iconClass } = severityConfig(item.severity);

  const handleClick = () => {
    if (!item.read) markOne.mutate();
    onSelect(item);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={`flex gap-3 px-4 py-3 border-b border-divider border-l-2 ${borderLeftClass} transition-colors cursor-pointer select-none ${
        item.read ? "opacity-50 hover:opacity-70" : "bg-white/[0.02] hover:bg-white/[0.04]"
      }`}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === "Enter") handleClick(); }}
    >
      <Icon size={13} strokeWidth={1.75} className={`${iconClass} mt-0.5 shrink-0`} />
      <div className="flex-1 min-w-0">
        <p className={`text-[11px] font-semibold leading-tight truncate ${item.read ? "text-muted" : "text-primary"}`}>
          {item.title}
        </p>
        <p className="text-[10px] text-muted leading-snug mt-0.5 line-clamp-2">{item.body}</p>
        <p className="text-[9px] text-faint mt-1 tabular-nums">{relativeTime(item.created_at)}</p>
      </div>
      {!item.read && <span className="w-1.5 h-1.5 rounded-full bg-brand-gold mt-1 shrink-0" />}
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
          className="relative p-1.5 text-muted hover:text-primary transition-colors cursor-pointer"
          aria-label={`Notifications${unread > 0 ? ` — ${unread} unread` : ""}`}
          aria-haspopup="true"
          aria-expanded={open}
        >
          <Bell size={15} strokeWidth={1.75} />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] rounded-full bg-brand-red text-[9px] font-bold text-white flex items-center justify-center px-0.5 leading-none pointer-events-none">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>

        {/* Dropdown */}
        {open && (
          <div
            id="notification-dropdown"
            className="absolute right-0 top-full mt-2 w-80 bg-sidebar border border-divider shadow-2xl z-50 flex flex-col"
            style={{ maxHeight: "440px" }}
            role="dialog"
            aria-label="Notifications"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-divider shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-primary tracking-wide">
                  Notifications
                </span>
                {unread > 0 && (
                  <span className="text-[9px] font-bold bg-brand-red text-white rounded-full px-1.5 py-0.5 leading-none tabular-nums">
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
                      ? "text-brand-gold"
                      : "text-muted hover:text-primary"
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
                    className="flex items-center gap-1 text-[10px] text-muted hover:text-primary transition-colors cursor-pointer disabled:opacity-40"
                    title="Mark all as read"
                  >
                    <CheckCheck size={11} strokeWidth={2} />
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => { setOpen(false); setShowFilter(false); }}
                  className="text-muted hover:text-primary transition-colors cursor-pointer"
                  aria-label="Close notifications"
                >
                  <X size={12} strokeWidth={2} />
                </button>
              </div>
            </div>

            {/* Filter panel */}
            {showFilter && (
              <div className="px-4 py-3 border-b border-divider bg-card-border/20 shrink-0">
                <p className="text-[9px] text-faint uppercase tracking-widest mb-2">
                  Show notifications from
                </p>
                <div className="flex flex-col gap-1.5">
                  {SOURCES.map(({ id, label }) => {
                    const active = !muted.has(id);
                    return (
                      <button
                        key={id}
                        onClick={() => toggle(id)}
                        className="flex items-center justify-between w-full px-2 py-1.5 hover:bg-white/[0.04] transition-colors cursor-pointer rounded-sm"
                      >
                        <span className={`text-[11px] font-medium ${active ? "text-primary" : "text-muted"}`}>
                          {label}
                        </span>
                        {/* Toggle pill */}
                        <div className={`relative w-7 h-4 rounded-full transition-colors ${active ? "bg-brand-gold" : "bg-card-border"}`}>
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
                  <Bell size={22} strokeWidth={1.25} className="text-faint" />
                  <span className="text-[11px] text-muted">
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
              <div className="px-4 py-2 border-t border-divider shrink-0">
                <p className="text-[9px] text-faint text-center">
                  {muted.size > 0 && (
                    <span className="text-brand-gold">
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
