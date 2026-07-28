import logging
import sys
from typing import Any

from shariah_algo_trader.config import Config
from shariah_algo_trader.data.regime import is_bull_market
from shariah_algo_trader.data.universe import fetch_combined_universe
from shariah_algo_trader.execution.alpaca_client import AlpacaClient
from shariah_algo_trader.execution.order_executor import OrderExecutor
from shariah_algo_trader.execution.portfolio import get_current_portfolio
from shariah_algo_trader.execution.tenant_manager import execute_multi_tenant_job
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

# Cache target weights per tenant user_id from the last completed rebalance
_last_tenant_target_weights: dict[str, dict[str, float]] = {}


def main() -> None:
    try:
        cfg = Config()
    except EnvironmentError as exc:
        logger.error("Startup failed — missing configuration: %s", exc)
        sys.exit(1)

    # Global Factor Score Cache: (etf_symbols_tuple) -> (universe, momentum, quality, raw_vols, vol_scores, value)
    _factor_cache: dict[tuple, Any] = {}

    def _get_factors_for_universe(etf_symbols: list[str]):
        key = tuple(sorted(etf_symbols))
        if key not in _factor_cache:
            universe = fetch_combined_universe(list(key))
            momentum = compute_momentum_factor(universe)
            quality = compute_quality_factor(universe)
            raw_vols = compute_raw_volatility(universe)
            vol_scores = compute_volatility_factor(raw_vols)
            value = compute_value_factor(universe)
            _factor_cache[key] = (universe, momentum, quality, raw_vols, vol_scores, value)
        return _factor_cache[key]

    def _execute_tenant_rebalance(tenant: dict[str, Any]) -> None:
        user_id = tenant["user_id"]
        etf_symbol = tenant["etf_symbol"]
        top_n = tenant["top_n"]
        sector_cap = tenant["sector_cap"]

        client = AlpacaClient(
            api_key=tenant["alpaca_api_key"],
            api_secret=tenant["alpaca_api_secret"],
            base_url=tenant["alpaca_base_url"],
        )
        executor = OrderExecutor(client)

        etf_symbols = [etf_symbol] if isinstance(etf_symbol, str) else list(etf_symbol)
        universe, momentum, quality, raw_vols, vol_scores, value = _get_factors_for_universe(etf_symbols)

        target = rank_by_factor_score(
            momentum, quality, vol_scores, value,
            top_n=top_n,
            sector_cap=sector_cap,
        )
        weights = compute_inv_vol_weights(target, raw_vols)

        if user_id not in _last_tenant_target_weights:
            _last_tenant_target_weights[user_id] = {}
        _last_tenant_target_weights[user_id].clear()
        _last_tenant_target_weights[user_id].update(weights)

        regime_ok = is_bull_market()

        def _get_positions() -> dict[str, float]:
            positions = client.get("/v2/positions")
            return {p["symbol"]: float(p["market_value"]) for p in positions}

        run_rebalance(
            get_portfolio=lambda: get_current_portfolio(client),
            get_positions=_get_positions,
            fetch_universe=lambda: universe,
            get_target_portfolio=lambda: target,
            get_target_weights=lambda: weights,
            executor=executor,
            regime_ok=regime_ok,
        )

    def _execute_tenant_compliance_check(tenant: dict[str, Any]) -> None:
        user_id = tenant["user_id"]
        etf_symbol = tenant["etf_symbol"]
        drift_threshold = tenant["drift_threshold"]
        top_n = tenant["top_n"]

        client = AlpacaClient(
            api_key=tenant["alpaca_api_key"],
            api_secret=tenant["alpaca_api_secret"],
            base_url=tenant["alpaca_base_url"],
        )
        executor = OrderExecutor(client)

        etf_symbols = [etf_symbol] if isinstance(etf_symbol, str) else list(etf_symbol)

        def _get_position_weights() -> dict[str, float]:
            positions = client.get("/v2/positions")
            total = sum(float(p["market_value"]) for p in positions)
            if total == 0:
                return {}
            return {p["symbol"]: float(p["market_value"]) / total for p in positions}

        tenant_target_weights = _last_tenant_target_weights.get(user_id, {})

        run_compliance_check(
            get_portfolio=lambda: get_current_portfolio(client),
            fetch_universe=lambda: fetch_combined_universe(etf_symbols),
            executor=executor,
            get_position_weights=_get_position_weights,
            get_target_weights=lambda: dict(tenant_target_weights),
            drift_threshold=drift_threshold,
            top_n=top_n,
            trigger_rebalance=lambda: _execute_tenant_rebalance(tenant),
        )

    def multi_tenant_rebalance_job() -> None:
        _factor_cache.clear()  # Clear factor cache to fetch fresh daily prices
        execute_multi_tenant_job("rebalance", _execute_tenant_rebalance, cfg)

    def multi_tenant_compliance_check_job() -> None:
        execute_multi_tenant_job("compliance_check", _execute_tenant_compliance_check, cfg)

    logger.info("Shariah Algo Trader Bot starting — Multi-Tenant SaaS Execution Mode Active.")
    start_scheduler(
        run_compliance_check=multi_tenant_compliance_check_job,
        run_rebalance=multi_tenant_rebalance_job,
    )


if __name__ == "__main__":
    main()
