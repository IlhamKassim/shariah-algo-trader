import logging

from shariah_algo_trader.config import Config
from shariah_algo_trader.data.fmp_client import FMPClient
from shariah_algo_trader.data.universe import fetch_eligible_universe
from shariah_algo_trader.execution.alpaca_client import AlpacaClient
from shariah_algo_trader.execution.order_executor import OrderExecutor
from shariah_algo_trader.execution.portfolio import get_current_portfolio
from shariah_algo_trader.factors.momentum import compute_momentum_factor
from shariah_algo_trader.factors.quality import compute_quality_factor
from shariah_algo_trader.factors.scorer import rank_by_factor_score
from shariah_algo_trader.jobs.compliance_check import run_compliance_check
from shariah_algo_trader.jobs.rebalance import run_rebalance
from shariah_algo_trader.scheduling.scheduler import start_scheduler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)


def main() -> None:
    cfg = Config()

    fmp = FMPClient(api_key=cfg.fmp_api_key)
    alpaca = AlpacaClient(
        api_key=cfg.alpaca_api_key,
        api_secret=cfg.alpaca_api_secret,
        base_url=cfg.alpaca_base_url,
    )
    executor = OrderExecutor(alpaca)

    def compliance_check_job() -> None:
        run_compliance_check(
            get_portfolio=lambda: get_current_portfolio(alpaca),
            fetch_universe=lambda: fetch_eligible_universe(cfg.etf_symbol, fmp),
            executor=executor,
        )

    def rebalance_job() -> None:
        universe = fetch_eligible_universe(cfg.etf_symbol, fmp)
        momentum = compute_momentum_factor(universe, fmp)
        quality = compute_quality_factor(universe, fmp)
        target = rank_by_factor_score(momentum, quality, cfg.top_n)

        run_rebalance(
            get_portfolio=lambda: get_current_portfolio(alpaca),
            fetch_universe=lambda: universe,
            get_target_portfolio=lambda: target,
            executor=executor,
        )

    start_scheduler(
        run_compliance_check=compliance_check_job,
        run_rebalance=rebalance_job,
    )


if __name__ == "__main__":
    main()
