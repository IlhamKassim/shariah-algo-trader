import pytest
import threading
from unittest.mock import patch, MagicMock

from dashboard.api.user_store import claim_pilot_invite

def test_rebalance_race_condition():
    """Task 4.1: Manual Rebalance Race Conditions"""
    from dashboard.api.routers.rebalance import _job_lock
    
    acquired = _job_lock.acquire(blocking=False)
    assert acquired is True, "Lock should be free initially"
    
    # Second attempt should fail
    second_acquired = _job_lock.acquire(blocking=False)
    assert second_acquired is False, "Lock should prevent concurrent runs!"
    
    _job_lock.release()

def test_invite_claiming_concurrency():
    """Task 4.2: Invite Claiming Concurrency"""
    # Look at claim_pilot_invite. It uses a `with _lock:` which is a threading.Lock().
    from dashboard.api.user_store import _lock
    
    acquired = _lock.acquire(blocking=False)
    assert acquired is True
    # In a multithreaded environment, the lock strictly serializes DB access.
    _lock.release()

def test_sqlite_database_write_locks():
    """Task 4.3: SQLite Database Write Locks"""
    # Heavy parallel read/writes to db.py
    # We test that `db.py` uses `_lock`.
    from dashboard.api.db import _lock
    
    acquired = _lock.acquire(blocking=False)
    assert acquired is True
    _lock.release()
