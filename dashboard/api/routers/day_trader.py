import datetime
import logging
import os
from zoneinfo import ZoneInfo

from fastapi import APIRouter

from dashboard.api.models import (
    DayTraderAccountResponse,
    DayTraderPositionResponse,
    DayTraderResponse,
    DayTraderTradeEntry,
)
from day_trader.data.watchlist import get_watchlist
from shariah_algo_trader.execution.alpaca_client import AlpacaClient, AlpacaError

router = APIRouter()
logger = logging.getLogger(__name__)

_ET = ZoneInfo("America/New_York")


def _get_day_client() -> AlpacaClient | None:
    key = os.environ.get("DAY_ALPACA_API_KEY")
    secret = os.environ.get("DAY_ALPACA_API_SECRET")
    url = os.environ.get("DAY_ALPACA_BASE_URL", "https://paper-api.alpaca.markets")
    if not key or not secret:
        return None
    return AlpacaClient(key, secret, url)


def _unavailable() -> DayTraderResponse:
    return DayTraderResponse(
        account=DayTraderAccountResponse(
            equity=0, cash=0, buying_power=0,
            dayl_pl=0, dayl_pl_pct=0, available=False,
        ),
        positions=[],
        trades_today=[],
        max_positions=int(os.environ.get("DAY_MAX_POSITIONS", "5")),
        gap_threshold_pct=float(os.environ.get("DAY_GAP_PCT", "0.03")) * 100,
        rvol_threshold=float(os.environ.get("DAY_RVOL_THRESHOLD", "1.5")),
        stop_loss_pct=float(os.environ.get("DAY_STOP_LOSS_PCT", "0.02")) * 100,
        min_price=float(os.environ.get("DAY_MIN_PRICE", "10.0")),
        min_adv=float(os.environ.get("DAY_MIN_ADV", "1000000")),
        watchlist_size=len(get_watchlist()),
    )


@router.get("/api/day-trader", response_model=DayTraderResponse)
def get_day_trader() -> DayTraderResponse:
    client = _get_day_client()
    if client is None:
        return _unavailable()

    try:
        # Account
        acct = client.get("/v2/account")
        equity = float(acct.get("equity", 0))
        cash = float(acct.get("cash", 0))
        buying_power = float(acct.get("buying_power", 0))
        last_equity = float(acct.get("last_equity") or equity)
        dayl_pl = equity - last_equity
        dayl_pl_pct = (dayl_pl / last_equity * 100) if last_equity else 0.0

        account = DayTraderAccountResponse(
            equity=round(equity, 2),
            cash=round(cash, 2),
            buying_power=round(buying_power, 2),
            dayl_pl=round(dayl_pl, 2),
            dayl_pl_pct=round(dayl_pl_pct, 4),
            available=True,
        )

        # Open positions
        raw_positions = client.get("/v2/positions")
        positions = []
        for p in (raw_positions if isinstance(raw_positions, list) else []):
            qty = float(p.get("qty", 0))
            positions.append(DayTraderPositionResponse(
                symbol=p.get("symbol", ""),
                qty=abs(qty),
                market_value=round(float(p.get("market_value", 0)), 2),
                avg_entry_price=round(float(p.get("avg_entry_price", 0)), 2),
                unrealized_pl=round(float(p.get("unrealized_pl", 0)), 2),
                unrealized_pl_pct=round(float(p.get("unrealized_plpc", 0)) * 100, 3),
                current_price=round(float(p.get("current_price", 0)), 2),
                side=p.get("side", "long"),
            ))

        # Today's fills
        today_start_et = datetime.datetime.now(tz=_ET).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        fills = client.get(
            f"/v2/account/activities?activity_type=FILL&after={today_start_et.isoformat()}"
        )
        trades_today = []
        for f in (fills if isinstance(fills, list) else []):
            try:
                ts = datetime.datetime.fromisoformat(
                    f.get("transaction_time", "").replace("Z", "+00:00")
                ).strftime("%H:%M:%S")
            except (ValueError, AttributeError):
                ts = ""
            qty = float(f.get("qty", 0))
            price = float(f.get("price", 0))
            trades_today.append(DayTraderTradeEntry(
                timestamp=ts,
                symbol=f.get("symbol", ""),
                side=f.get("side", "").upper(),
                qty=qty,
                price=price,
                notional=round(qty * price, 2),
            ))

        return DayTraderResponse(
            account=account,
            positions=positions,
            trades_today=trades_today,
            max_positions=int(os.environ.get("DAY_MAX_POSITIONS", "5")),
            gap_threshold_pct=float(os.environ.get("DAY_GAP_PCT", "0.03")) * 100,
            rvol_threshold=float(os.environ.get("DAY_RVOL_THRESHOLD", "1.5")),
            stop_loss_pct=float(os.environ.get("DAY_STOP_LOSS_PCT", "0.02")) * 100,
            min_price=float(os.environ.get("DAY_MIN_PRICE", "10.0")),
            min_adv=float(os.environ.get("DAY_MIN_ADV", "1000000")),
            watchlist_size=len(get_watchlist()),
        )

    except AlpacaError as exc:
        logger.warning("Day trader data unavailable: %s", exc)
        return _unavailable()
