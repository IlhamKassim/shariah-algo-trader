#!/usr/bin/env python3
"""Disable the known junk test-tenant rows in the local user store.

Per decision Q8=A (beta pilot): the 5 test rows historically present in
``data/user_settings.db`` are DISABLED now (``shariah_trader_enabled = 0``)
and may be deleted only after the pilot is stable. They are not deleted by
this script.

Safety: DRY-RUN by default — pass ``--apply`` to actually write. Only the
five hard-coded junk user ids are ever touched; every other row is left
untouched.

Usage:
    uv run python scripts/purge_test_tenants.py            # dry-run
    uv run python scripts/purge_test_tenants.py --apply    # disable the rows
"""

import argparse
import datetime
import sqlite3
from pathlib import Path

JUNK_USER_IDS = (
    "user_tenant_1",
    "user_tenant_2",
    "test_user_account_isolation",
    "user_111",
    "user_222",
)


def _default_db_path() -> Path:
    return Path(__file__).resolve().parent.parent / "data" / "user_settings.db"


def purge_test_tenants(db_path=None, apply: bool = False) -> dict:
    """Disable (set ``shariah_trader_enabled = 0``) the junk test rows.

    Args:
        db_path: Path to ``user_settings.db`` (defaults to the repo-local one).
        apply: When False (default) nothing is written; the report describes
            what WOULD change.

    Returns:
        A report dict: ``dry_run``, ``rows`` (per junk id: user_id,
        was_enabled, action in {disable, already-disabled, missing}) and
        summary counts (found, disabled_now, already_disabled, missing,
        junk_total).

    Raises:
        FileNotFoundError: if the database file does not exist.
    """
    db_path = Path(db_path) if db_path is not None else _default_db_path()
    if not db_path.exists():
        raise FileNotFoundError(f"user_settings.db not found at {db_path}")

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    try:
        placeholders = ",".join("?" * len(JUNK_USER_IDS))
        rows = conn.execute(
            f"SELECT user_id, shariah_trader_enabled FROM user_settings "
            f"WHERE user_id IN ({placeholders})",
            JUNK_USER_IDS,
        ).fetchall()
    finally:
        conn.close()

    enabled_by_id = {r["user_id"]: bool(r["shariah_trader_enabled"]) for r in rows}

    report_rows = []
    for uid in JUNK_USER_IDS:
        if uid not in enabled_by_id:
            report_rows.append({"user_id": uid, "was_enabled": None, "action": "missing"})
        elif enabled_by_id[uid]:
            report_rows.append({"user_id": uid, "was_enabled": True, "action": "disable"})
        else:
            report_rows.append({"user_id": uid, "was_enabled": False, "action": "already-disabled"})

    to_disable = [uid for uid in JUNK_USER_IDS if enabled_by_id.get(uid)]

    if apply and to_disable:
        now = datetime.datetime.now(tz=datetime.timezone.utc).isoformat()
        placeholders = ",".join("?" * len(to_disable))
        conn = sqlite3.connect(str(db_path))
        try:
            conn.execute(
                f"UPDATE user_settings SET shariah_trader_enabled = 0, updated_at = ? "
                f"WHERE user_id IN ({placeholders})",
                (now, *to_disable),
            )
            conn.commit()
        finally:
            conn.close()

    return {
        "dry_run": not apply,
        "rows": report_rows,
        "found": len(enabled_by_id),
        "disabled_now": sum(1 for r in report_rows if r["action"] == "disable"),
        "already_disabled": sum(1 for r in report_rows if r["action"] == "already-disabled"),
        "missing": sum(1 for r in report_rows if r["action"] == "missing"),
        "junk_total": len(JUNK_USER_IDS),
    }


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Disable the 5 known junk test-tenant rows in the local user store "
            "(beta pilot Q8=A: disable now, delete after the pilot is stable)."
        )
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write the changes (default: dry-run, prints what would change).",
    )
    parser.add_argument(
        "--db",
        default=None,
        help="Path to user_settings.db (default: <repo>/data/user_settings.db).",
    )
    args = parser.parse_args(argv)

    try:
        result = purge_test_tenants(args.db, apply=args.apply)
    except FileNotFoundError as exc:
        print(f"ERROR: {exc}")
        return 1

    mode = "DRY-RUN" if result["dry_run"] else "APPLIED"
    print(f"[{mode}] Junk test-tenant cleanup (Q8=A: disable now, delete after pilot stable)")
    for row in result["rows"]:
        if row["action"] == "missing":
            print(f"  - {row['user_id']}: NOT FOUND in user_settings")
        elif row["action"] == "already-disabled":
            print(f"  - {row['user_id']}: already disabled (shariah_trader_enabled=0)")
        elif result["dry_run"]:
            print(f"  - {row['user_id']}: WOULD disable (shariah_trader_enabled=1)")
        else:
            print(f"  - {row['user_id']}: DISABLED (shariah_trader_enabled=0)")
    print(
        "Summary: "
        f"{result['found']}/{result['junk_total']} junk rows present, "
        f"{result['already_disabled']} already disabled, "
        f"{result['disabled_now']} disabled now, {result['missing']} missing."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
