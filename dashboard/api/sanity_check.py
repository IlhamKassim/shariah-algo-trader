"""End-of-Market Performance Sanity Check module.

Audits paper trading portfolio performance against SPUS (Shariah ETF) and
S&P 500 (SPY) benchmarks to detect unrealistic return jumps, anomalous alpha drift,
or data synchronization discrepancies.
"""

import datetime
import logging
import pandas as pd
from typing import Any

from dashboard.api.db import insert_notification, log_audit_event
from dashboard.api.deps import get_config
from dashboard.api.live_equity import live_equity, patch_today
from dashboard.api.routers.performance import _fetch_benchmark, _to_cumulative
from dashboard.api.user_store import get_user_settings
from shariah_algo_trader.config import Config
from shariah_algo_trader.execution.alpaca_client import AlpacaClient, AlpacaError

logger = logging.getLogger(__name__)

# Realistic bounds thresholds
MAX_DAILY_RETURN_THRESHOLD = 0.035  # ±3.5% single-day jump
MAX_DAILY_ALPHA_DRIFT_THRESHOLD = 0.030  # ±3.0% single-day divergence vs SPUS


def run_performance_sanity_check(
    user_id: str,
    cfg: Config | None = None,
) -> dict[str, Any]:
    """Perform end-of-market sanity audit on a user's paper trading account performance.

    Returns a detailed dict containing sanity status, returns, alpha drift, and anomalies.
    """
    if cfg is None:
        cfg = get_config()

    user_settings = get_user_settings(user_id)
    if not user_settings:
        log_audit_event(
            event_type="performance_sanity_check",
            actor=user_id,
            ip_address="system",
            details="Status: NO_SETTINGS | Realistic: True",
        )
        return {
            "user_id": user_id,
            "status": "NO_SETTINGS",
            "is_realistic": True,
            "message": "User settings not found.",
            "checked_at": datetime.datetime.now(tz=datetime.timezone.utc).isoformat(),
        }

    trading_mode = user_settings.get("trading_mode", "paper")
    api_key = user_settings.get("alpaca_api_key")
    api_secret = user_settings.get("alpaca_api_secret")
    base_url = user_settings.get("alpaca_base_url") or cfg.alpaca_base_url

    if not api_key or not api_secret:
        log_audit_event(
            event_type="performance_sanity_check",
            actor=user_id,
            ip_address="system",
            details=f"Status: UNCONFIGURED | Realistic: True | Mode: {trading_mode}",
        )
        return {
            "user_id": user_id,
            "status": "UNCONFIGURED",
            "is_realistic": True,
            "message": "Alpaca credentials not configured for user.",
            "checked_at": datetime.datetime.now(tz=datetime.timezone.utc).isoformat(),
        }

    client = AlpacaClient(api_key, api_secret, base_url)

    try:
        history = client.get("/v2/account/portfolio/history?period=1M&timeframe=1D")
        timestamps = history.get("timestamp", [])
        equities = history.get("equity", [])
    except AlpacaError as exc:
        if "404" in str(exc):
            log_audit_event(
                event_type="performance_sanity_check",
                actor=user_id,
                ip_address="system",
                details=f"Status: EMPTY_HISTORY | Realistic: True",
            )
            return {
                "user_id": user_id,
                "status": "EMPTY_HISTORY",
                "is_realistic": True,
                "trading_mode": trading_mode,
                "anomalies": [],
                "message": "New account with no historical equity points yet.",
                "checked_at": datetime.datetime.now(tz=datetime.timezone.utc).isoformat(),
            }
        logger.error("Sanity check failed to fetch Alpaca history for %s: %s", user_id, exc)
        return {
            "user_id": user_id,
            "status": "ALPACA_ERROR",
            "is_realistic": False,
            "message": f"Failed to fetch portfolio history from Alpaca: {exc}",
            "checked_at": datetime.datetime.now(tz=datetime.timezone.utc).isoformat(),
        }

    if not timestamps or not equities:
        log_audit_event(
            event_type="performance_sanity_check",
            actor=user_id,
            ip_address="system",
            details=f"Status: EMPTY_HISTORY | Realistic: True",
        )
        return {
            "user_id": user_id,
            "status": "EMPTY_HISTORY",
            "is_realistic": True,
            "message": "Portfolio history contains no data points yet.",
            "checked_at": datetime.datetime.now(tz=datetime.timezone.utc).isoformat(),
        }

    dates = [datetime.date.fromtimestamp(ts).isoformat() for ts in timestamps]
    equities_f = [float(e) if e is not None else float("nan") for e in equities]

    try:
        dates, equities_f = patch_today(dates, equities_f, live_equity(client))
    except Exception as exc:
        logger.warning("Could not patch today's live equity: %s", exc)

    equity_series = pd.Series(equities_f, index=pd.to_datetime(dates)).dropna()
    equity_series = equity_series[equity_series > 0]

    if len(equity_series) < 2:
        return {
            "user_id": user_id,
            "status": "INSUFFICIENT_DATA",
            "is_realistic": True,
            "message": "Fewer than 2 historical equity points.",
            "checked_at": datetime.datetime.now(tz=datetime.timezone.utc).isoformat(),
        }

    port_returns = equity_series.pct_change().fillna(0)
    port_cumulative = ((1 + port_returns).cumprod() - 1).round(6).tolist()

    start_date = equity_series.index[0].date()
    end_date = equity_series.index[-1].date()

    # Fetch benchmarks
    spus_close = _fetch_benchmark("SPUS", start_date, end_date)
    sp500_close = _fetch_benchmark("SPY", start_date, end_date)

    spus_cum = _to_cumulative(spus_close, equity_series.index)
    sp500_cum = _to_cumulative(sp500_close, equity_series.index)

    # 1-day returns
    latest_strategy_daily_return = float(port_returns.iloc[-1])
    
    # Estimate SPUS daily return if benchmark series exists
    if not spus_close.empty and len(spus_close) >= 2:
        spus_daily_return = float(spus_close.pct_change().dropna().iloc[-1])
    else:
        spus_daily_return = 0.0

    if not sp500_close.empty and len(sp500_close) >= 2:
        sp500_daily_return = float(sp500_close.pct_change().dropna().iloc[-1])
    else:
        sp500_daily_return = 0.0

    daily_alpha_drift = latest_strategy_daily_return - spus_daily_return

    latest_strategy_cum = port_cumulative[-1]
    latest_spus_cum = spus_cum[-1] if spus_cum else 0.0
    latest_sp500_cum = sp500_cum[-1] if sp500_cum else 0.0
    total_alpha = latest_strategy_cum - latest_spus_cum

    # Sanity checks
    anomalies = []
    if abs(latest_strategy_daily_return) > MAX_DAILY_RETURN_THRESHOLD:
        anomalies.append(
            f"Daily strategy return ({latest_strategy_daily_return * 100:+.2f}%) "
            f"exceeded threshold (±{MAX_DAILY_RETURN_THRESHOLD * 100:.1f}%)."
        )

    if abs(daily_alpha_drift) > MAX_DAILY_ALPHA_DRIFT_THRESHOLD:
        anomalies.append(
            f"Single-day alpha drift vs SPUS ({daily_alpha_drift * 100:+.2f}%) "
            f"exceeded threshold (±{MAX_DAILY_ALPHA_DRIFT_THRESHOLD * 100:.1f}%)."
        )

    is_realistic = len(anomalies) == 0
    status = "REALISTIC" if is_realistic else "ANOMALOUS_DRIFT"

    now_iso = datetime.datetime.now(tz=datetime.timezone.utc).isoformat()
    details_str = (
        f"Mode: {trading_mode} | Strategy Cum: {latest_strategy_cum * 100:+.2f}% | "
        f"SPUS Cum: {latest_spus_cum * 100:+.2f}% | Alpha: {total_alpha * 100:+.2f} pts | "
        f"Daily Strat: {latest_strategy_daily_return * 100:+.2f}% | Daily SPUS: {spus_daily_return * 100:+.2f}%"
    )

    # Log to audit trail
    log_audit_event(
        event_type="performance_sanity_check",
        actor=user_id,
        ip_address="system",
        details=f"Status: {status} | {details_str}",
    )

    # If anomalous drift detected, push a notification into dashboard notification bell
    if not is_realistic:
        notif_id = f"sanity-warning-{user_id[:8]}-{end_date.isoformat()}"
        insert_notification(
            id=notif_id,
            source="system",
            category="warning",
            severity="warning",
            title="Performance Drift Warning",
            body=(
                f"End-of-market audit detected potential performance anomaly: "
                f"{'; '.join(anomalies)} (Total Alpha vs SPUS: {total_alpha * 100:+.2f} pts)."
            ),
            created_at=now_iso,
        )

    return {
        "user_id": user_id,
        "status": status,
        "is_realistic": is_realistic,
        "trading_mode": trading_mode,
        "latest_date": end_date.isoformat(),
        "strategy_cumulative_return": round(latest_strategy_cum, 6),
        "spus_cumulative_return": round(latest_spus_cum, 6),
        "sp500_cumulative_return": round(latest_sp500_cum, 6),
        "total_alpha": round(total_alpha, 6),
        "latest_strategy_daily_return": round(latest_strategy_daily_return, 6),
        "latest_spus_daily_return": round(spus_daily_return, 6),
        "latest_sp500_daily_return": round(sp500_daily_return, 6),
        "daily_alpha_drift": round(daily_alpha_drift, 6),
        "anomalies": anomalies,
        "checked_at": now_iso,
    }
