# 🚀 Shariah Algo Trader — Project Concept & Platform Pitch

> **Executive Pitch**: *Shariah Algo Trader is the premier automated quantitative trading platform designed exclusively for Shariah-compliant equity investing — combining institutional 4-Factor multi-factor stock scoring (Momentum, Quality, Low Volatility, Value) with automated daily compliance guards, ultra-low fee turnover, and multi-broker execution across global markets (Alpaca, Moomoo, Webull).*

---

## 🎯 Executive Summary & Value Proposition

Traditional algorithmic trading platforms often rely on short selling, leverage, margin interest, or options strategies — all of which are strictly non-compliant under Islamic finance principles (AAOIFI standards).

**Shariah Algo Trader** bridges the gap between institutional quant trading and ethical finance by offering a **100% spot-only, unleveraged, factor-based trading platform**.

### Core Value Pillars

1. **Strict Shariah Guardrails (Non-Negotiable)**
   * **Long-Only Spot Equities**: No leverage, no margin loans, no short selling, no options, and no financial derivatives.
   * **Dynamic Eligible Universe**: Tradable stocks are dynamically synchronized with constituent holdings of certified Shariah ETFs (e.g. `SPUS`, `HLAL`).
   * **Automated Compliance Exit**: Daily open-market scans immediately liquidate any holding that drops out of the Shariah ETF universe.

2. **Institutional 4-Factor Quant Strategy**
   * Eliminates emotional stock-picking by scoring assets across four equal-weighted factor z-scores (25% each):
     * 📈 **Momentum Factor**: 12-month return minus 1-month short-term reversal.
     * 🛡️ **Quality Factor**: ROE, net profit margin, and financial health screening (debt/assets < 33%).
     * 📉 **Low Volatility Factor**: Evaluates volatility profiles to favor stable earnings.
     * 💎 **Value Factor**: Free Cash Flow (FCF) yield relative to market cap.
   * Holds a disciplined **top-20 stock Portfolio** with inverse-volatility weighting and sector concentration caps.

3. **Ultra-Low Fee Drag (Turnover Protection)**
   * Monthly rebalancing (1st trading day) + 3% drift thresholds + $25.00 notional limits prevent unnecessary micro-trading, holding fee drag to near **0.00%** on Alpaca and **<0.05%** on Moomoo Malaysia.

4. **Regional & Global Accessibility**
   * Dual support for US traders (via Alpaca) and Southeast Asian / Malaysian investors (via Moomoo OpenD Gateway and Webull).

---

## 🏛️ System Architecture

```
+-----------------------------------------------------------------------------------+
|                                 USER INTERFACE                                    |
|  • Public Editorial Site (shariahtrading.my)                                      |
|  • Institutional Console (app.shariahtrading.my - React 19 + TypeScript + Vite)    |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼ (HTTPS / REST)
+-----------------------------------------------------------------------------------+
|                              FASTAPI BACKEND API                                  |
|  • Security & Auth (Clerk JWT / Google OAuth2 / Password)                         |
|  • Rate Limiting & Hardening Middleware                                          |
|  • Real-Time Portfolio & Factor Telemetry                                        |
+-----------------------------------------------------------------------------------+
                     │                                   │
                     ▼                                   ▼
+------------------------------------+   +------------------------------------------+
|       QUANT STRATEGY ENGINE        |   |           STATETREE SCHEDULER            |
|  • ETF Snapshot Ingestion (SPUS)   |   |  • NYSE Trading Calendar                 |
|  • 4-Factor Scoring (NumPy/Pandas) |   |  • Daily Compliance Check (09:30 ET)     |
|  • Sector Cap & Inv-Vol Weighting  |   |  • Monthly Rebalance (1st Trading Day)   |
+------------------------------------+   +------------------------------------------+
                     │
                     ▼
+-----------------------------------------------------------------------------------+
|                             MULTI-BROKER ADAPTER LAYER                            |
|  • Alpaca API (US / Global Paper & Live)                                          |
|  • Moomoo OpenD Gateway (`moomoo-api` SDK - Malaysia / SG / HK / US)              |
|  • Webull OpenAPI Adapter                                                         |
+-----------------------------------------------------------------------------------+
```

---

## 👥 Target Audience & User Personas

1. **Ethical & Muslim Quant Investors**: High-net-worth individuals and retail investors seeking automated factor returns without compromising Shariah principles.
2. **Malaysian & Regional Investors**: Retail traders using regional brokers like Moomoo Malaysia or Webull SG to access US equities programmatically.
3. **Passive Family Offices & Wealth Managers**: Looking for low-maintenance, systematic equity allocation models with transparent fee reporting.

---

## 📖 Domain Glossary & Standardized Language

When referencing or extending this project, adhere strictly to standardized domain terminology:

| Approved Domain Term | Definition | *Avoid Terms* |
| :--- | :--- | :--- |
| **Factor Score** | Composite rank assigned to stocks via 4-factor z-scores (25% each). | *composite score, signal, ranking* |
| **Eligible Universe** | Tradable stock pool derived from ETF constituent snapshots (`SPUS`/`HLAL`). | *whitelist, stock list, universe* |
| **Portfolio** | Subset of exactly 20 stocks currently held by the bot. | *holdings, positions, basket* |
| **Compliance Check** | Daily process comparing held portfolio against the Eligible Universe. | *daily scan, screening run* |
| **Compliance Exit** | Forced immediate sale triggered when a stock leaves the Shariah ETF. | *forced sell, emergency exit, eviction* |
| **Rebalance** | Monthly event where factor scores are recalculated and portfolio re-weighted. | *refresh, update, reconcile, sync* |
| **Scheduler** | NYSE-calendar-aware job scheduler (APScheduler background worker). | *runner, task queue, daemon* |

---

## 🗺️ Product Roadmap & Future Stages

### Stage 1: Current Architecture (Single-User Production)
- [x] Complete 4-Factor scoring & monthly rebalancing engine.
- [x] Daily open-market Compliance Check with automatic Compliance Exits.
- [x] FastAPI REST backend + React/TypeScript pitch-black monospaced terminal UI.
- [x] Multi-auth (Password, Google OAuth2, Clerk JWT).
- [x] Fee Drag & Execution Drag Telemetry.

### Stage 2: Multi-Broker Driver Expansion
- [ ] Implement `MoomooOrderExecutor` adapter communicating with local `OpenD` daemon over TCP socket `127.0.0.1:11111`.
- [ ] Add `.env` broker selector (`BROKER_PROVIDER=alpaca|moomoo|webull`).
- [ ] Support multi-currency reporting (MYR, USD, SGD).

### Stage 3: Multi-Tenant Platform & Custom Factor Profiles (ADR-0006)
- [ ] Transition from single-user background process to multi-tenant SaaS.
- [ ] Custom factor weighting profiles (e.g. 50% Quality / 50% Low Volatility for conservative portfolios).
- [ ] Automated email/WhatsApp notifications for Compliance Exits and Rebalance executions.
