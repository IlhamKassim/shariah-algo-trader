import type { TesterState } from "./api";

const MISSING = "—";
const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** "$10,000.00" — USD currency formatting; "—" when the value is missing. */
export function formatCurrency(value: string | number | null | undefined): string {
  const n = toNumber(value);
  return n === null ? MISSING : usd.format(n);
}

/** "+$120.50" / "-$30.00" — signed USD; zero stays unsigned; "—" when missing. */
export function formatSignedCurrency(value: string | number | null | undefined): string {
  const n = toNumber(value);
  if (n === null) return MISSING;
  if (n === 0) return usd.format(0);
  const sign = n > 0 ? "+" : "-";
  return `${sign}${usd.format(Math.abs(n))}`;
}

/** "just now" / "5m ago" / "3h ago" / "2d ago" / "2026-08-05"; "Never" when missing. */
export function formatRelativeTime(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return "Never";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "Never";
  const diff = now - then;
  if (diff < MINUTE) return "just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`;
  return new Date(then).toISOString().slice(0, 10);
}

/** "2026-08-13 00:00" (UTC) — "—" when missing or unparseable. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return MISSING;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return MISSING;
  return (
    `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ` +
    `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`
  );
}

/** Badge tone per lifecycle state — the only color the table may carry. */
export function stateTone(state: TesterState): "amber" | "green" | "red" | "slate" {
  switch (state) {
    case "pending":
      return "amber";
    case "active":
      return "green";
    case "revoked":
      return "red";
    default:
      return "slate";
  }
}

/** Badge tone for the keys column: green when paper creds are on file. */
export function keysTone(hasPaperKeys: boolean): "green" | "slate" {
  return hasPaperKeys ? "green" : "slate";
}

/** "5b7fb8dd…e279" — elides the middle of long ids for the table. */
export function truncateMiddle(value: string, maxStart = 8, maxEnd = 4): string {
  if (value.length <= maxStart + maxEnd + 1) return value;
  return `${value.slice(0, maxStart)}…${value.slice(-maxEnd)}`;
}

/** Tester-facing signup URL carrying the single-use code (SPEC §7). */
export function inviteLink(code: string, base = "https://shariahtrading.my"): string {
  return `${base}/login?invite=${encodeURIComponent(code)}`;
}
