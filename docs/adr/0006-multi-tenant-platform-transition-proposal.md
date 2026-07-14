# Proposal: Transitioning to a Multi-Tenant SaaS Platform

## Status
Proposed

## Context
The current codebase operates as a single-user quant trading bot. All configuration settings (such as broker API keys, rebalance cadence, sector caps, and whitelist emails) are read from a static global environment `.env` file and loaded via `config.py`. The background schedulers for the trading routines run as single systemd service loops on the server.

To transform this from a DIY terminal-based script into a user-friendly platform, we must support multiple users. Users should be able to sign up, securely input their own Alpaca broker credentials, choose their portfolio settings, and let the system run the strategy automatically in the background without any manual server deployment.

## Gaps in the Current System
1. **Single-Tenant Configurations:** The application reads values from a single global environment `.env` file (e.g. `ALPACA_API_KEY`).
2. **No Database Layer:** Watchlists, portfolio metrics, and rebalance states are kept in memory or stored as flat JSON/CSV cache files. There is no relational database to isolate user settings and trade records.
3. **Global Authentication:** The web console uses a single global `DASHBOARD_PASSWORD` or email whitelist from `.env`. It lacks individual user registration, login flows, and scoped access tokens.
4. **Static Scheduler Loop:** The service loops run continuously for a single account and cannot spawn dynamic parallel threads or target different broker endpoints for different users.

## Proposed Architecture & Design Decisions

```
[ React SPA Web Console ] 
           │ (JWT Authenticated REST API Calls)
           ▼
[ FastAPI API Gateway ]
           │
     ┌─────┴──────────┐
     ▼                ▼
[( PostgreSQL )]    [ Celery / Redis Job Queue ]
                      │ (Distributes tasks to worker pools)
                      ▼
                    [ Worker Execution Pool ] ──► [ Alpaca / FMP APIs ]
                      (Decrypts user keys & runs trades)
```

1. **Database Integration:** Implement a relational database (e.g. PostgreSQL) via SQLAlchemy. This database will store user profiles, portfolio histories, custom factor weights, and encrypted broker API keys.
2. **Token-Based Auth (JWT):** Replace the current password/email whitelist with a standard registration and sign-in flow that generates scoped JSON Web Tokens (JWT) for user sessions.
3. **Asynchronous Task Queue:** Introduce Celery and Redis to handle back-end execution. The scheduler will trigger tasks that query the database for all active users and enqueue parallel, user-scoped trading tasks.
4. **Platform Control Panel:** Expand the React web console to include a User Settings page where users can save their credentials, configure custom rebalance settings, and monitor their live vs. paper execution logs.
