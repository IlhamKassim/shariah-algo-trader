/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', "sans-serif"],
        mono: ['"IBM Plex Mono"', "monospace"],
      },
      colors: {
        page: "#0A0E13",
        sidebar: "#0B0F15",
        card: "#10161E",
        "card-hover": "#131B24",
        divider: "#161D26",
        "card-border": "#1B232D",
        primary: "#EAF0F5",
        muted: "#8B98A8",
        faint: "#5B6675",
        section: "#6B7785",
        "brand-green": "#34E3AE",
        "brand-red": "#FF8A94",
        "brand-gold": "#D8BE86",
        "brand-blue": "#7FB4FF",
      },
    },
  },
  plugins: [],
};
