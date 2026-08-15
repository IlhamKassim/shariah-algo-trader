/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        headline: ['"Noto Serif"', "serif"],
        display: ['"Noto Serif"', "serif"],
        label: ['"Noto Serif"', "serif"],
        serif: ['"Noto Serif"', "Georgia", "serif"],
        sans: ['"Inter"', '"Plus Jakarta Sans"', "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        body: ['"Inter"', '"Plus Jakarta Sans"', "sans-serif"],
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        // Structured Brutalism Surface tokens
        page: "#0A0A0A",
        surface: "#1A1918",
        "surface-container": "#1A1918",
        "surface-header": "#242322",
        "surface-elevated": "#2D2C2B",
        "border-grid": "#333333",
        "border-light": "#555555",

        // Primary branding & chart accents
        primary: "#3366CC",
        "primary-dark": "#094CB2",
        "primary-container": "#3366CC",
        "on-primary-container": "#E7EBFF",
        "primary-fixed": "#D9E2FF",

        // Secondary & neutral tokens
        secondary: "#5A5F63",
        "secondary-fixed-dim": "#C2C7CC",
        "secondary-container": "#DFE3E8",
        "inverse-surface": "#303031",
        "inverse-on-surface": "#F2F0F1",

        // Text tokens
        "text-primary": "#FFFFFF",
        "text-body": "#F2F0F1",
        "text-secondary": "#C2C7CC",
        "text-muted": "#737784",
        "text-faint": "#5A6E68",

        // Semantic status tokens
        "brand-green": "#10B981",
        "brand-emerald": "#10B981",
        "brand-amber": "#F59E0B",
        "brand-red": "#BA1A1A",
        "brand-rose": "#FB7185",
        "brand-gold": "#6D5E00",
        "tertiary": "#6D5E00",
        "tertiary-fixed": "#F9E37A",

        // Legacy compat aliases
        panel: "#1A1918",
        "panel-hover": "#242322",
        line: "#333333",
        lime: "#BEF264",
        "lime-deep": "#84CC16",
      },
      borderRadius: {
        DEFAULT: "0rem",
        none: "0rem",
        xs: "2px",
        sm: "2px",
        md: "4px",
        lg: "0rem",
        xl: "0rem",
        full: "9999px",
      },
      boxShadow: {
        panel: "none",
        brutalist: "2px 2px 0px 0px #333333",
      },
    },
  },
  plugins: [],
};
