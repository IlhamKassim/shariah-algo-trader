import datetime
import logging
import sys
import threading
from typing import Any

from day_trader.config import DayTraderConfig
from day_trader.data.alpaca_data import ET, compute_opening_ranges, fetch_avg_daily_volume
from day_trader.data.watchlist import get_watchlist
from day_trader.execution.order_executor import DayOrderExecutor
from day_trader.jobs.eod_liquidation import run_eod_liquidation
from day_trader.jobs.intraday_monitor import run_intraday_monitor
from day_trader.jobs.intraday_scan import run_intraday_scan
from day_trader.jobs.market_scan import run_market_scan
from day_trader.scheduling.scheduler import start_scheduler
from day_trader.state import DayTraderState, state
from day_trader.state_persistence import reconcile_on_startup
from shariah_algo_trader.execution.alpaca_client import AlpacaClient
from shariah_algo_trader.execution.tenant_manager import execute_multi_tenant_job
from shariah_algo_trader.scheduling.trading_calendar import is_trading_day

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# Tenant state isolation map: user_id -> DayTraderState
_tenant_states: dict[str, DayTraderState] = {}
_tenant_states_lock = threading.Lock()


def _get_tenant_state(user_id: str) -> DayTraderState:
    with _tenant_states_lock:
        if user_id not in _tenant_states:
            _tenant_states[user_id] = DayTraderState()
        return _tenant_states[user_id]


def main() -> None:
    try:
        cfg = DayTraderConfig()
    except EnvironmentError as exc:
        logger.error("Day-trader startup failed: %s", exc)
        sys.exit(1)

    data_client = AlpacaClient(cfg.api_key, cfg.api_secret, cfg.data_url)
    watchlist = get_watchlist()
    logger.info("Watchlist: %d symbols — fetching average daily volumes...", len(watchlist))
    avg_volumes = fetch_avg_daily_volume(data_client, watchlist)

    now_et = datetime.datetime.now(tz=ET)
    range_close = now_et.replace(hour=9, minute=30, second=0, microsecond=0) + datetime.timedelta(minutes=cfg.orb_minutes)
    if is_trading_day(now_et.date()) and now_et >= range_close and not state.opening_ranges:
        logger.info("Backfilling today's opening ranges...")
        state.opening_ranges.update(compute_opening_ranges(data_client, watchlist, cfg.orb_minutes))

    def refresh_adv_job() -> None:
        fresh = fetch_avg_daily_volume(data_client, watchlist)
        avg_volumes.clear()
        avg_volumes.update(fresh)
        logger.info("ADV refreshed — %d symbols", len(avg_volumes))

    def _execute_tenant_market_scan(tenant: dict[str, Any]) -> None:
        user_id = tenant["user_id"]
        tenant_state = _get_tenant_state(user_id)

        # Sharing global opening ranges if backfilled
        if state.opening_ranges and not tenant_state.opening_ranges:
            tenant_state.opening_ranges.update(state.opening_ranges)

        client = AlpacaClient(tenant["alpaca_api_key"], tenant["alpaca_api_secret"], tenant["alpaca_base_url"])
        executor = DayOrderExecutor(client)

        run_market_scan(
            state=tenant_state,
            cfg=cfg,
            data_client=data_client,
            executor=executor,
            watchlist=watchlist,
            avg_volumes=avg_volumes,
        )

    def _execute_tenant_intraday_monitor(tenant: dict[str, Any]) -> None:
        user_id = tenant["user_id"]
        tenant_state = _get_tenant_state(user_id)
        client = AlpacaClient(tenant["alpaca_api_key"], tenant["alpaca_api_secret"], tenant["alpaca_base_url"])
        executor = DayOrderExecutor(client)

        run_intraday_monitor(
            state=tenant_state,
            cfg=cfg,
            data_client=data_client,
            executor=executor,
        )

    def _execute_tenant_intraday_scan(tenant: dict[str, Any]) -> None:
        user_id = tenant["user_id"]
        tenant_state = _get_tenant_state(user_id)
        client = AlpacaClient(tenant["alpaca_api_key"], tenant["alpaca_api_secret"], tenant["alpaca_base_url"])
        executor = DayOrderExecutor(client)

        run_intraday_scan(
            state=tenant_state,
            cfg=cfg,
            data_client=data_client,
            executor=executor,
            watchlist=watchlist,
            avg_volumes=avg_volumes,
        )

    def _execute_tenant_eod_liquidation(tenant: dict[str, Any]) -> None:
        user_id = tenant["user_id"]
        tenant_state = _get_tenant_state(user_id)
        client = AlpacaClient(tenant["alpaca_api_key"], tenant["alpaca_api_secret"], tenant["alpaca_base_url"])
        executor = DayOrderExecutor(client)

        run_eod_liquidation(state=tenant_state, executor=executor)

    def multi_tenant_market_scan_job() -> None:
        execute_multi_tenant_job("day_trader_market_scan", _execute_tenant_market_scan, cfg, engine="day_trader")

    def multi_tenant_intraday_monitor_job() -> None:
        execute_multi_tenant_job("day_trader_intraday_monitor", _execute_tenant_intraday_monitor, cfg, engine="day_trader")

    def multi_tenant_intraday_scan_job() -> None:
        execute_multi_tenant_job("day_trader_intraday_scan", _execute_tenant_intraday_scan, cfg, engine="day_trader")

    def multi_tenant_eod_liquidation_job() -> None:
        execute_multi_tenant_job("day_trader_eod_liquidation", _execute_tenant_eod_liquidation, cfg, engine="day_trader")

    logger.info("Day Trader starting — Multi-Tenant SaaS Execution Mode Active.")

    start_scheduler(
        run_market_scan=multi_tenant_market_scan_job,
        run_intraday_monitor=multi_tenant_intraday_monitor_job,
        run_intraday_scan=multi_tenant_intraday_scan_job,
        run_eod_liquidation=multi_tenant_eod_liquidation_job,
        refresh_adv=refresh_adv_job,
    )


if __name__ == "__main__":
    main()
