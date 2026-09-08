"""Regression tests for the daily NAV snapshot store + performance merge (ADR-0010)."""

import pandas as pd

from dashboard.api import nav_store
from dashboard.api.routers import performance

# Two distinct Alpaca accounts belonging to the same app user — the shape that
# corrupted production when the store was keyed by app user alone.
BROKER_A = "broker-aaaa"
BROKER_B = "broker-bbbb"


def _reset_nav_store(monkeypatch, tmp_path):
    """Point the NAV store at a throwaway DB for test isolation."""
    monkeypatch.setattr(nav_store, "_DB_PATH", tmp_path / "portfolio.db")
    monkeypatch.setattr(nav_store, "_initialized", False)


# ── Storage seam ──────────────────────────────────────────────────────────────

def test_record_nav_is_append_only_and_idempotent(tmp_path, monkeypatch):
    _reset_nav_store(monkeypatch, tmp_path)
    assert nav_store.record_nav("acct1", BROKER_A, "2025-01-02", 101_000.0) is True
    # A later write for the same day must NOT overwrite (frozen history).
    assert nav_store.record_nav("acct1", BROKER_A, "2025-01-02", 999_999.0) is False
    assert nav_store.load_nav("acct1", BROKER_A) == {"2025-01-02": 101_000.0}


def test_record_nav_rejects_invalid(tmp_path, monkeypatch):
    _reset_nav_store(monkeypatch, tmp_path)
    assert nav_store.record_nav("", BROKER_A, "2025-01-02", 100.0) is False
    assert nav_store.record_nav("a", "", "2025-01-02", 100.0) is False
    assert nav_store.record_nav("a", BROKER_A, "", 100.0) is False
    assert nav_store.record_nav("a", BROKER_A, "2025-01-02", 0.0) is False
    assert nav_store.record_nav("a", BROKER_A, "2025-01-02", -5.0) is False


def test_load_nav_ordered_and_scoped(tmp_path, monkeypatch):
    _reset_nav_store(monkeypatch, tmp_path)
    nav_store.record_nav_many(
        "acct1", BROKER_A,
        [("2025-01-03", 103.0), ("2025-01-01", 101.0), ("2025-01-02", 102.0)],
    )
    nav_store.record_nav("acct2", BROKER_A, "2025-01-01", 500.0)
    assert nav_store.load_nav("acct1", BROKER_A) == {
        "2025-01-01": 101.0, "2025-01-02": 102.0, "2025-01-03": 103.0,
    }
    assert nav_store.load_nav("acct2", BROKER_A) == {"2025-01-01": 500.0}


def test_record_nav_many_idempotent(tmp_path, monkeypatch):
    _reset_nav_store(monkeypatch, tmp_path)
    assert nav_store.record_nav_many(
        "a", BROKER_A, [("2025-01-01", 100.0), ("2025-01-02", 101.0)]
    ) == 2
    # Re-insert an existing day + one new day: only the new day is written.
    assert nav_store.record_nav_many(
        "a", BROKER_A, [("2025-01-02", 999.0), ("2025-01-03", 102.0)]
    ) == 1
    assert nav_store.load_nav("a", BROKER_A) == {
        "2025-01-01": 100.0, "2025-01-02": 101.0, "2025-01-03": 102.0,
    }


def test_two_broker_accounts_never_merge(tmp_path, monkeypatch):
    """The production bug: one app user, two Alpaca accounts, one spliced curve.

    A ~$100k account and a ~$120 account shared an app user. Keyed by user
    alone their rows merged, and the cumulative curve rendered a -99.88%
    single-day crash on the changeover date. Each broker account must keep its
    own series.
    """
    _reset_nav_store(monkeypatch, tmp_path)
    nav_store.record_nav_many(
        "user1", BROKER_A, [("2025-01-01", 100_000.0), ("2025-01-02", 99_652.0)]
    )
    nav_store.record_nav_many(
        "user1", BROKER_B, [("2025-01-03", 120.0), ("2025-01-04", 123.86)]
    )

    assert nav_store.load_nav("user1", BROKER_A) == {
        "2025-01-01": 100_000.0, "2025-01-02": 99_652.0,
    }
    assert nav_store.load_nav("user1", BROKER_B) == {
        "2025-01-03": 120.0, "2025-01-04": 123.86,
    }
    # Same calendar day in both accounts stays two independent rows.
    assert nav_store.record_nav("user1", BROKER_A, "2025-01-03", 99_700.0) is True
    assert nav_store.load_nav("user1", BROKER_B)["2025-01-03"] == 120.0


def test_legacy_unkeyed_rows_are_retired_not_served(tmp_path, monkeypatch):
    """Pre-broker-key rows are moved aside so they can no longer skew a curve."""
    _reset_nav_store(monkeypatch, tmp_path)
    db = tmp_path / "portfolio.db"
    db.parent.mkdir(parents=True, exist_ok=True)
    import sqlite3

    conn = sqlite3.connect(str(db))
    conn.execute(
        """
        CREATE TABLE daily_nav (
            account_id TEXT NOT NULL, date TEXT NOT NULL,
            equity REAL NOT NULL, recorded_at TEXT NOT NULL,
            PRIMARY KEY (account_id, date)
        )
        """
    )
    conn.execute("INSERT INTO daily_nav VALUES ('user1', '2025-01-01', 100000.0, 'x')")
    conn.execute("INSERT INTO daily_nav VALUES ('user1', '2025-01-02', 120.0, 'x')")
    conn.commit()
    conn.close()

    nav_store.init_nav_store()

    # Nothing legacy is served to the curve any more...
    assert nav_store.load_nav("user1", BROKER_A) == {}
    # ...but the rows are preserved for forensics rather than deleted.
    conn = sqlite3.connect(str(db))
    kept = conn.execute("SELECT COUNT(*) FROM daily_nav_legacy").fetchone()[0]
    conn.close()
    assert kept == 2


# ── Performance merge ─────────────────────────────────────────────────────────

def test_apply_nav_history_freezes_and_backfills(monkeypatch):
    # Alpaca returns 4 days; today = 2025-01-06.
    alaca = pd.Series([100.0, 110.0, 121.0, 130.0],
                      index=pd.to_datetime(["2025-01-01", "2025-01-02", "2025-01-03", "2025-01-06"]))
    persisted = {"2025-01-01": 100.0, "2025-01-02": 999.0}  # 01-02 frozen
    written = []

    monkeypatch.setattr(performance, "load_nav", lambda acct, broker: dict(persisted))

    def _record(acct, broker, items):
        written.extend(items)
        return len(items)

    monkeypatch.setattr(performance, "record_nav_many", _record)

    out = performance._apply_nav_history("acct1", BROKER_A, alaca)

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
    monkeypatch.setattr(performance, "load_nav", lambda acct, broker: dict(persisted))
    monkeypatch.setattr(performance, "record_nav_many", lambda acct, broker, items: None)

    out = performance._apply_nav_history("acct1", BROKER_A, alaca)

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
    assert performance._apply_nav_history("", BROKER_A, alaca).equals(alaca)


def test_apply_nav_history_noop_without_broker_account(monkeypatch):
    """No broker id → persist nothing, rather than write an unattributable row."""
    alaca = pd.Series([100.0, 110.0], index=pd.to_datetime(["2025-01-01", "2025-01-02"]))

    def _boom(*args, **kwargs):  # pragma: no cover - must never run
        raise AssertionError("must not touch the NAV store without a broker account id")

    monkeypatch.setattr(performance, "load_nav", _boom)
    monkeypatch.setattr(performance, "record_nav_many", _boom)

    assert performance._apply_nav_history("acct1", "", alaca).equals(alaca)
