import datetime

import pandas as pd
import yfinance as yf
from fastapi import APIRouter, Depends

from dashboard.api.deps import get_alpaca
from dashboard.api.models import PerformanceResponse
from shariah_algo_trader.execution.alpaca_client import AlpacaClient

router = APIRouter()


@router.get("/api/performance", response_model=PerformanceResponse)
def get_performance(client: AlpacaClient = Depends(get_alpaca)) -> PerformanceResponse:
    history = client.get("/v2/account/portfolio/history?period=1M&timeframe=1D")
    timestamps = history.get("timestamp", [])
    equities = history.get("equity", [])

    if not timestamps or not equities:
        return PerformanceResponse(dates=[], portfolio_cumulative=[], benchmark_cumulative=[])

    dates = [datetime.date.fromtimestamp(ts).isoformat() for ts in timestamps]
    equity_series = pd.Series(
        [float(e) if e is not None else float("nan") for e in equities],
        index=pd.to_datetime(dates),
    ).dropna()
    equity_series = equity_series[equity_series > 0]

    if len(equity_series) < 2:
        return PerformanceResponse(dates=[], portfolio_cumulative=[], benchmark_cumulative=[])

    port_returns = equity_series.pct_change().fillna(0)
    port_cumulative = ((1 + port_returns).cumprod() - 1).round(6).tolist()

    start_date = equity_series.index[0].date()
    end_date = equity_series.index[-1].date() + datetime.timedelta(days=1)
    bench_raw = yf.download(
        "SPUS",
        start=str(start_date),
        end=str(end_date),
        auto_adjust=True,
        progress=False,
    )

    if bench_raw.empty:
        bench_cumulative = [0.0] * len(port_cumulative)
    else:
        bench_close = bench_raw["Close"]
        if isinstance(bench_close, pd.DataFrame):
            bench_close = bench_close.iloc[:, 0]
        bench_close = bench_close.reindex(equity_series.index).ffill().dropna()
        bench_returns = bench_close.pct_change().fillna(0)
        bench_cumulative = ((1 + bench_returns).cumprod() - 1).round(6).tolist()

        # Align lengths
        min_len = min(len(port_cumulative), len(bench_cumulative))
        dates = [equity_series.index[i].date().isoformat() for i in range(min_len)]
        port_cumulative = port_cumulative[:min_len]
        bench_cumulative = bench_cumulative[:min_len]

    return PerformanceResponse(
        dates=dates,
        portfolio_cumulative=port_cumulative,
        benchmark_cumulative=bench_cumulative,
    )
