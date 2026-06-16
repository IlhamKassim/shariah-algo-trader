import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends

from dashboard.api.cache import UniverseCache, get_universe_cache
from dashboard.api.deps import get_alpaca, get_config
from dashboard.api.models import StockScore, UniverseResponse
from shariah_algo_trader.config import Config
from shariah_algo_trader.data.universe import fetch_eligible_universe
from shariah_algo_trader.execution.alpaca_client import AlpacaClient
from shariah_algo_trader.factors.momentum import compute_momentum_factor
from shariah_algo_trader.factors.quality import compute_quality_factor
from shariah_algo_trader.factors.scorer import rank_by_factor_score

router = APIRouter()


def _run_refresh(cache: UniverseCache, etf_symbol: str, top_n: int, portfolio: set[str]) -> None:
    try:
        universe = fetch_eligible_universe(etf_symbol)
        momentum = compute_momentum_factor(universe)
        quality = compute_quality_factor(universe)
        ranked = rank_by_factor_score(momentum, quality, top_n)
        top_n_set = set(ranked)

        common = momentum.keys() & quality.keys()
        all_scores = {
            t: 0.5 * momentum[t] + 0.5 * quality[t]
            for t in common
        }
        all_ranked = sorted(all_scores, key=lambda t: all_scores[t], reverse=True)

        stocks = [
            {
                "symbol": ticker,
                "momentum_score": round(momentum.get(ticker, 0.0), 4),
                "quality_score": round(quality.get(ticker, 0.0), 4),
                "factor_score": round(all_scores[ticker], 4),
                "rank": idx + 1,
                "in_portfolio": ticker in portfolio,
                "in_top_n": ticker in top_n_set,
            }
            for idx, ticker in enumerate(all_ranked)
        ]
        cache.stocks = stocks
        cache.last_computed_at = datetime.now(tz=timezone.utc)
    finally:
        cache.computing = False


async def _refresh_background(cache: UniverseCache, etf_symbol: str, top_n: int,
                               portfolio: set[str]) -> None:
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _run_refresh, cache, etf_symbol, top_n, portfolio)


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
    background_tasks.add_task(
        _refresh_background, cache, cfg.etf_symbol, cfg.top_n, portfolio
    )
    return {"status": "computing"}
