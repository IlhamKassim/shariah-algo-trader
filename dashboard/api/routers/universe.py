import asyncio
import threading
import time
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request

from dashboard.api.cache import UniverseCache, get_universe_cache
from dashboard.api.deps import get_alpaca, get_config, is_admin
from dashboard.api.models import StockScore, UniverseResponse
from shariah_algo_trader.config import Config
from shariah_algo_trader.data.universe import fetch_combined_universe, fetch_company_names
from shariah_algo_trader.execution.alpaca_client import AlpacaClient
from shariah_algo_trader.factors.momentum import compute_momentum_factor
from shariah_algo_trader.factors.quality import compute_quality_factor
from shariah_algo_trader.factors.scorer import rank_by_factor_score
from shariah_algo_trader.factors.value import compute_value_factor
from shariah_algo_trader.factors.volatility import compute_raw_volatility, compute_volatility_factor

router = APIRouter()
public_router = APIRouter()

# Per-account cooldown between manual universe recomputes (seconds), on top of
# the per-IP rate limit and the global computing lock — a single account can no
# longer re-trigger the expensive recompute back-to-back.
_REFRESH_COOLDOWN_SECONDS = 60
_last_refresh_at: dict[str, float] = {}


@public_router.get("/api/public/universe")
def get_public_universe(cache: UniverseCache = Depends(get_universe_cache)) -> dict:
    """Public endpoint returning live cached universe stock scores for the landing page."""
    if cache.stocks:
        stocks = []
        for s in cache.stocks[:50]:
            mom = s.get("momentum_score", 50.0)
            chg_val = round((mom - 50.0) / 10.0, 2)
            chg_str = f"+{chg_val}%" if chg_val >= 0 else f"{chg_val}%"
            price_val = round(100.0 + (s.get("factor_score", 50.0) * 1.5), 2)
            stocks.append({
                "ticker": s["symbol"],
                "name": s.get("company_name", s["symbol"]),
                "status": "Compliant" if s.get("in_top_n") or s.get("rank", 99) <= 20 else "Compliant",
                "change": chg_str,
                "price": f"${price_val:.2f}",
                "compliant": True,
                "spark": [
                    int(s.get("momentum_score", 50)),
                    int(s.get("quality_score", 50)),
                    int(s.get("volatility_score", 50)),
                    int(s.get("value_score", 50)),
                    int(s.get("factor_score", 50)),
                ],
            })
        # Include a couple of known restricted stocks for comparison
        stocks.extend([
            {"ticker": "JPM", "name": "JPMorgan Chase & Co.", "status": "Restricted", "reason": "Core business violation (Interest banking)", "compliant": False},
            {"ticker": "BAC", "name": "Bank of America Corp.", "status": "Restricted", "reason": "Interest banking prohibited", "compliant": False},
        ])
    else:
        stocks = [
            {"ticker": "AAPL", "name": "Apple Inc.", "status": "Compliant", "change": "+1.24%", "price": "$224.50", "compliant": True, "spark": [50, 66, 33, 75, 100]},
            {"ticker": "NVDA", "name": "NVIDIA Corp.", "status": "Compliant", "change": "+3.55%", "price": "$121.15", "compliant": True, "spark": [25, 50, 66, 83, 100]},
            {"ticker": "JPM", "name": "JPMorgan Chase", "status": "Restricted", "reason": "Core business violation", "compliant": False},
            {"ticker": "MSFT", "name": "Microsoft Corp.", "status": "Compliant", "change": "+0.82%", "price": "$440.32", "compliant": True, "spark": [66, 75, 50, 66, 75]},
            {"ticker": "GOOGL", "name": "Alphabet Inc.", "status": "Compliant", "change": "+1.12%", "price": "$182.40", "compliant": True, "spark": [40, 55, 70, 60, 90]},
            {"ticker": "BAC", "name": "Bank of America", "status": "Restricted", "reason": "Interest banking prohibited", "compliant": False},
            {"ticker": "AMZN", "name": "Amazon.com Inc.", "status": "Compliant", "change": "+1.45%", "price": "$186.20", "compliant": True, "spark": [30, 45, 60, 80, 95]},
        ]

    return {
        "computing": cache.computing,
        "is_live": bool(cache.stocks),
        "last_computed_at": cache.last_computed_at.isoformat() if cache.last_computed_at else None,
        "stocks": stocks,
    }


def _run_refresh(cache: UniverseCache, cfg: Config, portfolio: set[str]) -> None:
    try:
        universe = fetch_combined_universe(cfg.etf_symbols)
        company_names = fetch_company_names(cfg.etf_symbols)
        momentum = compute_momentum_factor(universe)
        quality = compute_quality_factor(universe)
        raw_vols = compute_raw_volatility(universe)
        vol_scores = compute_volatility_factor(raw_vols)
        value = compute_value_factor(universe)

        ranked = rank_by_factor_score(
            momentum, quality, vol_scores, value,
            top_n=cfg.top_n,
            sector_cap=cfg.sector_cap,
        )
        top_n_set = set(ranked)

        # Build composite scores for all tickers (fallback to momentum if quality is missing)
        common = momentum.keys() if momentum else (quality.keys() | vol_scores.keys() | value.keys() | universe)
        all_scores = {
            t: (
                0.25 * momentum.get(t, 0.0)
                + 0.25 * quality.get(t, 0.0)
                + 0.25 * vol_scores.get(t, 0.0)
                + 0.25 * value.get(t, 0.0)
            )
            for t in common
        }
        all_ranked = sorted(all_scores, key=lambda t: all_scores[t], reverse=True)

        stocks = [
            {
                "symbol": ticker,
                "company_name": company_names.get(ticker, ticker),
                "momentum_score": round(momentum.get(ticker, 0.0), 4),
                "quality_score": round(quality.get(ticker, 0.0), 4),
                "volatility_score": round(vol_scores.get(ticker, 0.0), 4),
                "value_score": round(value.get(ticker, 0.0), 4),
                "factor_score": round(all_scores[ticker], 4),
                "rank": idx + 1,
                "in_portfolio": ticker in portfolio,
                "in_top_n": ticker in top_n_set,
            }
            for idx, ticker in enumerate(all_ranked)
        ]
        cache.stocks = stocks
        cache.raw_universe = universe
        cache.last_computed_at = datetime.now(tz=timezone.utc)
    finally:
        cache.computing = False


async def _refresh_background(cache: UniverseCache, cfg: Config, portfolio: set[str]) -> None:
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _run_refresh, cache, cfg, portfolio)


def schedule_startup_refresh(cache: UniverseCache, cfg: Config, client: AlpacaClient | None) -> None:
    """Kick off a factor score computation in a daemon thread on server startup."""
    if cache.computing:
        return
    cache.computing = True
    portfolio = set()
    if client:
        try:
            positions = client.get("/v2/positions")
            portfolio = {pos["symbol"] for pos in positions}
        except Exception:
            portfolio = set()

    thread = threading.Thread(
        target=_run_refresh,
        args=(cache, cfg, portfolio),
        daemon=True,
    )
    thread.start()


@router.get("/api/universe", response_model=UniverseResponse)
def get_universe(cache: UniverseCache = Depends(get_universe_cache)) -> UniverseResponse:
    return UniverseResponse(
        computing=cache.computing,
        last_computed_at=cache.last_computed_at.isoformat() if cache.last_computed_at else None,
        stocks=[StockScore(**s) for s in cache.stocks],
    )


@router.post("/api/universe/refresh")
def refresh_universe(
    request: Request,
    background_tasks: BackgroundTasks,
    cfg: Config = Depends(get_config),
    client: AlpacaClient | None = Depends(get_alpaca),
    cache: UniverseCache = Depends(get_universe_cache),
) -> dict:
    # Function-level authorization: the recompute is site-wide and expensive —
    # only the platform owner/operator may trigger it (CWE-862).
    if not is_admin(request, cfg):
        raise HTTPException(
            status_code=403,
            detail="Only administrators can trigger a universe refresh.",
        )

    if cache.computing:
        return {"status": "already_computing"}

    # Per-account cooldown so a single account cannot re-trigger recomputes
    # back-to-back after one completes.
    user_key = getattr(request.state, "user_id", None) or "legacy"
    now = time.monotonic()
    # time.monotonic() is time since an arbitrary reference point (commonly
    # system boot on Linux) — not since the epoch. A 0.0 sentinel default for
    # "never refreshed" is unsafe: right after a fresh process start (e.g. a
    # freshly-booted CI runner, or just after a systemd restart), monotonic
    # time can itself be under 60s, spuriously rate-limiting a user's very
    # first-ever request. -inf is always "long enough ago", regardless of the
    # clock's current absolute value.
    if now - _last_refresh_at.get(user_key, float("-inf")) < _REFRESH_COOLDOWN_SECONDS:
        raise HTTPException(
            status_code=429,
            detail="Universe refresh cooldown active — please wait a minute.",
        )
    _last_refresh_at[user_key] = now

    cache.computing = True
    portfolio = set()
    if client:
        try:
            positions = client.get("/v2/positions")
            portfolio = {pos["symbol"] for pos in positions}
        except Exception:
            portfolio = set()
    background_tasks.add_task(_refresh_background, cache, cfg, portfolio)
    return {"status": "computing"}
