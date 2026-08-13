"""Tests for junk test-tenant registry hygiene (F6 / AC-2, Q8=A).

The local ``data/user_settings.db`` historically contains 5 test rows
(user_tenant_1, user_tenant_2, test_user_account_isolation, user_111,
user_222) that are enabled and carry paper keys, so the rebalance engine
dispatches real jobs to them every cycle. Per decision Q8=A the fix is:
DISABLE now (``shariah_trader_enabled = 0``), delete after the pilot is
stable. ``scripts/purge_test_tenants.py`` performs the disable with a
dry-run default; this file pins its behavior and proves AC-2: disabled
junk rows no longer appear in ``get_active_tenant_accounts()``.
"""

import sqlite3

import pytest

from dashboard.api import user_store
from dashboard.api.user_store import init_user_store
from shariah_algo_trader.execution import tenant_manager
from shariah_algo_trader.execution.tenant_manager import get_active_tenant_accounts
from scripts.purge_test_tenants import JUNK_USER_IDS, purge_test_tenants

_INSERT_USER_SQL = """
INSERT INTO user_settings (
    user_id, alpaca_api_key_encrypted, alpaca_api_secret_encrypted,
    alpaca_live_api_key_encrypted, alpaca_live_api_secret_encrypted,
    trading_mode, alpaca_base_url, etf_symbol, top_n, sector_cap,
    drift_threshold, shariah_trader_enabled, day_trader_enabled,
    risk_acknowledged_at, created_at, updated_at
) VALUES (?, ?, ?, NULL, NULL, 'paper', 'https://paper-api.alpaca.markets',
          'SPUS', 20, 0.20, 0.03, ?, 0, NULL, ?, ?)
"""


def _encrypt(value: str) -> str | None:
    from dashboard.api.crypto import encrypt_credential

    return encrypt_credential(value)


def _insert_user(db_path, user_id: str, *, paper_key: str, paper_secret: str, enabled: int) -> None:
    conn = sqlite3.connect(str(db_path))
    try:
        now = "2026-08-13T00:00:00+00:00"
        conn.execute(
            _INSERT_USER_SQL,
            (
                user_id,
                _encrypt(paper_key),
                _encrypt(paper_secret),
                enabled,
                now,
                now,
            ),
        )
        conn.commit()
    finally:
        conn.close()


def _enabled(db_path, user_id: str) -> int | None:
    conn = sqlite3.connect(str(db_path))
    try:
        row = conn.execute(
            "SELECT shariah_trader_enabled FROM user_settings WHERE user_id = ?",
            (user_id,),
        ).fetchone()
        return row[0] if row else None
    finally:
        conn.close()


@pytest.fixture
def junk_db(tmp_path, monkeypatch):
    """A throwaway user store seeded with all 5 junk rows + one real row."""
    db_path = tmp_path / "user_settings.db"
    monkeypatch.setattr(user_store, "_DB_PATH", db_path)
    monkeypatch.setattr(user_store, "_sync_to_supabase", lambda *a, **k: None)
    init_user_store()
    for uid in JUNK_USER_IDS:
        _insert_user(db_path, uid, paper_key=f"PK-{uid}", paper_secret=f"SK-{uid}", enabled=1)
    _insert_user(db_path, "5b7fb8dd-real-admin", paper_key="PK-REAL", paper_secret="SK-REAL", enabled=1)
    return db_path


def test_junk_ids_are_the_five_known_rows():
    assert JUNK_USER_IDS == (
        "user_tenant_1",
        "user_tenant_2",
        "test_user_account_isolation",
        "user_111",
        "user_222",
    )


def test_purge_dry_run_reports_without_writing(junk_db):
    result = purge_test_tenants(junk_db, apply=False)

    assert result["dry_run"] is True
    assert result["found"] == 5
    assert result["disabled_now"] == 5
    assert result["already_disabled"] == 0
    assert result["missing"] == 0

    # Nothing was written
    for uid in JUNK_USER_IDS:
        assert _enabled(junk_db, uid) == 1
    assert _enabled(junk_db, "5b7fb8dd-real-admin") == 1


def test_purge_apply_disables_only_junk_rows(junk_db):
    result = purge_test_tenants(junk_db, apply=True)

    assert result["dry_run"] is False
    assert result["disabled_now"] == 5
    for uid in JUNK_USER_IDS:
        assert _enabled(junk_db, uid) == 0
    # Real admin row untouched
    assert _enabled(junk_db, "5b7fb8dd-real-admin") == 1

    # Second run: everything already disabled
    result2 = purge_test_tenants(junk_db, apply=True)
    assert result2["disabled_now"] == 0
    assert result2["already_disabled"] == 5


def test_purge_reports_missing_junk_rows(tmp_path, monkeypatch):
    db_path = tmp_path / "user_settings.db"
    monkeypatch.setattr(user_store, "_DB_PATH", db_path)
    init_user_store()
    _insert_user(db_path, "user_111", paper_key="PK", paper_secret="SK", enabled=1)

    result = purge_test_tenants(db_path, apply=False)

    assert result["missing"] == 4
    missing_ids = {r["user_id"] for r in result["rows"] if r["action"] == "missing"}
    assert missing_ids == set(JUNK_USER_IDS) - {"user_111"}


def test_purge_missing_db_raises(tmp_path):
    with pytest.raises(FileNotFoundError):
        purge_test_tenants(tmp_path / "does-not-exist.db")


def test_disabled_junk_rows_excluded_from_tenant_discovery(junk_db, monkeypatch):
    """AC-2: after the disable, get_active_tenant_accounts() no longer lists junk rows."""
    monkeypatch.setattr(tenant_manager, "_DB_PATH", junk_db)

    before = get_active_tenant_accounts(engine="shariah_trader")
    before_ids = {a["raw_user_id"] for a in before}
    assert before_ids >= set(JUNK_USER_IDS), "junk rows are live before cleanup (F6)"

    purge_test_tenants(junk_db, apply=True)

    after = get_active_tenant_accounts(engine="shariah_trader")
    after_ids = {a["raw_user_id"] for a in after}
    for uid in JUNK_USER_IDS:
        assert uid not in after_ids, f"junk row {uid} must vanish from tenant discovery"
    # The real row still dispatches (regression: cleanup must not touch real users)
    assert "5b7fb8dd-real-admin" in after_ids
