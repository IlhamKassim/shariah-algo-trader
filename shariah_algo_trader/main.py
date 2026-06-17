import logging
import sys

from shariah_algo_trader.config import Config
from shariah_algo_trader.data.regime import is_bull_market
from shariah_algo_trader.data.universe import fetch_combined_universe
from shariah_algo_trader.execution.alpaca_client import AlpacaClient
from shariah_algo_trader.execution.order_executor import OrderExecutor
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
from shariah_algo_trader.jobs.compliance_check import run_compliance_check
from shariah_algo_trader.jobs.rebalance import run_rebalance
from shariah_algo_trader.scheduling.scheduler import start_scheduler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)

logger = logging.getLogger(__name__)


def main() -> None:
    try:
        cfg = Config()
    except EnvironmentError as exc:
        logger.error("Startup failed — missing configuration: %s", exc)
        sys.exit(1)

    alpaca = AlpacaClient(
        api_key=cfg.alpaca_api_key,
        api_secret=cfg.alpaca_api_secret,
        base_url=cfg.alpaca_base_url,
    )
    executor = OrderExecutor(alpaca)

    def _get_position_weights() -> dict[str, float]:
        positions = alpaca.get("/v2/positions")
        total = sum(float(p["market_value"]) for p in positions)
        if total == 0:
            return {}
        return {p["symbol"]: float(p["market_value"]) / total for p in positions}

    def _get_positions() -> dict[str, float]:
        positions = alpaca.get("/v2/positions")
        return {p["symbol"]: float(p["market_value"]) for p in positions}

    def rebalance_job() -> None:
        universe = fetch_combined_universe(cfg.etf_symbols)
        momentum = compute_momentum_factor(universe)
        quality = compute_quality_factor(universe)
        raw_vols = compute_raw_volatility(universe)
        vol_scores = compute_volatility_factor(raw_vols)
        value = compute_value_factor(universe)

        target = rank_by_factor_score(
            momentum, quality, vol_scores, value,
            top_n=cfg.top_n,
            sector_cap=cfg.sector_cap,
        )
        weights = compute_inv_vol_weights(target, raw_vols)
        regime_ok = is_bull_market()

        run_rebalance(
            get_portfolio=lambda: get_current_portfolio(alpaca),
            get_positions=_get_positions,
            fetch_universe=lambda: universe,
            get_target_portfolio=lambda: target,
            get_target_weights=lambda: weights,
            executor=executor,
            regime_ok=regime_ok,
        )

    def compliance_check_job() -> None:
        run_compliance_check(
            get_portfolio=lambda: get_current_portfolio(alpaca),
            fetch_universe=lambda: fetch_combined_universe(cfg.etf_symbols),
            executor=executor,
            get_position_weights=_get_position_weights,
            drift_threshold=cfg.drift_threshold,
            top_n=cfg.top_n,
            trigger_rebalance=rebalance_job,
        )

    logger.info(
        "Shariah Algo Trader starting — universe: %s, top_n: %d, sector_cap: %.0f%%, "
        "drift_threshold: %.0f%%, broker: %s",
        cfg.etf_symbols, cfg.top_n, cfg.sector_cap * 100,
        cfg.drift_threshold * 100, cfg.alpaca_base_url,
    )
    start_scheduler(
        run_compliance_check=compliance_check_job,
        run_rebalance=rebalance_job,
    )
