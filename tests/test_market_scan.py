import datetime
from unittest.mock import MagicMock, patch

from day_trader.jobs.market_scan import run_market_scan
from day_trader.state import DayTraderState

_ADV = 500_000


def _state() -> DayTraderState:
    return DayTraderState(date=datetime.date.today())


def _cfg(max_pos=5, size_pct=0.10, gap_thr=0.03, rvol_thr=1.5, profit_mult=2.0, stop_pct=0.02, trailing_pct=0.015):
    cfg = MagicMock()
    cfg.max_positions = max_pos
    cfg.position_size_pct = size_pct
    cfg.gap_threshold = gap_thr
    cfg.rvol_threshold = rvol_thr
    cfg.profit_target_mult = profit_mult
    cfg.stop_loss_pct = stop_pct
    cfg.trailing_stop_pct = trailing_pct
    return cfg


def _executor(notional=1000.0):
    ex = MagicMock()
    ex.buy.return_value = notional
    return ex


# Enough first-minute volume to get RVOL ≥ 1.5 with ADV=500_000
# expected 1-min = 500_000/390 ≈ 1282; RVOL=1.5 needs 1923 shares
_HIGH_RVOL_BARS = [{"v": 2000}]
_LOW_RVOL_BARS = [{"v": 100}]


class TestMarketScanEntry:
    def test_enters_when_gap_and_rvol_sufficient(self):
        state = _state()
        executor = _executor()
        with (
            patch("day_trader.jobs.market_scan.fetch_opening_range_bars", return_value={"AAPL": _HIGH_RVOL_BARS}),
            patch("day_trader.jobs.market_scan.fetch_prev_close", return_value={"AAPL": 100.0}),
            patch("day_trader.jobs.market_scan.fetch_latest_prices", return_value={"AAPL": 105.0}),
        ):
            run_market_scan(
                state=state, cfg=_cfg(), data_client=MagicMock(),
                executor=executor, watchlist=["AAPL"], avg_volumes={"AAPL": _ADV},
            )
        executor.buy.assert_called_once_with("AAPL", _cfg().position_size_pct)
        assert "AAPL" in state.positions

    def test_skips_when_gap_too_small(self):
        state = _state()
        executor = _executor()
        with (
            patch("day_trader.jobs.market_scan.fetch_opening_range_bars", return_value={"AAPL": _HIGH_RVOL_BARS}),
            patch("day_trader.jobs.market_scan.fetch_prev_close", return_value={"AAPL": 100.0}),
            patch("day_trader.jobs.market_scan.fetch_latest_prices", return_value={"AAPL": 101.0}),
        ):
            run_market_scan(
                state=state, cfg=_cfg(), data_client=MagicMock(),
                executor=executor, watchlist=["AAPL"], avg_volumes={"AAPL": _ADV},
            )
        executor.buy.assert_not_called()

    def test_skips_when_rvol_too_low(self):
        state = _state()
        executor = _executor()
        with (
            patch("day_trader.jobs.market_scan.fetch_opening_range_bars", return_value={"AAPL": _LOW_RVOL_BARS}),
            patch("day_trader.jobs.market_scan.fetch_prev_close", return_value={"AAPL": 100.0}),
            patch("day_trader.jobs.market_scan.fetch_latest_prices", return_value={"AAPL": 105.0}),
        ):
            run_market_scan(
                state=state, cfg=_cfg(), data_client=MagicMock(),
                executor=executor, watchlist=["AAPL"], avg_volumes={"AAPL": _ADV},
            )
        executor.buy.assert_not_called()


class TestMarketScanLimits:
    def test_respects_max_positions(self):
        state = _state()
        executor = _executor()
        watchlist = ["AAPL", "MSFT", "NVDA"]
        bars = {s: _HIGH_RVOL_BARS for s in watchlist}
        prev_closes = {s: 100.0 for s in watchlist}
        prices = {s: 105.0 for s in watchlist}
        with (
            patch("day_trader.jobs.market_scan.fetch_opening_range_bars", return_value=bars),
            patch("day_trader.jobs.market_scan.fetch_prev_close", return_value=prev_closes),
            patch("day_trader.jobs.market_scan.fetch_latest_prices", return_value=prices),
        ):
            run_market_scan(
                state=state, cfg=_cfg(max_pos=1), data_client=MagicMock(),
                executor=executor, watchlist=watchlist, avg_volumes={s: _ADV for s in watchlist},
            )
        assert executor.buy.call_count == 1
        assert state.open_position_count() == 1

    def test_does_not_retrade_symbol(self):
        state = _state()
        state.traded_today.add("AAPL")
        executor = _executor()
        with (
            patch("day_trader.jobs.market_scan.fetch_opening_range_bars", return_value={"AAPL": _HIGH_RVOL_BARS}),
            patch("day_trader.jobs.market_scan.fetch_prev_close", return_value={"AAPL": 100.0}),
            patch("day_trader.jobs.market_scan.fetch_latest_prices", return_value={"AAPL": 105.0}),
        ):
            run_market_scan(
                state=state, cfg=_cfg(), data_client=MagicMock(),
                executor=executor, watchlist=["AAPL"], avg_volumes={"AAPL": _ADV},
            )
        executor.buy.assert_not_called()

    def test_marks_symbol_traded_today_after_buy(self):
        state = _state()
        executor = _executor()
        with (
            patch("day_trader.jobs.market_scan.fetch_opening_range_bars", return_value={"AAPL": _HIGH_RVOL_BARS}),
            patch("day_trader.jobs.market_scan.fetch_prev_close", return_value={"AAPL": 100.0}),
            patch("day_trader.jobs.market_scan.fetch_latest_prices", return_value={"AAPL": 105.0}),
        ):
            run_market_scan(
                state=state, cfg=_cfg(), data_client=MagicMock(),
                executor=executor, watchlist=["AAPL"], avg_volumes={"AAPL": _ADV},
            )
        assert "AAPL" in state.traded_today

    def test_skips_symbol_when_buy_fails(self):
        state = _state()
        executor = _executor(notional=None)
        executor.buy.return_value = None
        with (
            patch("day_trader.jobs.market_scan.fetch_opening_range_bars", return_value={"AAPL": _HIGH_RVOL_BARS}),
            patch("day_trader.jobs.market_scan.fetch_prev_close", return_value={"AAPL": 100.0}),
            patch("day_trader.jobs.market_scan.fetch_latest_prices", return_value={"AAPL": 105.0}),
        ):
            run_market_scan(
                state=state, cfg=_cfg(), data_client=MagicMock(),
                executor=executor, watchlist=["AAPL"], avg_volumes={"AAPL": _ADV},
            )
        assert "AAPL" not in state.positions
