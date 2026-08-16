#!/usr/bin/env python3
"""Flip a user's trading_mode to 'both' (enrolls Live) + sync to Supabase.

Usage: enroll_live_both.py [user_id]
Default user: aqil (5b7fb8dd-...)
"""
import datetime
import os
import sqlite3
import sys
from pathlib import Path

ROOT = Path("/home/ubuntu/shariah-algo-trader")
DB = ROOT / "data" / "user_settings.db"
USER = sys.argv[1] if len(sys.argv) > 1 else "5b7fb8dd-5f45-4225-a62e-5c908be06279"

env_path = ROOT / ".env"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

now = datetime.datetime.now(tz=datetime.timezone.utc).isoformat()

conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
conn.execute(
    "UPDATE user_settings SET trading_mode='both', updated_at=? WHERE user_id=?",
    (now, USER),
)
conn.commit()
row = conn.execute("SELECT * FROM user_settings WHERE user_id=?", (USER,)).fetchone()
conn.close()
print("LOCAL DB UPDATED:")
print(f"  trading_mode = {row['trading_mode']} | updated_at = {row['updated_at']}")

# Sync minimal column set Supabase actually has (migration 20260725)
cols = ['user_id', 'alpaca_api_key_encrypted', 'alpaca_api_secret_encrypted',
        'alpaca_live_api_key_encrypted', 'alpaca_live_api_secret_encrypted',
        'trading_mode', 'alpaca_base_url', 'etf_symbol', 'top_n', 'sector_cap',
        'drift_threshold', 'created_at', 'updated_at']
record = {c: row[c] for c in cols}
record["updated_at"] = now
from dashboard.api.user_store import _sync_to_supabase  # noqa: E402
_sync_to_supabase(USER, record)
print("Supabase sync attempted (SUPABASE_URL set:", bool(os.environ.get("SUPABASE_URL")), ")")

# Verify tenant discovery
from shariah_algo_trader.config import Config  # noqa: E402
from shariah_algo_trader.execution.tenant_manager import get_active_tenant_accounts  # noqa: E402

tenants = get_active_tenant_accounts(Config())
print("\nACTIVE TENANTS NOW:")
for t in tenants:
    print(f"  {t['user_id']:45s} mode={t['trading_mode']:5s} top_n={t['top_n']}")
ilham = [t for t in tenants if t.get("raw_user_id") == USER]
print(f"\nilham tenants: {len(ilham)} -> {[t['trading_mode'] for t in ilham]}")
assert any(t["trading_mode"] == "live" for t in ilham), "ILHAM LIVE NOT ENROLLED!"
print("OK: Ilham Live is enrolled.")
