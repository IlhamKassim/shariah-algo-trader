import logging
import datetime
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
from shariah_algo_trader.scheduling.trading_calendar import is_trading_day, is_first_trading_day_of_month

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger("cron_run")

def run():
    today = datetime.date.today()
    if not is_trading_day(today):
        logger.info("Not a NYSE trading day. Skipping execution.")
        return

    cfg = Config()
    alpaca = AlpacaClient(cfg.alpaca_api_key, cfg.alpaca_api_secret, cfg.alpaca_base_url)
    executor = OrderExecutor(alpaca)

    # 1. Run compliance check (always runs daily)
    logger.info("Starting Daily Compliance Check...")
    run_compliance_check(
        get_portfolio=lambda: get_current_portfolio(alpaca),
        fetch_universe=lambda: fetch_combined_universe(cfg.etf_symbols),
        executor=executor,
    )

    # 2. Run rebalance (only runs on the first trading day of the month)
    if is_first_trading_day_of_month(today):
        logger.info("First trading day of the month detected. Triggering monthly rebalance...")
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

        def _get_positions() -> dict[str, float]:
            positions = alpaca.get("/v2/positions")
            return {p["symbol"]: float(p["market_value"]) for p in positions}

        run_rebalance(
            get_portfolio=lambda: get_current_portfolio(alpaca),
            get_positions=_get_positions,
            fetch_universe=lambda: universe,
            get_target_portfolio=lambda: target,
            get_target_weights=lambda: weights,
            executor=executor,
            regime_ok=regime_ok,
        )
    else:
        logger.info("Not the first trading day of the month. Skipping rebalance.")

if __name__ == "__main__":
    run()
