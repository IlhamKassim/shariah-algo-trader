// Recharts consumes literal color strings (stroke/fill/tick.fill), not Tailwind
// classes — centralized here so chart colors stay in sync with tailwind.config.js.
export const CHART = {
  gold: "#D1A92E", // primary/strategy series
  // Deliberately NOT brand-blue (#7FB4FF) — that hex is already the semantic
  // color for Badge variant="blue" ("Held"/"Rebalance" tags), and reusing it
  // for a chart line would make the two unrelated meanings visually collide.
  secondary: "#6E88A3", // secondary/benchmark series
  grid: "#29241B", // divider
  tickText: "#4C4739", // faint
  bg: "#0C0B09", // page/card background (for chart tooltips/overlays)
} as const;
