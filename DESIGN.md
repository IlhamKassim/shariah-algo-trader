# Shariah Algo Trader — Design System & Engineering Directives (`DESIGN.md`)

> **Single Source of Truth** for all frontend interfaces, modals, widgets, tables, cards, charts, and telemetry components across `shariahtrading.my`.

---

## 1. Visual Atmosphere & Philosophy

- **Style**: **Swiss Grid Financial Terminal** meets **Editorial Modernism**.
- **Tone**: Institutional, rigorous, calm, high-conviction. Built for quant operators, private wealth managers, and Shariah investment committees.
- **Density**: High-density Cockpit (Level 8/10). Maximum information clarity with minimal decoration.
- **Geometry**: Strict sharp corners (`rounded-none`). Hairline 1px borders (`#29241B`). No bubbly rounded cards or pill containers.

---

## 2. Color Palette & Functional Tokens

| Token | Hex Code | Role / Usage |
| :--- | :--- | :--- |
| `page` / `card` | `#0C0B09` | Deep obsidian matte background for pages, cards, and modals. |
| `sidebar` / `card-hover` | `#141210` | Subtle elevation and secondary surface container. |
| `divider` / `card-border` | `#29241B` | 1px hairline border separating cards, table rows, and grid cells. |
| `primary` | `#ECE5D5` | High-contrast warm off-white for headlines, active values, and primary body. |
| `muted` | `#8C8577` | Neutral taupe-gray for secondary text, descriptions, and inactive states. |
| `faint` | `#4C4739` | Dark muted tone for placeholders, table column labels, and hints. |
| `brand-gold` | `#D1A92E` | Warm institutional gold accent for primary CTAs, active badges, and highlights. |
| `brand-green` | `#5BA97C` | Muted sage/emerald for positive P&L (+%), compliance passes, and live telemetry. |
| `brand-red` | `#D16A5B` | Terracotta red for negative P&L (-%), risk alerts, and errors. |
| `brand-blue` | `#7FB4FF` | Soft terminal blue for system tags, synchronizations, and tooltips. |

> [!IMPORTANT]
> **Strict Color Rules**:
> - Never use pure black (`#000000`) or pure white (`#FFFFFF`).
> - Never use neon blues, electric purples, or cyan gradients.
> - Never use multi-colored glowing border outlines.

---

## 3. Typographic Architecture

The design system uses a strict **3-tier typographic pairing**:

### Tier 1: Modern Editorial Serif (Display / Hero / Modal Titles)
- **Font Stack**: `"Instrument Serif", "Newsreader", "Playfair Display", Georgia, serif`
- **Class**: `font-serif`
- **Usage**: Main page titles, modal headers, marketing hero headlines.
- **Style**: Elegant, normal weight (`font-normal`), track-tight, italic accents for brand emphasis (e.g. `SHARIAH<span className="italic text-brand-gold">TRADING</span>`).

### Tier 2: Monospace Telemetry (Numbers, Tickers, Metrics, Badges)
- **Font Stack**: `"JetBrains Mono", "IBM Plex Mono", "SFMono-Regular", monospace`
- **Class**: `font-mono`
- **Usage**: ALL dollar values (`$100,000.00`), percentages (`+2.45%`), ticker symbols (`SPUS`, `HLAL`), timestamps, table headers, and badges.
- **Style**: Tabular figures, uppercase tracking (`uppercase tracking-wider` or `tracking-widest`).

### Tier 3: Clean Functional Sans (Body & Forms)
- **Font Stack**: `"Plus Jakarta Sans", "Inter", -apple-system, sans-serif`
- **Class**: `font-sans`
- **Usage**: Body copy, descriptions, input form fields, tooltips, and legal text.

---

## 4. Component Construction Rules

### A. Modals & Overlays
1. **Backdrop**: `fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md`
2. **Container**: `bg-[#0C0B09] border border-divider rounded-none shadow-2xl max-w-lg w-full text-primary font-sans relative`
3. **Header**:
   - Monospace eyebrow badge with pulse square or bullet (`<span className="w-1.5 h-1.5 bg-brand-gold" />`).
   - Title in `font-serif text-2xl text-primary font-normal`.
   - Subtitle in `font-sans text-xs text-muted leading-relaxed`.
4. **Metric Cells**: Multi-cell split grid with `border border-divider divide-x divide-divider bg-[#141210]`.
5. **Footer Actions**:
   - Cancel: `border border-divider hover:border-muted text-muted hover:text-primary px-5 py-2.5 font-mono text-xs uppercase tracking-widest rounded-none`.
   - Confirm: `bg-brand-gold hover:bg-brand-gold/90 text-page font-bold px-6 py-2.5 font-mono text-xs uppercase tracking-widest rounded-none`.

### B. Cards & Metric Tiles
- Use `Card`, `CardHeader`, `CardTitle`, `CardContent` from `@/components/ui/Card`.
- Base classes: `border border-divider bg-[#0C0B09] rounded-none`.
- For multi-stat rows: use a single parent card with `grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-divider` rather than multiple detached floating pill cards.

### C. Tables & Holdings Lists
- Column headers: `text-[10px] font-mono text-muted uppercase tracking-[0.09em] pb-3 border-b border-divider`.
- Row cells: `py-3.5 border-b border-divider font-mono text-xs text-primary`.
- Hover state: `hover:bg-[#141210] transition-colors`.

### D. Form Inputs & Selects
- Label: `text-[10px] font-mono text-brand-gold uppercase tracking-widest block mb-1.5`.
- Input field: `w-full bg-[#050807] border border-divider focus:border-brand-gold px-3.5 py-2.5 text-xs font-mono text-primary placeholder-faint focus:outline-none rounded-none transition-colors`.

---

## 5. Banned AI Clichés (Anti-Patterns)

1. **NO Bubbly Rounded Pill Cards**: Ban `rounded-2xl`, `rounded-3xl`, or `rounded-full` containers on cards and modals.
2. **NO Colored Glowing Borders**: Ban neon cyan/purple/pink glowing gradient outlines (`shadow-[0_0_30px_rgba(...)]`).
3. **NO Bento Box Icon Spam**: Do not stuff random disconnected icons into every corner of every box.
4. **NO Pure White on Pure Black**: Maintain `#ECE5D5` off-white text against `#0C0B09` obsidian surfaces.
5. **NO Multi-Nested Cards Inside Cards**: Use hairline dividers (`divide-divider`) and grid cells instead of nesting 3 layers of cards.
6. **NO Fake Sandbox / Simulated Tier Placeholders**: Connect real Alpaca Paper API keys and real data endpoints.

---

## 6. Verification Checklist for New Widgets

- [ ] Does the widget use `rounded-none` for sharp terminal geometry?
- [ ] Are numbers and metrics formatted with `font-mono`?
- [ ] Are headlines styled with `font-serif` or track-tight institutional uppercase?
- [ ] Are borders hairline `border-divider` (`#29241B`)?
- [ ] Are CTA buttons styled with `bg-brand-gold text-page font-mono text-xs uppercase tracking-widest`?
- [ ] Does the component avoid gradient glows, neon colors, and rounded pills?
