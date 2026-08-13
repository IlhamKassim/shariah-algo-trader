"""Tests for the Supabase schema alignment (F4 closure).

The dashboard's ``_sync_to_supabase`` POSTs records containing
``shariah_trader_enabled``, ``day_trader_enabled`` and
``risk_acknowledged_at``, but the cloud ``user_settings`` table only had
columns up to ``trading_mode`` + live keys — so every sync was rejected with
PostgREST PGRST204 ("column not found"). The alignment migration
(``supabase/migrations/20260813_pilot_schema_alignment.sql``) adds the three
missing columns with ``ADD COLUMN IF NOT EXISTS``. Applying it to the cloud
project is a HUMAN deploy step (not performed by tests).

These tests pin:
1. the migration file exists and adds exactly the three missing columns; and
2. the record that ``save_user_settings`` syncs contains those columns, so a
   synced row can never be rejected for an unknown column again.
"""

import datetime

import pytest

from dashboard.api import user_store
from dashboard.api.user_store import init_user_store, save_user_settings

_MIGRATION_PATH = (
    user_store._DB_PATH.parent.parent
    / "supabase"
    / "migrations"
    / "20260813_pilot_schema_alignment.sql"
)


@pytest.fixture
def isolated_store(tmp_path, monkeypatch):
    """Point the user store at a throwaway DB and silence live sync."""
    db_path = tmp_path / "user_settings.db"
    monkeypatch.setattr(user_store, "_DB_PATH", db_path)
    monkeypatch.setattr(user_store, "_sync_to_supabase", lambda *a, **k: None)
    init_user_store()
    return db_path


def test_migration_adds_three_missing_columns():
    sql = _MIGRATION_PATH.read_text(encoding="utf-8")

    assert "user_settings" in sql
    for column in (
        "shariah_trader_enabled",
        "day_trader_enabled",
        "risk_acknowledged_at",
    ):
        assert f"ADD COLUMN IF NOT EXISTS {column}" in sql, (
            f"migration must add {column} with ADD COLUMN IF NOT EXISTS"
        )


def test_sync_record_contains_alignment_columns(isolated_store, monkeypatch):
    captured: dict = {}

    def _capture(user_id: str, record: dict) -> None:
        captured["user_id"] = user_id
        captured["record"] = record

    monkeypatch.setattr(user_store, "_sync_to_supabase", _capture)

    save_user_settings(
        "sync-alignment-user",
        {
            "shariah_trader_enabled": True,
            "day_trader_enabled": False,
            "risk_acknowledged_at": "2026-08-13T00:00:00+00:00",
            "trading_mode": "paper",
        },
    )

    assert captured["user_id"] == "sync-alignment-user"
    record = captured["record"]
    assert "shariah_trader_enabled" in record
    assert "day_trader_enabled" in record
    assert "risk_acknowledged_at" in record
    assert record["shariah_trader_enabled"] == 1
    assert record["day_trader_enabled"] == 0
    assert record["risk_acknowledged_at"] == "2026-08-13T00:00:00+00:00"


def test_sync_record_timestamps_are_utc_iso(isolated_store, monkeypatch):
    captured: dict = {}

    def _capture(user_id: str, record: dict) -> None:
        captured["record"] = record

    monkeypatch.setattr(user_store, "_sync_to_supabase", _capture)

    save_user_settings("sync-ts-user", {"trading_mode": "paper"})

    for key in ("created_at", "updated_at"):
        value = captured["record"][key]
        # Parseable as an ISO-8601 UTC timestamp (Postgres TIMESTAMPTZ accepts it)
        datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))
        assert "+00:00" in value or value.endswith("Z")
