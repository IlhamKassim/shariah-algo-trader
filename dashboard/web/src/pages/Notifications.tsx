import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { api, type NotificationItem } from "../lib/api";
import { ConsoleShell } from "../components/ConsoleShell";
import { Segmented } from "../components/console/controls";

type Filter = "All" | "Unread" | "Critical";

const SEVERITY: Record<
  NotificationItem["severity"],
  { tone: string; bg: string; label: string }
> = {
  critical: { tone: "var(--c-red)", bg: "rgba(222,74,79,0.12)", label: "Critical" },
  warning: { tone: "#9A7B12", bg: "rgba(240,190,67,0.18)", label: "Warning" },
  info: { tone: "var(--c-blue)", bg: "rgba(37,99,235,0.10)", label: "Info" },
};

const relTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return formatDistanceToNow(d, { addSuffix: true });
};

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="min-w-0 bg-[var(--c-card)] rounded-[20px] px-5 py-4">
      <div className="text-[11px] text-[var(--c-mute)] uppercase tracking-[0.06em] whitespace-nowrap">
        {label}
      </div>
      <div
        className="console-display text-[24px] font-medium tracking-[-0.02em] mt-1.5 tabular-nums"
        style={tone ? { color: tone } : undefined}
      >
        {value}
      </div>
      {sub && <div className="text-[12px] text-[var(--c-mid)] mt-1">{sub}</div>}
    </div>
  );
}

export function Notifications() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("All");
  const [category, setCategory] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: api.notifications,
    refetchInterval: 30_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["notifications"] });
  const markOne = useMutation({ mutationFn: api.markRead, onSuccess: invalidate });
  const markAll = useMutation({ mutationFn: api.markAllRead, onSuccess: invalidate });

  const items = useMemo(() => data?.items ?? [], [data]);
  const unread = data?.unread_count ?? 0;
  const criticalUnread = items.filter((n) => !n.read && n.severity === "critical").length;

  const categories = useMemo(
    () => Array.from(new Set(items.map((n) => n.category).filter(Boolean))).sort(),
    [items],
  );

  const rows = useMemo(
    () =>
      items
        .filter((n) => {
          if (filter === "Unread" && n.read) return false;
          if (filter === "Critical" && n.severity !== "critical") return false;
          if (category && n.category !== category) return false;
          return true;
        })
        .slice()
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    [items, filter, category],
  );

  return (
    <ConsoleShell
      breadcrumb="Notifications"
      aside={
        <div className="flex items-center gap-2 flex-wrap">
          <Segmented
            idPrefix="notif-filter"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "All" as Filter, label: "All" },
              { value: "Unread" as Filter, label: `Unread${unread ? ` ${unread}` : ""}` },
              { value: "Critical" as Filter, label: "Critical" },
            ]}
          />
          <button
            type="button"
            onClick={() => markAll.mutate()}
            disabled={unread === 0 || markAll.isPending}
            className="border-0 rounded-full bg-[var(--c-card)] text-[var(--c-mid)] hover:text-[var(--c-ink)] font-[inherit] text-[12.5px] font-semibold px-5 py-2.5 whitespace-nowrap cursor-pointer shadow-[0_1px_2px_rgba(20,25,35,0.06)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {markAll.isPending ? "Marking…" : "Mark all read"}
          </button>
        </div>
      }
    >
      <div className="bg-[var(--c-sheet)] rounded-t-[34px] p-[26px] flex flex-col gap-[22px] min-h-[70vh]">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(210px,100%),1fr))] gap-3.5">
          <Tile label="Unread" value={String(unread)} sub={`${items.length} total`} tone={unread ? "var(--c-blue)" : undefined} />
          <Tile
            label="Critical unread"
            value={String(criticalUnread)}
            sub={criticalUnread ? "Needs attention" : "Nothing outstanding"}
            tone={criticalUnread ? "var(--c-red)" : "var(--c-green)"}
          />
          <Tile label="Categories" value={String(categories.length)} sub={categories.slice(0, 3).join(", ") || "—"} />
          <Tile
            label="Latest"
            value={items[0] ? relTime(items[0].created_at) : "—"}
            sub={items[0]?.source ?? "No notifications yet"}
          />
        </div>

        <section className="bg-[var(--c-card)] rounded-[26px] p-[22px] flex flex-col gap-4 min-w-0">
          <div className="flex items-center justify-between gap-3.5 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-[22px] h-[22px] shrink-0 rounded-[6px] bg-[var(--c-ink)] block" />
              <h2 className="text-[16px] font-semibold tracking-[-0.01em]">Notifications</h2>
              <span className="text-[12.5px] text-[var(--c-mute)] tabular-nums whitespace-nowrap">
                {rows.length} of {items.length}
              </span>
            </div>
            {categories.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory((cur) => (cur === c ? null : c))}
                    aria-pressed={category === c}
                    className={`border-0 rounded-full cursor-pointer font-[inherit] text-[12px] font-semibold px-[15px] py-2 whitespace-nowrap transition-opacity hover:opacity-85 ${
                      category === c
                        ? "bg-[var(--c-ink)] text-white"
                        : "bg-[var(--c-soft)] text-[var(--c-mid)]"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          {isLoading ? (
            <p className="text-[13px] text-[var(--c-mid)] py-12 text-center">Loading notifications…</p>
          ) : items.length === 0 ? (
            <p className="text-[13px] text-[var(--c-mid)] py-12 text-center">
              Nothing yet. Compliance exits, rebalances and engine errors will appear here.
            </p>
          ) : rows.length === 0 ? (
            <p className="text-[13px] text-[var(--c-mid)] py-12 text-center">
              No notifications match these filters.
            </p>
          ) : (
            <div className="flex flex-col">
              <AnimatePresence initial={false}>
                {rows.map((n) => {
                  const sev = SEVERITY[n.severity] ?? SEVERITY.info;
                  return (
                    <motion.div
                      key={n.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="flex items-start gap-4 py-4 border-b border-[var(--c-line)] last:border-b-0"
                    >
                      {/* Unread marker doubles as the severity colour. */}
                      <span className="w-2 shrink-0 flex justify-center pt-1.5">
                        <span
                          className="w-2 h-2 rounded-full block"
                          style={{ background: n.read ? "transparent" : sev.tone }}
                          aria-label={n.read ? undefined : "Unread"}
                        />
                      </span>

                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[13.5px] ${n.read ? "font-medium text-[var(--c-mid)]" : "font-semibold"}`}
                          >
                            {n.title}
                          </span>
                          <span
                            className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold whitespace-nowrap"
                            style={{ background: sev.bg, color: sev.tone }}
                          >
                            {sev.label}
                          </span>
                          {n.category && (
                            <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-[var(--c-soft)] text-[var(--c-mute)] whitespace-nowrap">
                              {n.category}
                            </span>
                          )}
                        </span>
                        <span className="block text-[12.5px] text-[var(--c-mid)] mt-1 leading-[1.55]">
                          {n.body}
                        </span>
                        <span className="block text-[11.5px] text-[var(--c-mute)] mt-1.5">
                          {n.source} · {relTime(n.created_at)}
                        </span>
                      </span>

                      {!n.read && (
                        <button
                          type="button"
                          onClick={() => markOne.mutate(n.id)}
                          className="shrink-0 rounded-full border border-[var(--c-line)] bg-transparent text-[var(--c-mid)] hover:text-[var(--c-ink)] font-[inherit] text-[12px] font-semibold px-3.5 py-2 whitespace-nowrap cursor-pointer transition-colors"
                        >
                          Mark read
                        </button>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </section>
      </div>
    </ConsoleShell>
  );
}
