# 0007. Quantix Glassmorphism V2 UI & Feature Toggle Architecture

## Context and Problem Statement

The current dashboard user interface uses a warm dark brown palette (`#0C0B09`) with standard card layouts. To elevate the platform to a modern, high-contrast, institutional-grade quant trading aesthetic, we want to introduce a dark glassmorphism layout inspired by the Quantix AI design spec (deep slate background, translucent backdrop-blur containers, top market ticker bar, 3-card hero telemetry, and a dual-tabbed holdings/universe table).

However, introducing a sweeping visual redesign must not disrupt current production users, active trading operations, or existing auth flows.

## Decision Drivers

* **User Experience & Wow Factor**: Deliver a sleek, modern visual design with glassmorphism, sparklines, and clear telemetry.
* **Domain Feature Preservation**: Retain 100% of Shariah Algo Trader's core features (Shariah compliance checks, 4-Factor z-score rankings, Alpaca paper/live state, NYSE market status).
* **Safe Incremental Rollout**: Provide an opt-in toggle (`Try New Quantix Glass UI (Beta)`) so users can test the V2 dashboard seamlessly without losing access to V1.

## Considered Options

1. **Option 1: Complete In-Place Overwrite of V1 Components** (High risk, no fallback for users who prefer classic layout).
2. **Option 2 (Selected): Opt-In Dual UI Architecture (V1 Classic & V2 Glassmorphism)** with a `localStorage` feature toggle flag `shariah_ui_v2_enabled`.

## Decision Outcome

Chosen Option: **Option 2**.

### Key Architectural Implementation Details

1. **Feature Toggle State**:
   - Label: `Try New Quantix Glass UI (Beta)` (without emoji).
   - Stored in `localStorage.getItem("shariah_ui_v2_enabled")`.
   - Accessible from the Topbar and Settings page.

2. **Navigation & Layout (V2)**:
   - Grouped Sidebar: Overview, Strategy & Universe (Portfolio, Universe, Compare), Execution & Audit (Activity, Day Trader), Platform (Learn, Settings).

3. **Dashboard Header & Telemetry (V2)**:
   - Top Ticker Bar (`SPUS`, `HLAL`, `SPY`, `NYSE Status`, `Alpaca Environment`).
   - 3 Hero Glass Cards: Total Portfolio Value & Sparkline, Shariah Compliance Health & Daily Scan status, Top Factor Leader & z-score breakdown.

4. **Holdings & Universe Table (V2)**:
   - Dual-tabbed "Market Overview" component with instant search and sector filtering.

## Consequences

* **Positive**: Risk-free deployment; user feedback can be gathered on V2 while V1 remains fully functional.
* **Negative**: Temporary maintenance of two layout component trees until V1 is deprecated.
