import asyncio
import threading
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends

from dashboard.api.cache import UniverseCache, get_universe_cache
from dashboard.api.deps import get_alpaca, get_config
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

        # Build composite scores for all tickers that have at least momentum+quality
        common = momentum.keys() & quality.keys()
        all_scores = {
            t: (
                0.25 * momentum[t]
                + 0.25 * quality[t]
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


def schedule_startup_refresh(cache: UniverseCache, cfg: Config, client: AlpacaClient) -> None:
    """Kick off a factor score computation in a daemon thread on server startup."""
    if cache.computing:
        return
    cache.computing = True
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
    background_tasks: BackgroundTasks,
    cfg: Config = Depends(get_config),
    client: AlpacaClient = Depends(get_alpaca),
    cache: UniverseCache = Depends(get_universe_cache),
) -> dict:
    if cache.computing:
        return {"status": "already_computing"}
    cache.computing = True
    positions = client.get("/v2/positions")
    portfolio = {pos["symbol"] for pos in positions}
    background_tasks.add_task(_refresh_background, cache, cfg, portfolio)
    return {"status": "computing"}
