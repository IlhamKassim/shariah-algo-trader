import datetime
from unittest.mock import MagicMock, patch

import pytest

from day_trader.jobs.intraday_monitor import run_intraday_monitor
from day_trader.state import ActivePosition, DayTraderState


def _make_state(*symbols: str, entry=100.0, stop=95.0, high=100.0, gap=3.0) -> DayTraderState:
    state = DayTraderState(date=datetime.date.today())
    for sym in symbols:
        state.positions[sym] = ActivePosition(
            symbol=sym,
            entry_price=entry,
            stop_loss=stop,
            highest_price=high,
            qty=10.0,
            gap_amount=gap,
        )
    return state


def _cfg(profit_mult=2.0, trailing_pct=0.05, stop_pct=0.02):
    cfg = MagicMock()
    cfg.profit_target_mult = profit_mult
    cfg.trailing_stop_pct = trailing_pct
    cfg.stop_loss_pct = stop_pct
    return cfg


def _executor():
    ex = MagicMock()
    ex.sell.return_value = True
    return ex


class TestProfitTarget:
    def test_exits_when_price_hits_target(self):
        state = _make_state("AAPL", entry=100.0, gap=3.0)
        cfg = _cfg(profit_mult=2.0)
        executor = _executor()
        # target = 100 + 2*3 = 106 → price 107 should trigger
        with patch("day_trader.jobs.intraday_monitor.fetch_latest_prices", return_value={"AAPL": 107.0}):
            run_intraday_monitor(state=state, cfg=cfg, data_client=MagicMock(), executor=executor)
        executor.sell.assert_called_once()
        assert "AAPL" not in state.positions

    def test_does_not_exit_below_target(self):
        state = _make_state("AAPL", entry=100.0, gap=3.0)
        cfg = _cfg(profit_mult=2.0)
        executor = _executor()
        # target = 106, price = 105 should NOT trigger
        with patch("day_trader.jobs.intraday_monitor.fetch_latest_prices", return_value={"AAPL": 105.0}):
            run_intraday_monitor(state=state, cfg=cfg, data_client=MagicMock(), executor=executor)
        executor.sell.assert_not_called()
        assert "AAPL" in state.positions

    def test_exits_exactly_at_target(self):
        state = _make_state("AAPL", entry=100.0, gap=3.0)
        cfg = _cfg(profit_mult=2.0)
        executor = _executor()
        with patch("day_trader.jobs.intraday_monitor.fetch_latest_prices", return_value={"AAPL": 106.0}):
            run_intraday_monitor(state=state, cfg=cfg, data_client=MagicMock(), executor=executor)
        executor.sell.assert_called_once()


class TestTrailingStop:
    def test_updates_highest_price_on_new_peak(self):
        # gap_amount=100 → target=100+2*100=300, well above the test price
        state = _make_state("MSFT", entry=100.0, high=100.0, gap=100.0)
        cfg = _cfg(trailing_pct=0.05)
        executor = _executor()
        with patch("day_trader.jobs.intraday_monitor.fetch_latest_prices", return_value={"MSFT": 110.0}):
            run_intraday_monitor(state=state, cfg=cfg, data_client=MagicMock(), executor=executor)
        assert state.positions["MSFT"].highest_price == 110.0
        executor.sell.assert_not_called()

    def test_exits_when_trailing_stop_breached(self):
        # gap_amount=100 → target=300, well above the test price
        state = _make_state("MSFT", entry=100.0, high=110.0, stop=95.0, gap=100.0)
        cfg = _cfg(trailing_pct=0.05)
        executor = _executor()
        # trailing stop = 110 * (1 - 0.05) = 104.5 → price 104 should trigger
        with patch("day_trader.jobs.intraday_monitor.fetch_latest_prices", return_value={"MSFT": 104.0}):
            run_intraday_monitor(state=state, cfg=cfg, data_client=MagicMock(), executor=executor)
        executor.sell.assert_called_once()
        assert "MSFT" not in state.positions

    def test_does_not_exit_when_trailing_stop_not_breached(self):
        # gap_amount=100 → target=300, well above the test price
        state = _make_state("MSFT", entry=100.0, high=110.0, stop=95.0, gap=100.0)
        cfg = _cfg(trailing_pct=0.05)
        executor = _executor()
        # trailing stop = 104.5 → price 105 should NOT trigger
        with patch("day_trader.jobs.intraday_monitor.fetch_latest_prices", return_value={"MSFT": 105.0}):
            run_intraday_monitor(state=state, cfg=cfg, data_client=MagicMock(), executor=executor)
        executor.sell.assert_not_called()


class TestHardStop:
    def test_exits_on_hard_stop(self):
        state = _make_state("AMD", entry=100.0, stop=95.0, high=100.0)
        cfg = _cfg(trailing_pct=0.5)  # trailing stop = 50, so hard stop dominates
        executor = _executor()
        with patch("day_trader.jobs.intraday_monitor.fetch_latest_prices", return_value={"AMD": 94.0}):
            run_intraday_monitor(state=state, cfg=cfg, data_client=MagicMock(), executor=executor)
        executor.sell.assert_called_once()
        assert "AMD" not in state.positions

    def test_hard_stop_beats_trailing_stop_when_higher(self):
        # Hard stop at 95, trailing stop at entry * 0.95 = 95 → effective stop = max(95, 95) = 95
        state = _make_state("AMD", entry=100.0, stop=95.0, high=100.0)
        cfg = _cfg(trailing_pct=0.05)
        executor = _executor()
        with patch("day_trader.jobs.intraday_monitor.fetch_latest_prices", return_value={"AMD": 95.5}):
            run_intraday_monitor(state=state, cfg=cfg, data_client=MagicMock(), executor=executor)
        executor.sell.assert_not_called()


class TestEdgeCases:
    def test_no_op_when_no_positions(self):
        state = DayTraderState(date=datetime.date.today())
        executor = _executor()
        run_intraday_monitor(state=state, cfg=_cfg(), data_client=MagicMock(), executor=executor)
        executor.sell.assert_not_called()

    def test_skips_position_with_no_price(self):
        state = _make_state("TSLA", entry=100.0, stop=95.0)
        executor = _executor()
        with patch("day_trader.jobs.intraday_monitor.fetch_latest_prices", return_value={}):
            run_intraday_monitor(state=state, cfg=_cfg(), data_client=MagicMock(), executor=executor)
        executor.sell.assert_not_called()
        assert "TSLA" in state.positions

    def test_empty_prices_logs_warning_and_skips(self):
        state = _make_state("NVDA")
        executor = _executor()
        with patch("day_trader.jobs.intraday_monitor.fetch_latest_prices", return_value={}):
            run_intraday_monitor(state=state, cfg=_cfg(), data_client=MagicMock(), executor=executor)
        executor.sell.assert_not_called()


class TestCircuitBreaker:
    def test_triggers_when_loss_exceeds_limit(self):
        state = _make_state("AAPL", gap=100.0)
        state.starting_equity = 100_000.0
        executor = _executor()
        executor.equity.return_value = 94_000.0  # 6% loss, limit is 5%
        executor.close_all.return_value = set()
        cfg = _cfg()
        cfg.max_loss_pct = 0.05
        with patch("day_trader.jobs.intraday_monitor.fetch_latest_prices", return_value={"AAPL": 110.0}):
            run_intraday_monitor(state=state, cfg=cfg, data_client=MagicMock(), executor=executor)
        executor.close_all.assert_called_once()
        assert state.circuit_broken is True
        assert state.positions == {}

    def test_does_not_trigger_below_limit(self):
        state = _make_state("AAPL", gap=100.0)
        state.starting_equity = 100_000.0
        executor = _executor()
        executor.equity.return_value = 97_000.0  # 3% loss, limit is 5%
        cfg = _cfg()
        cfg.max_loss_pct = 0.05
        with patch("day_trader.jobs.intraday_monitor.fetch_latest_prices", return_value={"AAPL": 105.0}):
            run_intraday_monitor(state=state, cfg=cfg, data_client=MagicMock(), executor=executor)
        assert state.circuit_broken is False

    def test_skips_all_checks_when_already_broken(self):
        state = _make_state("AAPL")
        state.circuit_broken = True
        executor = _executor()
        run_intraday_monitor(state=state, cfg=_cfg(), data_client=MagicMock(), executor=executor)
        executor.equity.assert_not_called()
        executor.sell.assert_not_called()

    def test_skips_circuit_check_when_no_starting_equity(self):
        state = _make_state("AAPL", gap=100.0)
        state.starting_equity = None
        executor = _executor()
        executor.equity.return_value = 50_000.0  # massive loss, but no baseline set
        with patch("day_trader.jobs.intraday_monitor.fetch_latest_prices", return_value={"AAPL": 105.0}):
            run_intraday_monitor(state=state, cfg=_cfg(), data_client=MagicMock(), executor=executor)
        assert state.circuit_broken is False
