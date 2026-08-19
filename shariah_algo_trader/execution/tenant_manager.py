"""Centralized Tenant Discovery & Multi-Tenant SaaS Execution Engine.

Provides secure multi-tenant isolation, dual-account discovery (Paper + Real Money Live),
and fault-tolerant job dispatching for all background trading bot engines.
"""

import datetime
import logging
import sqlite3
from typing import Any, Callable

from dashboard.api.crypto import decrypt_credential
from dashboard.api.db import insert_notification, log_audit_event
from dashboard.api.user_store import _DB_PATH, _fetch_from_supabase
from shariah_algo_trader.config import Config
from shariah_algo_trader.execution.alpaca_client import AlpacaClient
from shariah_algo_trader.execution.order_executor import OrderExecutor

logger = logging.getLogger(__name__)


def get_active_tenant_accounts(
    cfg: Config | None = None,
    engine: str = "all",
) -> list[dict[str, Any]]:
    """Retrieve active registered accounts with decrypted Alpaca credentials.

    For 'day_trader': Operates strictly in benchmark mode using server primary credentials.
        Day trading NEVER accesses or executes trades on user account API keys.
    For 'shariah_trader' / 'all': Loads active user accounts for long-term factor rebalancing.
    """
    if cfg is None:
        cfg = Config()

    tenants: list[dict[str, Any]] = []

    # 1. Day Trader Benchmark Engine: Strict isolation to server_primary credentials only
    if engine == "day_trader":
        # Accept both the main Config (alpaca_api_key) and DayTraderConfig (api_key)
        api_key = getattr(cfg, "alpaca_api_key", None) or getattr(cfg, "api_key", None)
        api_secret = getattr(cfg, "alpaca_api_secret", None) or getattr(cfg, "api_secret", None)
        base_url = getattr(cfg, "alpaca_base_url", None) or getattr(cfg, "base_url", None) or ""
        if api_key and api_secret:
            tenants.append({
                "user_id": "server_primary",
                "raw_user_id": "server_primary",
                "trading_mode": "paper" if "paper" in base_url else "live",
                "alpaca_api_key": api_key,
                "alpaca_api_secret": api_secret,
                "alpaca_base_url": base_url,
                "etf_symbol": "SPUS",
                "top_n": getattr(cfg, "top_n", 20),
                "sector_cap": getattr(cfg, "sector_cap", 0.25),
                "drift_threshold": getattr(cfg, "drift_threshold", 0.05),
            })
        return tenants

    # 2. Shariah Long-Term Algo Trader: Fetch user accounts from user_settings.db
    db_read_ok = True
    if _DB_PATH.exists():
        db_read_ok = False
        try:
            conn = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
            conn.row_factory = sqlite3.Row
            rows = conn.execute("SELECT * FROM user_settings").fetchall()
            # Pilot roles (G4): read once on the same connection. Tester rows
            # are paper-only even if their stored trading_mode says otherwise.
            pilot_roles: dict[str, str] = {}
            try:
                for pr in conn.execute("SELECT user_id, role FROM pilot_users").fetchall():
                    pilot_roles[pr["user_id"]] = pr["role"]
            except sqlite3.Error:
                pass  # pre-pilot DB without the pilot_users table
            conn.close()
            db_read_ok = True

            for row in rows:
                try:
                    data = dict(row)
                    user_id = data.get("user_id")
                    active_mode = data.get("trading_mode") or "paper"

                    shariah_enabled = bool(data.get("shariah_trader_enabled") if data.get("shariah_trader_enabled") is not None else 1)
                    if not shariah_enabled:
                        continue

                    paper_key = decrypt_credential(data.get("alpaca_api_key_encrypted"))
                    paper_secret = decrypt_credential(data.get("alpaca_api_secret_encrypted"))
                    paper_base_url = "https://paper-api.alpaca.markets"

                    live_key = decrypt_credential(data.get("alpaca_live_api_key_encrypted"))
                    live_secret = decrypt_credential(data.get("alpaca_live_api_secret_encrypted"))
                    live_base_url = "https://api.alpaca.markets"

                    # Check Paper Account
                    has_paper = bool(paper_key and paper_secret)
                    # Check Live Account
                    has_live = bool(live_key and live_secret)

                    # G4/G6 (paper-only invariant): a tester-role row is
                    # paper-only — never enter the live/both branches regardless
                    # of the stored trading_mode; live keys present in the DB
                    # are a guardrail violation that is logged and suppressed.
                    # Checked first (and independent of risk-ack below) so its
                    # own log line always fires for tester rows regardless of
                    # risk_acknowledged_at — testers never get a live entry
                    # either way, for this reason specifically.
                    if pilot_roles.get(user_id or "") == "tester":
                        if has_live:
                            logger.warning(
                                "PAPER_ONLY_GUARD: tester user %s has live credentials in user_settings — live tenant entry suppressed.",
                                user_id,
                            )
                        if has_paper:
                            tenants.append({
                                "user_id": f"{user_id} (Paper)",
                                "raw_user_id": user_id,
                                "trading_mode": "paper",
                                "alpaca_api_key": paper_key,
                                "alpaca_api_secret": paper_secret,
                                "alpaca_base_url": paper_base_url,
                                "etf_symbol": data.get("etf_symbol") or "SPUS",
                                "top_n": int(data.get("top_n") or cfg.top_n),
                                "sector_cap": float(data.get("sector_cap") or cfg.sector_cap),
                                "drift_threshold": float(data.get("drift_threshold") or cfg.drift_threshold),
                            })
                        continue

                    # Server-side risk-acknowledgment gate: a live tenant entry
                    # must never be spawned for an account that has not recorded
                    # risk_acknowledged_at, regardless of role or what
                    # trading_mode is stored — the API's write-path check
                    # (routers/settings.py) is defense-in-depth, not the only
                    # enforcement point.
                    risk_acknowledged = bool(data.get("risk_acknowledged_at"))
                    if has_live and not risk_acknowledged:
                        logger.warning(
                            "RISK_ACK_GUARD: user %s has live credentials but no "
                            "risk_acknowledged_at — live tenant entry suppressed.",
                            user_id,
                        )
                        has_live = False

                    # Determine tenant account targets
                    if active_mode == "live":
                        # Primary live execution requested
                        if has_live:
                            tenants.append({
                                "user_id": f"{user_id} (Live)",
                                "raw_user_id": user_id,
                                "trading_mode": "live",
                                "alpaca_api_key": live_key,
                                "alpaca_api_secret": live_secret,
                                "alpaca_base_url": live_base_url,
                                "etf_symbol": data.get("etf_symbol") or "SPUS",
                                "top_n": int(data.get("top_n") or cfg.top_n),
                                "sector_cap": float(data.get("sector_cap") or cfg.sector_cap),
                                "drift_threshold": float(data.get("drift_threshold") or cfg.drift_threshold),
                            })
                        # Also include paper testing account if configured
                        if has_paper:
                            tenants.append({
                                "user_id": f"{user_id} (Paper)",
                                "raw_user_id": user_id,
                                "trading_mode": "paper",
                                "alpaca_api_key": paper_key,
                                "alpaca_api_secret": paper_secret,
                                "alpaca_base_url": paper_base_url,
                                "etf_symbol": data.get("etf_symbol") or "SPUS",
                                "top_n": int(data.get("top_n") or cfg.top_n),
                                "sector_cap": float(data.get("sector_cap") or cfg.sector_cap),
                                "drift_threshold": float(data.get("drift_threshold") or cfg.drift_threshold),
                            })
                    elif active_mode == "both":
                        # Explicit dual execution mode requested
                        if has_live:
                            tenants.append({
                                "user_id": f"{user_id} (Live)",
                                "raw_user_id": user_id,
                                "trading_mode": "live",
                                "alpaca_api_key": live_key,
                                "alpaca_api_secret": live_secret,
                                "alpaca_base_url": live_base_url,
                                "etf_symbol": data.get("etf_symbol") or "SPUS",
                                "top_n": int(data.get("top_n") or cfg.top_n),
                                "sector_cap": float(data.get("sector_cap") or cfg.sector_cap),
                                "drift_threshold": float(data.get("drift_threshold") or cfg.drift_threshold),
                            })
                        if has_paper:
                            tenants.append({
                                "user_id": f"{user_id} (Paper)",
                                "raw_user_id": user_id,
                                "trading_mode": "paper",
                                "alpaca_api_key": paper_key,
                                "alpaca_api_secret": paper_secret,
                                "alpaca_base_url": paper_base_url,
                                "etf_symbol": data.get("etf_symbol") or "SPUS",
                                "top_n": int(data.get("top_n") or cfg.top_n),
                                "sector_cap": float(data.get("sector_cap") or cfg.sector_cap),
                                "drift_threshold": float(data.get("drift_threshold") or cfg.drift_threshold),
                            })
                    else:
                        # Default paper mode
                        if has_paper:
                            tenants.append({
                                "user_id": f"{user_id} (Paper)",
                                "raw_user_id": user_id,
                                "trading_mode": "paper",
                                "alpaca_api_key": paper_key,
                                "alpaca_api_secret": paper_secret,
                                "alpaca_base_url": paper_base_url,
                                "etf_symbol": data.get("etf_symbol") or "SPUS",
                                "top_n": int(data.get("top_n") or cfg.top_n),
                                "sector_cap": float(data.get("sector_cap") or cfg.sector_cap),
                                "drift_threshold": float(data.get("drift_threshold") or cfg.drift_threshold),
                            })
                        elif has_live:
                            # Fallback to live if only live credentials exist
                            tenants.append({
                                "user_id": f"{user_id} (Live)",
                                "raw_user_id": user_id,
                                "trading_mode": "live",
                                "alpaca_api_key": live_key,
                                "alpaca_api_secret": live_secret,
                                "alpaca_base_url": live_base_url,
                                "etf_symbol": data.get("etf_symbol") or "SPUS",
                                "top_n": int(data.get("top_n") or cfg.top_n),
                                "sector_cap": float(data.get("sector_cap") or cfg.sector_cap),
                                "drift_threshold": float(data.get("drift_threshold") or cfg.drift_threshold),
                            })
                except Exception as row_exc:
                    logger.error(
                        "Skipping tenant row due to error (user_id=%s): %s",
                        dict(row).get("user_id", "?"), row_exc, exc_info=True,
                    )
                    continue
        except Exception as exc:
            logger.warning("Error reading local user_settings.db: %s", exc)

    # 3. Fallback to primary server credentials, but only when the tenant DB was
    # legitimately empty (or absent) — never when the read itself failed, since
    # that could silently route trades meant for user accounts onto the server's
    # own credentials.
    if not tenants and db_read_ok:
        if cfg.alpaca_api_key and cfg.alpaca_api_secret:
            logger.info("No tenant accounts in user_settings — using server primary credentials fallback.")
            tenants.append({
                "user_id": "server_primary",
                "raw_user_id": "server_primary",
                "trading_mode": "paper" if "paper" in cfg.alpaca_base_url else "live",
                "alpaca_api_key": cfg.alpaca_api_key,
                "alpaca_api_secret": cfg.alpaca_api_secret,
                "alpaca_base_url": cfg.alpaca_base_url,
                "etf_symbol": "SPUS",
                "top_n": cfg.top_n,
                "sector_cap": cfg.sector_cap,
                "drift_threshold": cfg.drift_threshold,
            })
    elif not tenants and not db_read_ok:
        logger.error(
            "Tenant discovery skipped: user_settings.db read failed — "
            "refusing to fall back to server primary credentials this cycle."
        )

    return tenants


def execute_multi_tenant_job(
    job_name: str,
    job_fn: Callable[[dict[str, Any]], None],
    cfg: Config | None = None,
    engine: str = "all",
) -> dict[str, Any]:
    """Execute a background bot job across all active tenant accounts with fault isolation.

    Supports dual-account execution per user (both Paper and Real Money Live accounts).
    Ensures an exception in one user's account does not interrupt execution for other accounts.
    """
    tenants = get_active_tenant_accounts(cfg, engine=engine)
    summary = {
        "job_name": job_name,
        "total_tenants": len(tenants),
        "successful_tenants": 0,
        "failed_tenants": 0,
        "tenant_results": {},
        "executed_at": datetime.datetime.now(tz=datetime.timezone.utc).isoformat(),
    }

    logger.info("Dispatching multi-tenant job '%s' across %d active account(s)...", job_name, len(tenants))

    for tenant in tenants:
        user_id = tenant["user_id"]
        raw_user_id = tenant.get("raw_user_id", user_id)
        try:
            job_fn(tenant)
            summary["successful_tenants"] += 1
            summary["tenant_results"][user_id] = "SUCCESS"
            log_audit_event(
                event_type=f"multi_tenant_job_{job_name}",
                actor=raw_user_id,
                ip_address="system",
                details=f"Job {job_name} completed successfully for tenant {user_id} (mode={tenant['trading_mode']}).",
            )
        except Exception as exc:
            summary["failed_tenants"] += 1
            summary["tenant_results"][user_id] = f"FAILED: {exc}"
            logger.error("Job '%s' failed for tenant '%s': %s", job_name, user_id, exc, exc_info=True)
            log_audit_event(
                event_type=f"multi_tenant_job_{job_name}_error",
                actor=raw_user_id,
                ip_address="system",
                details=f"Job {job_name} failed for tenant {user_id}: {exc}",
            )
            # Notify user in-app
            try:
                insert_notification(
                    id=f"job-error-{raw_user_id[:8]}-{job_name}-{int(datetime.datetime.now().timestamp())}",
                    source="system",
                    category="critical",
                    severity="critical",
                    title=f"Automated {job_name.replace('_', ' ').title()} Error ({tenant['trading_mode'].upper()})",
                    body=f"Automated trading execution on your {tenant['trading_mode'].upper()} account encountered an error: {exc}",
                    created_at=datetime.datetime.now(tz=datetime.timezone.utc).isoformat(),
                )
            except Exception:
                pass

    logger.info(
        "Multi-tenant job '%s' finished — %d/%d accounts succeeded.",
        job_name, summary["successful_tenants"], len(tenants),
    )
    return summary


def trigger_single_tenant_rebalance(
    user_id: str,
    cfg: Config | None = None,
    progress_callback: "Callable[[str, int], None] | None" = None,
) -> dict[str, Any]:
    """Instantly execute a manual portfolio allocation/rebalance for a single authenticated user.

    Args:
        user_id: The authenticated user to rebalance for.
        cfg: Optional Config override.
        progress_callback: Optional callable(step_key: str, step_number: int) invoked before
            each major computation step so callers can track live progress.
    """
    from shariah_algo_trader.data.regime import is_bull_market
    from shariah_algo_trader.data.universe import fetch_combined_universe
    from shariah_algo_trader.execution.portfolio import get_current_portfolio
    from shariah_algo_trader.factors.momentum import compute_momentum_factor
    from shariah_algo_trader.factors.quality import compute_quality_factor
    from shariah_algo_trader.factors.scorer import rank_by_factor_score
    from shariah_algo_trader.factors.value import compute_value_factor
    from shariah_algo_trader.factors.volatility import (
        compute_inv_vol_weights,
        compute_raw_volatility,
        compute_volatility_factor,
    )
    from shariah_algo_trader.jobs.rebalance import run_rebalance

    def _emit(step_key: str, step_number: int) -> None:
        if progress_callback is not None:
            progress_callback(step_key, step_number)

    if cfg is None:
        cfg = Config()

    tenants = get_active_tenant_accounts(cfg)
    matching_tenants = [t for t in tenants if t.get("raw_user_id") == user_id or t.get("user_id") == user_id]

    if not matching_tenants:
        raise ValueError(f"No active trading credentials configured for user '{user_id}'")

    # Compute universe & factor scores ONCE for all account targets
    first_tenant = matching_tenants[0]
    etf_symbols = [first_tenant["etf_symbol"]] if isinstance(first_tenant["etf_symbol"], str) else list(first_tenant["etf_symbol"])

    _emit("universe", 1)
    universe = fetch_combined_universe(etf_symbols)

    _emit("momentum", 2)
    momentum = compute_momentum_factor(universe)

    _emit("quality", 3)
    quality = compute_quality_factor(universe)

    _emit("volatility", 4)
    raw_vols = compute_raw_volatility(universe)
    vol_scores = compute_volatility_factor(raw_vols)
    value = compute_value_factor(universe)

    _emit("ranking", 5)
    regime_ok = is_bull_market()

    results = []

    for tenant in matching_tenants:
        trading_mode = tenant["trading_mode"]
        client = AlpacaClient(
            api_key=tenant["alpaca_api_key"],
            api_secret=tenant["alpaca_api_secret"],
            base_url=tenant["alpaca_base_url"],
        )
        executor = OrderExecutor(client)

        target = rank_by_factor_score(
            momentum, quality, vol_scores, value,
            top_n=tenant["top_n"],
            sector_cap=tenant["sector_cap"],
        )
        weights = compute_inv_vol_weights(target, raw_vols)

        def _get_positions() -> dict[str, float]:
            positions = client.get("/v2/positions")
            return {p["symbol"]: float(p["market_value"]) for p in positions}

        _emit("orders", 6)
        diff_summary = run_rebalance(
            get_portfolio=lambda: get_current_portfolio(client),
            get_positions=_get_positions,
            fetch_universe=lambda: universe,
            get_target_portfolio=lambda: target,
            get_target_weights=lambda: weights,
            executor=executor,
            regime_ok=regime_ok,
        )
        _emit("done", 7)

        log_audit_event(
            event_type="manual_rebalance_triggered",
            actor=user_id,
            ip_address="user",
            details=f"Manual rebalance executed on {trading_mode.upper()} account. Target stocks: {target}",
        )

        results.append({
            "trading_mode": trading_mode,
            "target_stocks": target,
            "diff_summary": diff_summary,
        })

    return {
        "user_id": user_id,
        "rebalance_submitted": True,
        "accounts_processed": len(results),
        "results": results,
        "executed_at": datetime.datetime.now(tz=datetime.timezone.utc).isoformat(),
    }

