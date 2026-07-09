import datetime
import logging
import os

import numpy as np
from fastapi import APIRouter

from dashboard.api.deps import get_alpaca
from dashboard.api.live_equity import live_equity, patch_today
from dashboard.api.models import CompareResponse, StrategyMetrics
from shariah_algo_trader.execution.alpaca_client import AlpacaClient, AlpacaError

logger = logging.getLogger(__name__)

router = APIRouter()

_RISK_FREE_RATE = float(os.environ.get("RISK_FREE_RATE", "0.05"))  # annualised


def _portfolio_history(client: AlpacaClient) -> tuple[list[str], list[float]]:
    data = client.get("/v2/account/portfolio/history?period=1M&timeframe=1D")
    timestamps: list[int] = data.get("timestamp", [])
    equities: list[float] = data.get("equity", [])

    dates = [
        datetime.datetime.fromtimestamp(ts, tz=datetime.timezone.utc).strftime("%Y-%m-%d")
        for ts in timestamps
    ]
    # Filter out zero-equity entries (account not yet active that day)
    paired = [(d, e) for d, e in zip(dates, equities) if e and e > 0]
    if not paired:
        return [], []
    dates_out, equities_out = zip(*paired)
    return list(dates_out), list(equities_out)


def _compute_metrics(name: str, equity: list[float]) -> StrategyMetrics:
    if len(equity) < 2:
        return StrategyMetrics(
            name=name,
            total_return_pct=0.0,
            sharpe_ratio=0.0,
            max_drawdown_pct=0.0,
            current_equity=equity[-1] if equity else 0.0,
            win_rate_pct=0.0,
        )

    arr = np.array(equity, dtype=float)
    daily_returns = np.diff(arr) / arr[:-1]

    total_return = (arr[-1] / arr[0] - 1) * 100

    daily_rf = _RISK_FREE_RATE / 252
    excess = daily_returns - daily_rf
    sharpe = float((excess.mean() / excess.std()) * np.sqrt(252)) if excess.std() > 1e-8 else 0.0

    peaks = np.maximum.accumulate(arr)
    drawdowns = (arr - peaks) / peaks
    max_dd = float(drawdowns.min()) * 100

    win_days = int(np.sum(daily_returns > 0))
    win_rate = (win_days / len(daily_returns)) * 100

    return StrategyMetrics(
        name=name,
        total_return_pct=round(total_return, 2),
        sharpe_ratio=round(sharpe, 2),
        max_drawdown_pct=round(max_dd, 2),
        current_equity=round(float(arr[-1]), 2),
        win_rate_pct=round(win_rate, 1),
    )


def _align_series(
    dates_a: list[str], eq_a: list[float],
    dates_b: list[str], eq_b: list[float],
) -> tuple[list[str], list[float], list[float]]:
    """Return aligned (dates, eq_a, eq_b) on the intersection of trading dates."""
    map_a = dict(zip(dates_a, eq_a))
    map_b = dict(zip(dates_b, eq_b))
    common = sorted(set(dates_a) & set(dates_b))
    return common, [map_a[d] for d in common], [map_b[d] for d in common]


@router.get("/api/compare", response_model=CompareResponse)
def get_compare() -> CompareResponse:
    shariah_client = get_alpaca()
    shariah_dates, shariah_eq = _portfolio_history(shariah_client)
    shariah_dates, shariah_eq = patch_today(shariah_dates, shariah_eq, live_equity(shariah_client))
    shariah_metrics = _compute_metrics("Shariah Algo", shariah_eq)

    # Day trader account (optional — graceful if keys not yet configured)
    day_key = os.environ.get("DAY_ALPACA_API_KEY")
    day_secret = os.environ.get("DAY_ALPACA_API_SECRET")
    day_url = os.environ.get("DAY_ALPACA_BASE_URL", "https://paper-api.alpaca.markets")

    if not day_key or not day_secret:
        return CompareResponse(
            dates=shariah_dates,
            shariah_equity=shariah_eq,
            daytrader_equity=[],
            shariah=shariah_metrics,
            daytrader=StrategyMetrics(
                name="Day Trader",
                total_return_pct=0.0,
                sharpe_ratio=0.0,
                max_drawdown_pct=0.0,
                current_equity=0.0,
                win_rate_pct=0.0,
            ),
            daytrader_available=False,
        )

    try:
        day_client = AlpacaClient(day_key, day_secret, day_url)
        day_dates, day_eq = _portfolio_history(day_client)
        day_dates, day_eq = patch_today(day_dates, day_eq, live_equity(day_client))
        day_metrics = _compute_metrics("Day Trader", day_eq)

        if shariah_dates and day_dates:
            dates, shariah_eq_aligned, day_eq_aligned = _align_series(
                shariah_dates, shariah_eq, day_dates, day_eq
            )
        else:
            dates = shariah_dates or day_dates
            shariah_eq_aligned = shariah_eq
            day_eq_aligned = day_eq

        return CompareResponse(
            dates=dates,
            shariah_equity=shariah_eq_aligned,
            daytrader_equity=day_eq_aligned,
            shariah=shariah_metrics,
            daytrader=day_metrics,
            daytrader_available=True,
        )
    except AlpacaError as exc:
        logger.warning("Day trader account unavailable: %s", exc)
        return CompareResponse(
            dates=shariah_dates,
            shariah_equity=shariah_eq,
            daytrader_equity=[],
            shariah=shariah_metrics,
            daytrader=StrategyMetrics(
                name="Day Trader",
                total_return_pct=0.0,
                sharpe_ratio=0.0,
                max_drawdown_pct=0.0,
                current_equity=0.0,
                win_rate_pct=0.0,
            ),
            daytrader_available=False,
        )
