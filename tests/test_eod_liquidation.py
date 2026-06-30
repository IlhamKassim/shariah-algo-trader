import datetime
from unittest.mock import MagicMock

from day_trader.jobs.eod_liquidation import run_eod_liquidation
from day_trader.state import ActivePosition, DayTraderState


def _pos(symbol: str, entry: float = 100.0) -> ActivePosition:
    return ActivePosition(
        symbol=symbol, entry_price=entry, stop_loss=95.0,
        highest_price=entry, qty=10.0, gap_amount=3.0,
    )


def _state(*symbols: str) -> DayTraderState:
    state = DayTraderState(date=datetime.date.today())
    for sym in symbols:
        state.positions[sym] = _pos(sym)
    return state


class TestEODLiquidation:
    def test_clears_positions_on_successful_close_all(self):
        state = _state("AAPL", "MSFT")
        executor = MagicMock()
        executor.close_all.return_value = set()
        run_eod_liquidation(state=state, executor=executor)
        assert state.positions == {}

    def test_retains_failed_positions_in_state(self):
        state = _state("AAPL", "MSFT")
        executor = MagicMock()
        executor.close_all.return_value = {"MSFT"}
        run_eod_liquidation(state=state, executor=executor)
        assert "AAPL" not in state.positions
        assert "MSFT" in state.positions

    def test_all_failed_clears_nothing(self):
        state = _state("AAPL", "MSFT")
        executor = MagicMock()
        executor.close_all.return_value = {"AAPL", "MSFT"}
        run_eod_liquidation(state=state, executor=executor)
        assert "AAPL" in state.positions
        assert "MSFT" in state.positions

    def test_no_positions_does_not_crash(self):
        state = _state()
        executor = MagicMock()
        executor.close_all.return_value = set()
        run_eod_liquidation(state=state, executor=executor)
        executor.close_all.assert_called_once()
