// Recharts consumes literal color strings (stroke/fill/tick.fill), not Tailwind
// classes — centralized here so chart colors stay in sync with tailwind.config.js.
export const CHART = {
  gold: "#D1A92E", // primary/strategy series
  blue: "#7FB4FF", // secondary/benchmark series
  grid: "#29241B", // divider
  tickText: "#4C4739", // faint
} as const;
