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


def get_active_tenant_accounts(cfg: Config | None = None) -> list[dict[str, Any]]:
    """Retrieve all active registered user accounts with decrypted Alpaca credentials.

    Supports dual-account execution per user (both Paper and Real Money Live accounts).
    If no tenant accounts exist in user_settings, falls back to the server primary credentials.
    """
    if cfg is None:
        cfg = Config()

    tenants: list[dict[str, Any]] = []

    # 1. Fetch local SQLite tenant accounts
    if _DB_PATH.exists():
        try:
            conn = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
            conn.row_factory = sqlite3.Row
            rows = conn.execute("SELECT * FROM user_settings").fetchall()
            conn.close()

            for row in rows:
                data = dict(row)
                user_id = data.get("user_id")
                active_mode = data.get("trading_mode") or "paper"

                paper_key = decrypt_credential(data.get("alpaca_api_key_encrypted"))
                paper_secret = decrypt_credential(data.get("alpaca_api_secret_encrypted"))
                paper_base_url = data.get("alpaca_base_url") or cfg.alpaca_base_url

                live_key = decrypt_credential(data.get("alpaca_live_api_key_encrypted"))
                live_secret = decrypt_credential(data.get("alpaca_live_api_secret_encrypted"))
                live_base_url = "https://api.alpaca.markets"

                # Check Paper Account
                has_paper = bool(paper_key and paper_secret)
                # Check Live Account
                has_live = bool(live_key and live_secret)

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
        except Exception as exc:
            logger.warning("Error reading local user_settings.db: %s", exc)

    # 2. Fallback to primary server credentials if no tenant accounts configured
    if not tenants:
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

    return tenants


def execute_multi_tenant_job(
    job_name: str,
    job_fn: Callable[[dict[str, Any]], None],
    cfg: Config | None = None,
) -> dict[str, Any]:
    """Execute a background bot job across all active tenant accounts with fault isolation.

    Supports dual-account execution per user (both Paper and Real Money Live accounts).
    Ensures an exception in one user's account does not interrupt execution for other accounts.
    """
    tenants = get_active_tenant_accounts(cfg)
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
