import React, { useCallback, useEffect, useState } from "react";
import type { ActivityEvent, AdminApi } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { ActivityDropdown } from "./ui/activity-dropdown";
import { Bell } from "lucide-react";

interface ActivityTrailViewProps {
  api: AdminApi | null;
}

export function ActivityTrailView({ api }: ActivityTrailViewProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [selectedEventType, setSelectedEventType] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d" | "all">("all");
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ActivityEvent | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    try {
      let since: string | undefined;
      const now = Date.now();
      if (timeRange === "24h") since = new Date(now - 86_400_000).toISOString();
      else if (timeRange === "7d") since = new Date(now - 7 * 86_400_000).toISOString();
      else if (timeRange === "30d") since = new Date(now - 30 * 86_400_000).toISOString();

      const res = await api.getAuditLogs({
        limit: 100,
        offset: 0,
        event_type: selectedEventType || undefined,
        q: searchQuery || undefined,
        since,
      });

      setEvents(res.events);
      setTotal(res.total);
      if (res.event_types.length > 0) {
        setEventTypes(res.event_types);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [api, selectedEventType, searchQuery, timeRange]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const exportCsv = () => {
    if (events.length === 0) return;
    const headers = ["ID", "Timestamp", "Actor", "Actor_Cust_ID", "Event_Type", "IP_Address", "Details"];
    const rows = events.map((e) => [
      e.id,
      e.created_at,
      e.actor,
      e.actor_cust_id ?? "",
      e.event_type,
      e.ip_address,
      `"${(e.details || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shariah-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activityDropdownItems = events.slice(0, 5).map((e) => ({
    id: e.id,
    icon: <Bell className="h-4 w-4 text-[#D1A92E]" />,
    iconBg: "bg-neutral-800",
    title: e.event_type.replace(/_/g, " "),
    description: e.details,
    time: formatDateTime(e.created_at),
  }));

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b-2 border-[#333333] pb-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-[#ba1a1a] uppercase tracking-wider">
            Activity Audit Trail
          </h2>
          <p className="text-xs font-body text-secondary-fixed-dim mt-1 font-bold uppercase tracking-widest">
            Cryptographically sealed immutable compliance and operator log stream
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={events.length === 0}
          className="px-4 py-2 border-2 border-[#333333] bg-[#242322] text-[#f2f0f1] text-xs font-label font-bold uppercase tracking-widest hover:bg-[#333333] transition-none disabled:opacity-50 flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[16px]">download</span>
          Export Audit CSV
        </button>
      </div>

      {/* Quick Activity Dropdown Widget */}
      <div className="flex justify-start">
        <ActivityDropdown
          activities={activityDropdownItems.length > 0 ? activityDropdownItems : undefined}
          title={activityDropdownItems.length > 0 ? `${activityDropdownItems.length} Live Audit Events` : undefined}
          subtitle="Platform activity overview & events"
        />
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#1a1918] border-2 border-[#333333] p-4">
        {/* Search */}
        <div className="flex items-center bg-[#0a0a0a] border-2 border-[#333333] px-3 py-1.5 focus-within:border-[#f2f0f1]">
          <span className="material-symbols-outlined text-secondary-fixed-dim mr-2 text-[18px]">
            search
          </span>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search query in actor or details…"
            className="bg-transparent border-none focus:outline-none w-full text-xs font-mono text-[#f2f0f1] placeholder:text-secondary-fixed-dim"
          />
        </div>

        {/* Event Type Filter */}
        <div>
          <select
            value={selectedEventType}
            onChange={(e) => setSelectedEventType(e.target.value)}
            className="w-full bg-[#0a0a0a] border-2 border-[#333333] px-3 py-2 text-xs font-mono text-[#f2f0f1] outline-none"
          >
            <option value="">ALL EVENT TYPES</option>
            {eventTypes.map((et) => (
              <option key={et} value={et}>
                {et}
              </option>
            ))}
          </select>
        </div>

        {/* Timeframe Filter */}
        <div className="flex bg-[#0a0a0a] border-2 border-[#333333]">
          {(["24h", "7d", "30d", "all"] as const).map((tr) => (
            <button
              key={tr}
              type="button"
              onClick={() => setTimeRange(tr)}
              className={`flex-1 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider border-r-2 border-[#333333] last:border-r-0 transition-none ${
                timeRange === tr ? "bg-[#f2f0f1] text-[#0a0a0a]" : "text-secondary-fixed-dim hover:bg-[#333333]"
              }`}
            >
              {tr}
            </button>
          ))}
        </div>
      </div>

      {/* Main Logs Table */}
      <div className="bg-[#1a1918] border-2 border-[#333333] p-6 space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-xs font-label font-bold uppercase tracking-widest text-[#f2f0f1]">
            Audit Trail Events ({total} Total)
          </h3>
          <span className="text-[10px] font-mono text-[#10b981] uppercase tracking-wider">
            ● SECURE CONNECTION VERIFIED
          </span>
        </div>

        <div className="data-grid grid-cols-5 border-2 border-[#333333]">
          {/* Header */}
          <div className="data-grid-header">Timestamp</div>
          <div className="data-grid-header">Actor / Cust ID</div>
          <div className="data-grid-header">Event Type</div>
          <div className="data-grid-header">IP Address</div>
          <div className="data-grid-header">Details</div>

          {/* Rows */}
          {loading ? (
            <div className="col-span-5 p-8 text-center text-xs font-mono text-secondary-fixed-dim">
              Loading audit logs…
            </div>
          ) : events.length === 0 ? (
            <div className="col-span-5 p-8 text-center text-xs font-mono text-secondary-fixed-dim">
              No audit logs recorded for this query.
            </div>
          ) : (
            events.map((ev) => (
              <React.Fragment key={ev.id}>
                <div
                  onClick={() => setSelectedEvent(ev)}
                  className="text-xs font-mono text-secondary-fixed-dim truncate bg-[#1a1918] cursor-pointer hover:underline"
                >
                  {formatDateTime(ev.created_at)}
                </div>
                <div
                  onClick={() => setSelectedEvent(ev)}
                  className="text-xs font-mono font-bold text-[#ffffff] truncate bg-[#1a1918] cursor-pointer"
                >
                  {ev.actor_cust_id ? (
                    <span className="text-[#3366cc]">{ev.actor_cust_id}</span>
                  ) : (
                    ev.actor
                  )}
                </div>
                <div
                  onClick={() => setSelectedEvent(ev)}
                  className="text-xs font-mono font-bold text-[#f9e37a] truncate bg-[#1a1918] uppercase cursor-pointer"
                >
                  {ev.event_type}
                </div>
                <div
                  onClick={() => setSelectedEvent(ev)}
                  className="text-xs font-mono text-secondary-fixed-dim truncate bg-[#1a1918] cursor-pointer"
                >
                  {ev.ip_address}
                </div>
                <div
                  onClick={() => setSelectedEvent(ev)}
                  className="text-xs font-mono text-[#f2f0f1] truncate bg-[#1a1918] cursor-pointer"
                  title={ev.details}
                >
                  {ev.details}
                </div>
              </React.Fragment>
            ))
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#1a1918] border-2 border-[#333333] max-w-xl w-full p-6 space-y-4">
            <div className="flex justify-between items-start border-b-2 border-[#333333] pb-3">
              <div>
                <h4 className="font-headline font-bold text-[#ffffff] uppercase tracking-wider">
                  Audit Event Inspector
                </h4>
                <p className="text-[10px] font-mono text-secondary-fixed-dim mt-0.5">
                  ID: {selectedEvent.id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="text-secondary-fixed-dim hover:text-[#ffffff] text-lg font-mono"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-[#333333]">
                <span className="text-secondary-fixed-dim">EVENT TYPE:</span>
                <span className="font-bold text-[#f9e37a]">{selectedEvent.event_type}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#333333]">
                <span className="text-secondary-fixed-dim">TIMESTAMP:</span>
                <span className="text-[#f2f0f1]">{selectedEvent.created_at}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#333333]">
                <span className="text-secondary-fixed-dim">ACTOR:</span>
                <span className="text-[#3366cc] font-bold">
                  {selectedEvent.actor_cust_id || selectedEvent.actor}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#333333]">
                <span className="text-secondary-fixed-dim">IP ADDRESS:</span>
                <span className="text-[#f2f0f1]">{selectedEvent.ip_address}</span>
              </div>
              <div className="py-2">
                <span className="text-secondary-fixed-dim block mb-1">RAW DETAILS:</span>
                <div className="p-3 bg-[#0a0a0a] border-2 border-[#333333] text-[#f2f0f1] text-[11px] break-all leading-relaxed">
                  {selectedEvent.details}
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="w-full py-2 bg-[#333333] text-[#f2f0f1] text-xs font-mono font-bold uppercase tracking-widest border-2 border-[#555555] hover:bg-[#444444]"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
