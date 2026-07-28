/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
        serif: ['"Instrument Serif"', '"Newsreader"', '"Playfair Display"', "Georgia", "serif"],
        display: ['"Instrument Serif"', '"Newsreader"', '"Playfair Display"', "Georgia", "serif"],
        playfair: ['"Playfair Display"', "serif"],
        inter: ["Inter", "sans-serif"],
      },
      colors: {
        page: "#0C0B09",
        sidebar: "#0C0B09",
        card: "#0C0B09",
        "card-hover": "#141210",
        divider: "#29241B",
        "card-border": "#29241B",
        primary: "#ECE5D5",
        muted: "#8C8577",
        faint: "#4C4739",
        section: "#8C8577",
        "brand-green": "#5BA97C",
        "brand-red": "#D16A5B",
        "brand-gold": "#D1A92E",
        "brand-blue": "#7FB4FF",
      },
    },
  },
  plugins: [],
};
