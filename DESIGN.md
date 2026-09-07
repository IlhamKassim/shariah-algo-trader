# Shariah Algo Trader — Design System & Engineering Directives (`DESIGN.md`)

> **Single Source of Truth** for all frontend interfaces, modals, widgets, tables, cards, charts, and telemetry components across `shariahtrading.my`.

> [!IMPORTANT]
> **This repository is mid-migration between two design systems.**
>
> - **§A — Console (light).** The target system. Introduced by the Portfolio
>   Console (`/console`). All *new* surfaces are built here.
> - **§B — Terminal (obsidian).** The legacy system. Still governs the ~14
>   unmigrated pages (Overview, Portfolio, Universe, Compare, Activity,
>   Settings, Landing, Learn, Day Trader, Profile, Onboarding, Login, Invite,
>   Risk Disclosure). It remains **binding** for edits to those pages until
>   each is migrated.
>
> Do not mix the two inside a single page. Pick the system that owns the page
> you are editing.

---

# §A — Console (target system)

## A1. Visual Atmosphere & Philosophy

- **Style**: **Soft Editorial Fintech**. Light, airy, generous radii.
- **Tone**: Calm, legible, confident. Built for an operator reading positions at a glance rather than scanning a trading pit.
- **Density**: Medium (5/10). Whitespace is load-bearing — resist packing cards.
- **Geometry**: Generous rounding. Sheets `34px`, cards `26px`, inner panels `20px`, controls `999px` (full pill). No hairline grid.
- **Elevation**: Soft, low-opacity shadows (`0 1px 2px` → `0 8px 24px rgba(20,25,35,0.06–0.16)`). Never a border where a shadow will do.

## A2. Color Palette & Functional Tokens

Defined in `dashboard/web/src/index.css` under `.console-root`, so the legacy
pages are unaffected. Consume them as `bg-[var(--c-card)]`, never as raw hex.

| Token | Hex | Role |
| :--- | :--- | :--- |
| `--c-page` | `#DCE3EC` | Page ground — cool blue-gray. |
| `--c-sheet` | `#EFF1F5` | The lifted content sheet (rounded top, holds the card grid). |
| `--c-card` | `#FFFFFF` | Card surface. |
| `--c-soft` | `#F4F6F8` | Inset panel inside a card (metric rails, chat bubbles, input tracks). |
| `--c-line` | `#E3E7ED` | Row separators and dashed placeholders. Used sparingly. |
| `--c-ink` | `#15181D` | Primary text, active pill fill, logo mark. |
| `--c-mid` | `#5C6472` | Secondary text, labels, descriptions. |
| `--c-mute` | `#8B93A1` | Tertiary text, axis ticks, timestamps. |
| `--c-blue` | `#2563EB` | Primary action, strategy series, emphasis figures. |
| `--c-sky` | `#93C0F5` | Benchmark series, secondary plot strokes. |
| `--c-green` | `#1FA971` | Positive P&L, Buy signals, compliance passes. |
| `--c-red` | `#DE4A4F` | Negative P&L, Exit signals, risk. |
| `--c-amber` | `#F0BE43` | Watch signals, cash allocation. |
| `--c-violet` | `#7C5CFC` | Gradient partner to `--c-blue` on identity marks only. |

> **Rules**: Never pure black. White (`#FFFFFF`) is permitted here — it is the
> card surface. The blue→violet gradient is reserved for identity marks
> (avatar, Engine Signals glyph); it is never a background or a button fill.

## A3. Typographic Architecture

Two tiers. There is no serif tier in the Console system.

### Tier 1: Display (`.console-display`)
- **Stack**: `"Poppins", "Manrope", system-ui, sans-serif`
- **Usage**: Page title, total portfolio value, metric figures.
- **Style**: Light-to-regular (`300`–`500`), heavily track-tight (`-0.02em` to `-0.035em`). Large and calm — `66px/300` for the page title, `42px/400` for the headline value.

### Tier 2: Interface (`Manrope`, the `.console-root` default)
- **Stack**: `"Manrope", system-ui, sans-serif`
- **Usage**: Everything else — labels, body, buttons, table rows, signals.
- **Scale**: `11px` ticks · `12–12.5px` meta · `13–13.5px` body/controls · `16px` card titles · `19px` ticker figures.

### Numerals
- Every figure that can change gets `tabular-nums`. No exceptions — it is what stops the ticker strip and metric rail from jittering on refresh.
- There is **no monospace tier**. Tabular Manrope/Poppins replaces it.

## A4. Component Construction Rules

### A. Cards
- Shell: `bg-[var(--c-card)] rounded-[26px] p-[22px] flex flex-col gap-4`.
- Header: a 22px glyph + `16px/600` title, with optional right-aligned control.
- Glyphs are solid geometry (rounded square, circle, gradient dot) — **not** icon-library pictograms.

### B. Controls
- **Pill button**: `rounded-full`, `13.5px/500` (or `12.5px/500` small). Active state is `bg-[var(--c-card)]` + `600` weight + `0 1px 3px` shadow *inside* a `--c-card` track; inactive is transparent with `--c-mid` text.
- **Segmented control**: pills inside a `p-[5px] bg-[var(--c-card)] rounded-full` track.
- **Filter chip**: active `bg-[var(--c-ink)] text-white`, inactive `bg-[var(--c-soft)] text-[var(--c-mid)]`.
- **Primary CTA**: `bg-[var(--c-blue)] text-white rounded-full px-5 py-[11px] text-[12.5px]/600`.
- Every toggle carries `aria-pressed`. Every icon-only control carries `aria-label`.

### C. Lists (activity, signals)
- Rows separated by `border-b border-[var(--c-line)]`, with `last:border-b-0`. No zebra striping, no row borders on the outside.
- Leading token: a `34px` circle on `--c-soft` holding a 3-letter tag, coloured by semantic (`BUY`/`SELL`/`EXIT`/`RBL`).

### D. Charts
- Grid: horizontal only, `stroke=var(--c-line) strokeDasharray="3 3"`, `vertical={false}`.
- Axes: no axis line, no tick line, `11px` `--c-mute` labels.
- Strategy series: solid `#2563EB` 2px + top-down area gradient at `0.28 → 0` opacity.
- Benchmark series: `#8FB6EC` 2px `strokeDasharray="7 7"`, no dots.
- Tooltip: `--c-card`, `rounded-[14px]`, `0 8px 24px rgba(20,25,35,0.16)`, no border.

## A5. Motion & Interaction

Primitives live in `dashboard/web/src/components/console/controls.tsx`. Use
them rather than re-rolling a toggle or a range input per page.

| Primitive | Behaviour |
| :--- | :--- |
| `Segmented` | Selection indicator travels between options via a shared `layoutId`, so the pill slides rather than cross-fading. |
| `Toggle` | `role="switch"` with a spring-driven thumb. Colour carries meaning; the label always states what is being switched. |
| `Slider` | Range input with a live formatted value and a filled track. Never the only way to set a value that needs precision. |
| `Ticker` | Springs a number to its new value so a changed figure is noticed instead of silently swapping. |
| `SecretField` | Credentials reveal on **press-and-hold**, never a sticky toggle — it cannot be left switched on, and exposure takes a deliberate act. |
| `SaveBar` | Slides up only when a draft is dirty, states the change count, and offers discard beside save. |

### Rules

1. **Springs, not tweens**, for anything a finger conceptually throws — selection pills, toggle thumbs, counters. `stiffness: 420, damping: 34` is the house spring.
2. **Every animation is skipped** under `prefers-reduced-motion: reduce`. The primitives handle this; anything hand-rolled must too.
3. **Motion must survive being ignored.** A page that only makes sense once something has animated is broken for a reader who scrolled past it.
4. **Never animate a destructive path into being easy.** Irreversible actions — switching to live trading, replacing credentials — keep their confirmation step. Interaction polish belongs on the reversible parts.
5. **Show the consequence, not just the control.** Where a setting drives engine behaviour, recompute and display what the engine would actually do with it as the value changes (see the strategy panel in `Account.tsx`, which mirrors `factors/scorer.py`). A number the user cannot interpret is not a setting, it is a trap.

## A6. Banned Patterns

1. **NO sharp corners.** Nothing in the Console system is `rounded-none`.
2. **NO hairline borders as the primary separator.** Use shadow and surface contrast; reserve `--c-line` for row rules.
3. **NO monospace.** Use `tabular-nums`.
4. **NO gradient fills on surfaces or buttons.** The blue→violet gradient is for identity marks only.
5. **NO icon spam.** Solid geometric glyphs, one per card header.
6. **NO fabricated data.** See §C.

## A7. Verification Checklist

- [ ] Does every surface use a `--c-*` token rather than a raw hex?
- [ ] Do all changing figures carry `tabular-nums`?
- [ ] Are radii on the `20 / 26 / 34 / 999` scale?
- [ ] Do toggles carry `aria-pressed`, and icon-only controls `aria-label`?
- [ ] Does every displayed number trace to an API response? (§C)
- [ ] Does the page avoid `rounded-none`, `font-mono`, and gradient button fills?
- [ ] Does every interactive control come from `console/controls.tsx` rather than a one-off?
- [ ] Is every animation skipped under `prefers-reduced-motion`?
- [ ] Do irreversible actions still require a confirmation step?

---

# §B — Terminal (legacy system, still binding for unmigrated pages)

Retained verbatim as the governing spec for every page not yet on §A.

## B1. Atmosphere
Swiss Grid Financial Terminal meets Editorial Modernism. High-density cockpit (8/10). Strict sharp corners (`rounded-none`), hairline 1px borders (`#29241B`).

## B2. Palette

| Token | Hex | Role |
| :--- | :--- | :--- |
| `page` / `card` | `#0C0B09` | Deep obsidian matte background. |
| `sidebar` / `card-hover` | `#141210` | Secondary surface. |
| `divider` / `card-border` | `#29241B` | 1px hairline border. |
| `primary` | `#ECE5D5` | Warm off-white text. |
| `muted` | `#8C8577` | Secondary text. |
| `faint` | `#4C4739` | Placeholders, column labels. |
| `brand-gold` | `#D1A92E` | Primary CTAs, active badges. |
| `brand-green` | `#5BA97C` | Positive P&L, compliance passes. |
| `brand-red` | `#D16A5B` | Negative P&L, risk alerts. |
| `brand-blue` | `#7FB4FF` | System tags, tooltips. |

Never pure black or pure white. Never neon blue, electric purple, or cyan gradients. Never multi-coloured glowing outlines.

## B3. Typography
- **Serif** (`"Instrument Serif"`) — page titles, modal headers, hero headlines. Normal weight, track-tight.
- **Mono** (`"JetBrains Mono"`) — all currency, percentages, tickers, timestamps, table headers, badges. Tabular, `uppercase tracking-wider`.
- **Sans** (`"Plus Jakarta Sans"`) — body copy, form fields, tooltips, legal text.

## B4. Components
- **Modal backdrop**: `fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md`.
- **Modal container**: `bg-[#0C0B09] border border-divider rounded-none shadow-2xl max-w-lg w-full`.
- **Cards**: `Card`/`CardHeader`/`CardTitle`/`CardContent` from `@/components/ui/Card`; base `border border-divider bg-[#0C0B09] rounded-none`. Multi-stat rows use one parent card with `divide-divider`, not detached tiles.
- **Table headers**: `text-[10px] font-mono text-muted uppercase tracking-[0.09em] pb-3 border-b border-divider`.
- **Table rows**: `py-3.5 border-b border-divider font-mono text-xs text-primary`, hover `bg-[#141210]`.
- **Input**: `w-full bg-[#050807] border border-divider focus:border-brand-gold px-3.5 py-2.5 text-xs font-mono rounded-none`.
- **Confirm CTA**: `bg-brand-gold text-page font-bold px-6 py-2.5 font-mono text-xs uppercase tracking-widest rounded-none`.

## B5. Banned Patterns
No rounded pill cards (`rounded-2xl`/`3xl`/`full` on containers). No glowing gradient outlines. No bento icon spam. No pure white on pure black. No cards nested three deep. No fake sandbox placeholders.

---

# §C — Data Integrity (binding on **both** systems)

This is a live trading and Shariah-compliance surface. A plausible-looking
fake number here is not a placeholder; it is a false statement about
someone's money and their compliance position.

1. **Every figure rendered must trace to an API response.** No hardcoded
   holdings, no PRNG-generated series, no illustrative metrics.
2. **A design comp is not a data source.** When a comp shows a card the
   backend cannot feed, the card does not ship — or it ships as an explicit
   empty state naming what is missing. It never ships filled with invented
   values.
3. **Absent data reads as absent.** `—`, "No performance history yet", "Not
   tracked". Never a zero, never a dash that could be mistaken for a real
   value, never a stale cached figure presented as current.
4. **Derived values must state their derivation.** The Console's Engine
   Signals are computed from `/api/universe` rank + `/api/portfolio` holdings
   + `/api/compliance` violations, and each row names the rank and cut line
   it came from.
5. **Demo mode is the sole exception**, and it is fenced: mock payloads live
   behind `isDemo()` in `src/lib/api.ts` and the UI must display the `DEMO
   MODE` badge whenever they are active.
6. **Marketing copy is not a feature inventory.** Claims on the Landing page
   (e.g. dividend purification) do not license a console widget until a real
   endpoint backs them.
