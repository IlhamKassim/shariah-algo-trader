"""Admin spectate proxy (SPEC-ADMIN-SPECTATE.md §5) — GET-only passthrough to
the main dashboard (:8000).

The spectate surface lets the two founders SPECTATE the live pilot from the
admin app: engine health, their own reference account, and the universe. It is
a pure proxy — DESIGN-AGNOSTIC, no aggregates, no caching, no writes.

- S1 ``GET /spectate/status``     -> ``GET /api/status``     (global engine state)
- S2 ``GET /spectate/account``    -> ``GET /api/account``    (caller's tenant)
- S3 ``GET /spectate/portfolio``  -> ``GET /api/portfolio``  (caller's tenant)
- S4 ``GET /spectate/universe``   -> ``GET /api/universe``   (global cached universe)
- S5 ``GET /spectate/compliance`` -> ``GET /api/compliance`` (caller's tenant)

The caller's ``Authorization`` header is forwarded VERBATIM — this is what
makes S2/S3/S5 resolve to the calling founder's OWN tenant (spec §2.2). Tokens
are never minted, cached, or persisted here.

Auth is inherited for free: this router rides the same ``/api/admin`` include
in main.py as admin.py, so every route is gated by ``verify_auth`` (401 anon)
+ ``require_admin`` (403 non-admin) at mount time. No new auth code.

GET-only, fixed path allowlist (no client path params) — the dashboard's POST
endpoints are NEVER proxied; the admin app stays a spectator.
"""

import logging

import requests
from fastapi import APIRouter, HTTPException, Request

router = APIRouter()
logger = logging.getLogger(__name__)

# The proxy target is hard-coded to the local dashboard — never configurable
# from a client, so a forwarded token can only ever be replayed against
# 127.0.0.1:8000 on this VM (spec §8 risk table).
DASHBOARD_BASE = "http://127.0.0.1:8000"
_PROXY_TIMEOUT = 5.0  # seconds


def _proxy(request: Request, path: str) -> dict | list:
    auth = request.headers.get("authorization", "")
    try:
        resp = requests.get(
            f"{DASHBOARD_BASE}{path}",
            headers={"Authorization": auth},
            timeout=_PROXY_TIMEOUT,
        )
    except requests.RequestException as exc:
        logger.warning("Admin spectate %s failed: dashboard unreachable (%s)", path, exc)
        raise HTTPException(502, f"Dashboard unreachable: {exc}") from exc
    if resp.status_code != 200:
        logger.warning("Admin spectate %s failed: dashboard returned %s", path, resp.status_code)
        raise HTTPException(502, f"Dashboard {path} returned {resp.status_code}")
    return resp.json()


@router.get("/spectate/status")
def spectate_status(request: Request) -> dict | list:
    """Engine status (S1): global scheduler/engine state from :8000."""
    return _proxy(request, "/api/status")


@router.get("/spectate/account")
def spectate_account(request: Request) -> dict | list:
    """Founder account (S2): resolves to the CALLING founder's own tenant."""
    return _proxy(request, "/api/account")


@router.get("/spectate/portfolio")
def spectate_portfolio(request: Request) -> dict | list:
    """Founder portfolio (S3): the calling founder's own positions."""
    return _proxy(request, "/api/portfolio")


@router.get("/spectate/universe")
def spectate_universe(request: Request) -> dict | list:
    """Eligible universe (S4): global cached universe from :8000."""
    return _proxy(request, "/api/universe")


@router.get("/spectate/compliance")
def spectate_compliance(request: Request) -> dict | list:
    """Founder compliance (S5): the calling founder's own compliance status."""
    return _proxy(request, "/api/compliance")
