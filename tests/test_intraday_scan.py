import datetime
from unittest.mock import MagicMock, patch

from day_trader.jobs.intraday_scan import run_intraday_scan
from day_trader.state import DayTraderState

_ADV = 500_000


def _state(opening_ranges=None) -> DayTraderState:
    state = DayTraderState(date=datetime.date.today())
    if opening_ranges:
        state.opening_ranges.update(opening_ranges)
    return state


def _cfg(
    max_pos=5, size_pct=0.10, rvol_thr=1.5, profit_mult=2.0,
    stop_pct=0.02, min_price=10.0, min_adv=100_000,
):
    cfg = MagicMock()
    cfg.max_positions = max_pos
    cfg.position_size_pct = size_pct
    cfg.rvol_threshold = rvol_thr
    cfg.profit_target_mult = profit_mult
    cfg.stop_loss_pct = stop_pct
    cfg.min_price = min_price
    cfg.min_adv = min_adv
    return cfg


def _executor(notional=1000.0):
    ex = MagicMock()
    ex.buy.return_value = notional
    return ex


# ADV=500_000, expected 5-min vol = (500_000/390)*5 ≈ 6410; RVOL=1.5 needs ≈9615 shares
_HIGH_RVOL_BARS = [{"v": 10_000}]
_LOW_RVOL_BARS = [{"v": 100}]


class TestIntradayScanEntry:
    def test_enters_on_valid_breakout(self):
        state = _state(opening_ranges={"AAPL": (100.0, 95.0)})
        executor = _executor()
        with (
            patch("day_trader.jobs.intraday_scan.fetch_latest_prices", return_value={"AAPL": 101.0}),
            patch("day_trader.jobs.intraday_scan.fetch_recent_bars", return_value={"AAPL": _HIGH_RVOL_BARS}),
        ):
            run_intraday_scan(
                state=state, cfg=_cfg(), data_client=MagicMock(),
                executor=executor, watchlist=["AAPL"], avg_volumes={"AAPL": _ADV},
            )
        executor.buy.assert_called_once_with("AAPL", _cfg().position_size_pct)
        assert "AAPL" in state.positions
        assert state.positions["AAPL"].gap_amount == 5.0  # range_high - range_low

    def test_skips_when_price_below_range_high(self):
        state = _state(opening_ranges={"AAPL": (100.0, 95.0)})
        executor = _executor()
        with (
            patch("day_trader.jobs.intraday_scan.fetch_latest_prices", return_value={"AAPL": 99.0}),
            patch("day_trader.jobs.intraday_scan.fetch_recent_bars", return_value={"AAPL": _HIGH_RVOL_BARS}),
        ):
            run_intraday_scan(
                state=state, cfg=_cfg(), data_client=MagicMock(),
                executor=executor, watchlist=["AAPL"], avg_volumes={"AAPL": _ADV},
            )
        executor.buy.assert_not_called()

    def test_skips_when_rvol_too_low(self):
        state = _state(opening_ranges={"AAPL": (100.0, 95.0)})
        executor = _executor()
        with (
            patch("day_trader.jobs.intraday_scan.fetch_latest_prices", return_value={"AAPL": 101.0}),
            patch("day_trader.jobs.intraday_scan.fetch_recent_bars", return_value={"AAPL": _LOW_RVOL_BARS}),
        ):
            run_intraday_scan(
                state=state, cfg=_cfg(), data_client=MagicMock(),
                executor=executor, watchlist=["AAPL"], avg_volumes={"AAPL": _ADV},
            )
        executor.buy.assert_not_called()

    def test_skips_symbol_with_no_opening_range(self):
        state = _state(opening_ranges={})
        executor = _executor()
        with (
            patch("day_trader.jobs.intraday_scan.fetch_latest_prices", return_value={"AAPL": 101.0}),
            patch("day_trader.jobs.intraday_scan.fetch_recent_bars", return_value={"AAPL": _HIGH_RVOL_BARS}),
        ):
            run_intraday_scan(
                state=state, cfg=_cfg(), data_client=MagicMock(),
                executor=executor, watchlist=["AAPL"], avg_volumes={"AAPL": _ADV},
            )
        executor.buy.assert_not_called()


class TestIntradayScanLimits:
    def test_respects_max_positions(self):
        watchlist = ["AAPL", "MSFT", "NVDA"]
        state = _state(opening_ranges={s: (100.0, 95.0) for s in watchlist})
        executor = _executor()
        with (
            patch("day_trader.jobs.intraday_scan.fetch_latest_prices", return_value={s: 101.0 for s in watchlist}),
            patch("day_trader.jobs.intraday_scan.fetch_recent_bars", return_value={s: _HIGH_RVOL_BARS for s in watchlist}),
        ):
            run_intraday_scan(
                state=state, cfg=_cfg(max_pos=1), data_client=MagicMock(),
                executor=executor, watchlist=watchlist, avg_volumes={s: _ADV for s in watchlist},
            )
        assert executor.buy.call_count == 1
        assert state.open_position_count() == 1

    def test_does_not_retrade_symbol(self):
        state = _state(opening_ranges={"AAPL": (100.0, 95.0)})
        state.traded_today.add("AAPL")
        executor = _executor()
        with (
            patch("day_trader.jobs.intraday_scan.fetch_latest_prices", return_value={"AAPL": 101.0}),
            patch("day_trader.jobs.intraday_scan.fetch_recent_bars", return_value={"AAPL": _HIGH_RVOL_BARS}),
        ):
            run_intraday_scan(
                state=state, cfg=_cfg(), data_client=MagicMock(),
                executor=executor, watchlist=["AAPL"], avg_volumes={"AAPL": _ADV},
            )
        executor.buy.assert_not_called()

    def test_marks_symbol_traded_today_after_buy(self):
        state = _state(opening_ranges={"AAPL": (100.0, 95.0)})
        executor = _executor()
        with (
            patch("day_trader.jobs.intraday_scan.fetch_latest_prices", return_value={"AAPL": 101.0}),
            patch("day_trader.jobs.intraday_scan.fetch_recent_bars", return_value={"AAPL": _HIGH_RVOL_BARS}),
        ):
            run_intraday_scan(
                state=state, cfg=_cfg(), data_client=MagicMock(),
                executor=executor, watchlist=["AAPL"], avg_volumes={"AAPL": _ADV},
            )
        assert "AAPL" in state.traded_today

    def test_skips_symbol_when_buy_fails(self):
        state = _state(opening_ranges={"AAPL": (100.0, 95.0)})
        executor = _executor()
        executor.buy.return_value = None
        with (
            patch("day_trader.jobs.intraday_scan.fetch_latest_prices", return_value={"AAPL": 101.0}),
            patch("day_trader.jobs.intraday_scan.fetch_recent_bars", return_value={"AAPL": _HIGH_RVOL_BARS}),
        ):
            run_intraday_scan(
                state=state, cfg=_cfg(), data_client=MagicMock(),
                executor=executor, watchlist=["AAPL"], avg_volumes={"AAPL": _ADV},
            )
        assert "AAPL" not in state.positions

    def test_does_nothing_when_circuit_broken(self):
        state = _state(opening_ranges={"AAPL": (100.0, 95.0)})
        state.circuit_broken = True
        executor = _executor()
        with (
            patch("day_trader.jobs.intraday_scan.fetch_latest_prices", return_value={"AAPL": 101.0}),
            patch("day_trader.jobs.intraday_scan.fetch_recent_bars", return_value={"AAPL": _HIGH_RVOL_BARS}),
        ):
            run_intraday_scan(
                state=state, cfg=_cfg(), data_client=MagicMock(),
                executor=executor, watchlist=["AAPL"], avg_volumes={"AAPL": _ADV},
            )
        executor.buy.assert_not_called()
