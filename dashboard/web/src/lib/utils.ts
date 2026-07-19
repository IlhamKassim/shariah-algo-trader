export function formatCurrency(value: number): string {
  const normalized = Math.abs(value) < 0.005 ? 0 : value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(normalized);
}

export function formatPct(value: number, decimals = 2): string {
  const normalized = Math.abs(value) < 1e-4 ? 0 : value;
  const sign = normalized > 0 ? "+" : normalized < 0 ? "" : "";
  return `${sign}${normalized.toFixed(decimals)}%`;
}

export function formatQty(value: number, decimals = 4): string {
  if (value % 1 === 0) return value.toLocaleString("en-US");
  return value.toLocaleString("en-US", { maximumFractionDigits: decimals });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return iso.replace("T", " ").replace(/\.\d+.*$/, "");
}

export function plColor(value: number): string {
  const normalized = Math.abs(value) < 1e-4 ? 0 : value;
  if (normalized === 0) return "text-faint";
  return normalized > 0 ? "text-brand-green" : "text-brand-red";
}
