"""Regression tests for inception-anchored cumulative performance.

Guards the dashboard bug where cumulative returns were recomputed over a
rolling 30-day Alpaca window, so a given calendar date showed a different
value every day. The fix anchors returns to the account's inception (the
first point of the full series), which is stable as new days arrive.
"""

import datetime

import pandas as pd
import pytest

from dashboard.api.live_equity import ts_to_date
from dashboard.api.routers.performance import _anchor_cumulative, _to_cumulative


def _equity(n: int, start="2025-01-01", freq="B") -> pd.Series:
    idx = pd.date_range(start, periods=n, freq=freq)
    # Smoothly varying equity with an uptrend and some drawdown for realism.
    values = [100_000 * (1.01 ** i) * (1 - 0.005 * ((i * 7) % 5)) for i in range(n)]
    return pd.Series(values, index=idx, dtype=float)


def test_anchor_cumulative_is_inception_anchored():
    eq = _equity(40)
    cum = _anchor_cumulative(eq)
    assert cum[0] == 0.0
    for k in (1, 20, 39):
        assert cum[k] == round(eq.iloc[k] / eq.iloc[0] - 1, 6)


def test_anchor_cumulative_stable_when_new_day_arrives():
    """Appending a new day must NOT change any earlier date's value.

    This is the exact symptom the user reported: the graph changed every day.
    With inception anchoring, the curve for dates already seen is immutable.
    """
    eq = _equity(40)
    before = _anchor_cumulative(eq)

    # A new day arrives; equity extends one bar.
    eq_next = eq.copy()
    eq_next = pd.concat([eq_next, pd.Series([eq.iloc[-1] * 1.01], index=pd.date_range(eq.index[-1], periods=2, freq="B")[1:])])
    after = _anchor_cumulative(eq_next)

    assert after[: len(before)] == pytest.approx(before, abs=1e-6)


def test_anchor_cumulative_empty_and_zero_base():
    assert _anchor_cumulative(pd.Series(dtype=float)) == []
    # Zero base must not divide-by-zero; degrades to zeros.
    zero = pd.Series([0.0, 0.0, 5.0], index=pd.date_range("2025-01-01", periods=3, freq="B"))
    assert _anchor_cumulative(zero) == [0.0, 0.0, 0.0]


def test_to_cumulative_anchors_benchmark_to_inception():
    # Benchmark prices exist before the account inception date.
    bench = pd.Series(
        [100.0 + i for i in range(20)],
        index=pd.date_range("2025-01-01", periods=20, freq="B"),
    )
    # Account inception is at bench index 5.
    equity_index = bench.index[5:]
    cum = _to_cumulative(bench, equity_index)

    base = bench.iloc[5]
    assert cum[0] == 0.0
    assert cum[1] == round(bench.iloc[6] / base - 1, 6)
    assert len(cum) == len(equity_index)


def test_to_cumulative_empty_benchmark_returns_zeros():
    idx = pd.date_range("2025-01-01", periods=5, freq="B")
    assert _to_cumulative(pd.Series(dtype=float), idx) == [0.0] * 5


def test_ts_to_date_is_utc_and_server_timezone_independent():
    # Epoch 0 = 1970-01-01 00:00 UTC. The label must be the UTC date no matter
    # what timezone the test host runs in.
    assert ts_to_date(0) == "1970-01-01"
    # 2025-01-01 04:00 UTC is still "2025-01-01" in UTC (it would read as the
    # prior day under America/New_York), so this locks the UTC interpretation.
    ts = datetime.datetime(2025, 1, 1, 4, 0, 0, tzinfo=datetime.timezone.utc).timestamp()
    assert ts_to_date(ts) == "2025-01-01"
