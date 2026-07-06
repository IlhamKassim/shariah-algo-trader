import datetime
from unittest.mock import MagicMock

from day_trader import state_persistence
from day_trader.state import ActivePosition, DayTraderState


def _position(symbol="AAPL", qty=10.0):
    return ActivePosition(
        symbol=symbol, entry_price=100.0, stop_loss=95.0,
        highest_price=105.0, qty=qty, gap_amount=4.0,
    )


class TestSaveLoad:
    def test_round_trip_restores_positions_and_flags(self, tmp_path):
        path = str(tmp_path / "state.json")
        state = DayTraderState(date=datetime.date.today())
        state.positions["AAPL"] = _position()
        state.traded_today.add("AAPL")
        state.starting_equity = 100_000.0
        state.circuit_broken = False

        state_persistence.save(state, path)
        loaded = state_persistence.load(path)

        assert loaded is not None
        assert loaded["positions"]["AAPL"].entry_price == 100.0
        assert loaded["positions"]["AAPL"].stop_loss == 95.0
        assert loaded["traded_today"] == {"AAPL"}
        assert loaded["starting_equity"] == 100_000.0
        assert loaded["circuit_broken"] is False

    def test_load_missing_file_returns_none(self, tmp_path):
        assert state_persistence.load(str(tmp_path / "nope.json")) is None

    def test_load_stale_date_returns_none(self, tmp_path):
        path = str(tmp_path / "state.json")
        state = DayTraderState(date=datetime.date(2020, 1, 1))
        state_persistence.save(state, path)
        assert state_persistence.load(path) is None

    def test_save_does_not_raise_on_bad_data(self, tmp_path):
        path = str(tmp_path / "state.json")
        state = DayTraderState(date=datetime.date.today())
        state.starting_equity = MagicMock()  # not JSON-serializable
        state_persistence.save(state, path)  # should log, not raise


class TestReconcileOnStartup:
    def test_restores_matching_cached_position(self, tmp_path, monkeypatch):
        path = str(tmp_path / "state.json")
        monkeypatch.setattr(state_persistence, "DEFAULT_PATH", path)

        cached_state = DayTraderState(date=datetime.date.today())
        cached_state.positions["AAPL"] = _position(qty=10.0)
        state_persistence.save(cached_state, path)

        state = DayTraderState(date=datetime.date.today())
        executor = MagicMock()
        executor.list_positions.return_value = [{"symbol": "AAPL", "qty": "10.0"}]

        state_persistence.reconcile_on_startup(state, executor)

        assert "AAPL" in state.positions
        assert state.positions["AAPL"].stop_loss == 95.0
        executor.sell.assert_not_called()

    def test_liquidates_orphaned_position_with_no_cache(self, tmp_path, monkeypatch):
        monkeypatch.setattr(state_persistence, "load", lambda: None)
        state = DayTraderState(date=datetime.date.today())
        executor = MagicMock()
        executor.list_positions.return_value = [{"symbol": "MSFT", "qty": "5.0"}]

        state_persistence.reconcile_on_startup(state, executor)

        assert "MSFT" not in state.positions
        executor.sell.assert_called_once_with("MSFT", reason="orphaned on restart, no cached risk parameters")

    def test_does_nothing_when_no_cache_and_no_live_positions(self, monkeypatch):
        monkeypatch.setattr(state_persistence, "load", lambda: None)
        state = DayTraderState(date=datetime.date.today())
        executor = MagicMock()
        executor.list_positions.return_value = []

        state_persistence.reconcile_on_startup(state, executor)

        executor.sell.assert_not_called()
        assert state.positions == {}
