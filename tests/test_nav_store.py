"""Regression tests for the daily NAV snapshot store + performance merge (ADR-0010)."""

import pandas as pd

from dashboard.api import nav_store
from dashboard.api.routers import performance


def _reset_nav_store(monkeypatch, tmp_path):
    """Point the NAV store at a throwaway DB for test isolation."""
    monkeypatch.setattr(nav_store, "_DB_PATH", tmp_path / "portfolio.db")
    monkeypatch.setattr(nav_store, "_initialized", False)


# ── Storage seam ──────────────────────────────────────────────────────────────

def test_record_nav_is_append_only_and_idempotent(tmp_path, monkeypatch):
    _reset_nav_store(monkeypatch, tmp_path)
    assert nav_store.record_nav("acct1", "2025-01-02", 101_000.0) is True
    # A later write for the same day must NOT overwrite (frozen history).
    assert nav_store.record_nav("acct1", "2025-01-02", 999_999.0) is False
    assert nav_store.load_nav("acct1") == {"2025-01-02": 101_000.0}


def test_record_nav_rejects_invalid(tmp_path, monkeypatch):
    _reset_nav_store(monkeypatch, tmp_path)
    assert nav_store.record_nav("", "2025-01-02", 100.0) is False
    assert nav_store.record_nav("a", "", 100.0) is False
    assert nav_store.record_nav("a", "2025-01-02", 0.0) is False
    assert nav_store.record_nav("a", "2025-01-02", -5.0) is False


def test_load_nav_ordered_and_scoped(tmp_path, monkeypatch):
    _reset_nav_store(monkeypatch, tmp_path)
    nav_store.record_nav_many("acct1", [("2025-01-03", 103.0), ("2025-01-01", 101.0), ("2025-01-02", 102.0)])
    nav_store.record_nav("acct2", "2025-01-01", 500.0)
    assert nav_store.load_nav("acct1") == {
        "2025-01-01": 101.0, "2025-01-02": 102.0, "2025-01-03": 103.0,
    }
    assert nav_store.load_nav("acct2") == {"2025-01-01": 500.0}


def test_record_nav_many_idempotent(tmp_path, monkeypatch):
    _reset_nav_store(monkeypatch, tmp_path)
    assert nav_store.record_nav_many("a", [("2025-01-01", 100.0), ("2025-01-02", 101.0)]) == 2
    # Re-insert an existing day + one new day: only the new day is written.
    assert nav_store.record_nav_many("a", [("2025-01-02", 999.0), ("2025-01-03", 102.0)]) == 1
    assert nav_store.load_nav("a") == {
        "2025-01-01": 100.0, "2025-01-02": 101.0, "2025-01-03": 102.0,
    }


# ── Performance merge ─────────────────────────────────────────────────────────

def test_apply_nav_history_freezes_and_backfills(monkeypatch):
    # Alpaca returns 4 days; today = 2025-01-06.
    alaca = pd.Series([100.0, 110.0, 121.0, 130.0],
                      index=pd.to_datetime(["2025-01-01", "2025-01-02", "2025-01-03", "2025-01-06"]))
    persisted = {"2025-01-01": 100.0, "2025-01-02": 999.0}  # 01-02 frozen
    written = []

    monkeypatch.setattr(performance, "load_nav", lambda acct: dict(persisted))

    def _record(acct, items):
        written.extend(items)
        return len(items)

    monkeypatch.setattr(performance, "record_nav_many", _record)

    out = performance._apply_nav_history("acct1", alaca)

    assert out.index.tolist() == alaca.index.tolist()
    assert out.iloc[0] == 100.0   # persisted
    assert out.iloc[1] == 999.0   # FROZEN persisted beats Alpaca's 110
    assert out.iloc[2] == 121.0   # not persisted → Alpaca value
    assert out.iloc[3] == 130.0   # today → live (never frozen)
    assert written == [("2025-01-03", 121.0)]  # only the missing non-today day was backfilled


def test_apply_nav_history_union_preserves_dropped_dates(monkeypatch):
    # Alpaca history was truncated (older days gone); today = 2025-01-06.
    alaca = pd.Series([121.0, 130.0], index=pd.to_datetime(["2025-01-03", "2025-01-06"]))
    persisted = {"2025-01-01": 100.0, "2025-01-02": 110.0, "2025-01-03": 121.0}
    monkeypatch.setattr(performance, "load_nav", lambda acct: dict(persisted))
    monkeypatch.setattr(performance, "record_nav_many", lambda acct, items: None)

    out = performance._apply_nav_history("acct1", alaca)

    # Dropped days 01-01 and 01-02 are re-added from persisted, so the curve
    # does not change even though Alpaca reset its history.
    assert out.index.tolist() == pd.to_datetime(
        ["2025-01-01", "2025-01-02", "2025-01-03", "2025-01-06"]
    ).tolist()
    assert out.iloc[0] == 100.0
    assert out.iloc[1] == 110.0
    assert out.iloc[2] == 121.0
    assert out.iloc[3] == 130.0  # today → live


def test_apply_nav_history_noop_without_account(monkeypatch):
    alaca = pd.Series([100.0, 110.0], index=pd.to_datetime(["2025-01-01", "2025-01-02"]))
    out = performance._apply_nav_history("", alaca)
    assert out.equals(alaca)
