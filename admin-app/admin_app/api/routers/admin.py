"""Admin-only API router for the standalone admin app (§5.2).

The mount in ``admin_app.api.main`` requires BOTH ``verify_auth`` (401
anonymous) and ``is_admin`` (403 non-admin) on every route — nothing here
re-implements auth.

This scaffold ships the A1 route as a placeholder so the gate is provable
end-to-end; the full A1-A7 endpoints land in Phase 3.
"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/testers")
def list_testers() -> dict:
    """Placeholder for A1 (tester list with lifecycle state).

    Implemented in Phase 3 against pilot_users/pilot_invites helpers and
    data/user_settings.db. Returns an empty list for now.
    """
    return {"testers": [], "count": 0}
