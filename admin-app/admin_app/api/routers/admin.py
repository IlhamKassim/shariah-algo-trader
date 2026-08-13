"""Admin-only API router for the standalone admin app (§5.2 of SPEC-BETA-PILOT.md).

The mount in ``admin_app.api.main`` requires BOTH ``verify_auth`` (401
anonymous) and ``is_admin`` (403 non-admin) on every route — nothing here
re-implements auth.

Endpoints (base ``/api/admin``):

- A1 ``GET /testers``            — tester list with lifecycle state, key
                                   status and last activity.
- A2 ``POST /testers/{id}/approve`` — approve a pending tester: activates
                                   engine visibility (local user_settings row
                                   ensured + enabled), idempotent.
- A3 ``POST /testers/{id}/revoke``  — revoke a tester: state='revoked' and
                                   shariah_trader_enabled=0 (AC-8: next engine
                                   cycle drops them), keeps all data.
- A4 ``GET /testers/{id}/portfolio``  — per-tester paper portfolio (equity,
                                   positions, P/L) via a server-side Alpaca
                                   call with that tester's PAPER creds.
- A5 ``GET /testers/{id}/compliance`` — per-tester compliance, reusing the
                                   shared ``compute_compliance`` helper.
- A6 ``GET /testers/{id}/activity``   — per-tester activity feed from
                                   ``audit_logs WHERE actor = user_id``.
- A7 ``POST /invites``            — issue a pilot invite (single-use by default).

Guardrail G5: A4/A5 never touch live columns — they decrypt only
``alpaca_api_key_encrypted``/``alpaca_api_secret_encrypted`` (via
``get_paper_credentials``) and hard-code ``https://paper-api.alpaca.markets``
as the base URL.
"""

import datetime
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from dashboard.api.cache import get_universe_cache
from dashboard.api.compliance_core import compute_compliance
from dashboard.api.db import fetch_audit_logs_for_actor, log_audit_event
from dashboard.api.user_store import (
    create_pilot_invite,
    ensure_user_settings_row,
    get_paper_credentials,
    get_pilot_invite,
    get_pilot_user,
    get_user_settings_meta,
    list_pilot_invites,
    list_pilot_users,
    set_pilot_user_state,
)
from shariah_algo_trader.execution.alpaca_client import AlpacaClient, AlpacaError

router = APIRouter()
logger = logging.getLogger(__name__)

# G5: the ONLY Alpaca base URL the admin app may use — hard-coded paper endpoint.
PAPER_BASE_URL = "https://paper-api.alpaca.markets"


class CreateInviteRequest(BaseModel):
    """A7 request body — all fields optional (mirrors create_pilot_invite)."""

    max_uses: int = Field(default=1, ge=1, description="How many testers may use the code")
    expires_at: str | None = Field(default=None, description="ISO-8601 expiry; default 30 days")
    code: str | None = Field(default=None, description="Custom code; default 8-char URL-safe token")


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _utcnow_iso() -> str:
    return datetime.datetime.now(tz=datetime.timezone.utc).isoformat()


def _require_pilot_user(user_id: str) -> dict:
    user = get_pilot_user(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail=f"No pilot user with id {user_id!r}")
    return user


def _paper_client_for(user_id: str) -> AlpacaClient:
    """Build a client with the tester's decrypted PAPER creds and the hard-coded
    paper base URL (guardrail G5) — live columns are never read."""
    creds = get_paper_credentials(user_id)
    if creds is None:
        raise HTTPException(
            status_code=409,
            detail="Tester has no Alpaca paper credentials on file",
        )
    return AlpacaClient(creds["alpaca_api_key"], creds["alpaca_api_secret"], PAPER_BASE_URL)


def _serialize_invite(invite: dict) -> dict:
    return {
        "code": invite["code"],
        "created_by": invite["created_by"],
        "max_uses": invite["max_uses"],
        "uses": invite["uses"],
        "expires_at": invite["expires_at"],
        "created_at": invite["created_at"],
        "expired": invite["expires_at"] < _utcnow_iso(),
    }


# ── A1: tester list ──────────────────────────────────────────────────────────

@router.get("/testers")
def list_testers() -> dict:
    """All pilot users with lifecycle state, key status and last activity (A1)."""
    testers = []
    for user in list_pilot_users():
        meta = get_user_settings_meta(user["user_id"]) or {}
        activity = fetch_audit_logs_for_actor(user["user_id"], limit=1)
        testers.append({
            "user_id": user["user_id"],
            "email": user["email"],
            "role": user["role"],
            "state": user["state"],
            "invite_code": user["invite_code"],
            "linkedin_url": user["linkedin_url"],
            "notes": user["notes"],
            "approved_by": user["approved_by"],
            "created_at": user["created_at"],
            "updated_at": user["updated_at"],
            "trading_mode": meta.get("trading_mode", "paper"),
            "shariah_trader_enabled": meta.get("shariah_trader_enabled", 0),
            "has_paper_keys": meta.get("has_paper_keys", False),
            "has_live_keys": meta.get("has_live_keys", False),
            "last_activity_at": activity[0]["created_at"] if activity else None,
        })
    return {"testers": testers, "count": len(testers)}


# ── A2: approve ──────────────────────────────────────────────────────────────

@router.post("/testers/{user_id}/approve")
def approve_tester(user_id: str, request: Request) -> dict:
    """Approve a pending tester: state='active' + engine visibility on (A2).

    Idempotent — approving an already-active tester is a no-op (200 with
    ``already_active=True``) and is not re-audited.
    """
    user = _require_pilot_user(user_id)
    if user["state"] == "active":
        return {"user_id": user_id, "state": "active", "already_active": True}

    admin_id = getattr(request.state, "user_id", None) or "unknown-admin"
    set_pilot_user_state(user_id, "active", approved_by=admin_id)
    ensure_user_settings_row(user_id, enabled=True)  # activates engine visibility
    log_audit_event(
        "TESTER_APPROVED",
        admin_id,
        _client_ip(request),
        f"Tester {user_id} ({user['email']}) approved",
    )
    return {"user_id": user_id, "state": "active"}


# ── A3: revoke ───────────────────────────────────────────────────────────────

@router.post("/testers/{user_id}/revoke")
def revoke_tester(user_id: str, request: Request) -> dict:
    """Revoke a tester: state='revoked' + shariah_trader_enabled=0 (A3).

    The engine skips the row on its very next cycle (AC-8); the user's settings
    and keys are retained ("keeps data").
    """
    user = _require_pilot_user(user_id)
    admin_id = getattr(request.state, "user_id", None) or "unknown-admin"
    set_pilot_user_state(user_id, "revoked")
    ensure_user_settings_row(user_id, enabled=False)  # stops engine trading next cycle
    log_audit_event(
        "TESTER_REVOKED",
        admin_id,
        _client_ip(request),
        f"Tester {user_id} ({user['email']}) revoked",
    )
    return {"user_id": user_id, "state": "revoked"}


# ── A4: per-tester paper portfolio (G5) ──────────────────────────────────────

@router.get("/testers/{user_id}/portfolio")
def tester_portfolio(user_id: str) -> dict:
    """Per-tester paper portfolio: equity, positions and unrealized P/L (A4)."""
    _require_pilot_user(user_id)
    client = _paper_client_for(user_id)
    try:
        account = client.get("/v2/account")
        positions = client.get("/v2/positions")
    except AlpacaError as exc:
        logger.warning("Admin A4: paper account fetch failed for %s (%s)", user_id, exc)
        raise HTTPException(
            status_code=502,
            detail=f"Alpaca paper account unavailable: {exc}",
        ) from exc

    unrealized_pl = round(sum(float(p.get("unrealized_pl") or 0.0) for p in positions), 2)
    return {
        "user_id": user_id,
        "paper_base_url": PAPER_BASE_URL,
        "account": account,
        "positions": positions,
        "unrealized_pl": unrealized_pl,
    }


# ── A5: per-tester compliance (shared helper, G5) ────────────────────────────

@router.get("/testers/{user_id}/compliance")
def tester_compliance(user_id: str, cache=Depends(get_universe_cache)) -> dict:
    """Per-tester compliance status against the cached eligible universe (A5).

    Reuses ``compute_compliance`` — the exact same logic as the tester-facing
    ``GET /api/compliance`` (DRY).
    """
    _require_pilot_user(user_id)
    client = _paper_client_for(user_id)
    try:
        positions = client.get("/v2/positions")
    except AlpacaError as exc:
        logger.warning("Admin A5: positions fetch failed for %s (%s)", user_id, exc)
        raise HTTPException(
            status_code=502,
            detail=f"Alpaca paper account unavailable: {exc}",
        ) from exc

    eligible = cache.raw_universe if cache.raw_universe else {s["symbol"] for s in cache.stocks}
    result = compute_compliance(
        held_symbols=[p["symbol"] for p in positions],
        eligible_symbols=eligible,
        universe_size=len(eligible),
        last_checked=cache.last_computed_at.isoformat() if cache.last_computed_at else None,
    )
    result["user_id"] = user_id
    result["paper_base_url"] = PAPER_BASE_URL
    return result


# ── A6: per-tester activity feed ─────────────────────────────────────────────

@router.get("/testers/{user_id}/activity")
def tester_activity(user_id: str) -> dict:
    """Per-tester activity feed from audit_logs (actor = user_id) (A6)."""
    _require_pilot_user(user_id)
    events = [dict(row) for row in fetch_audit_logs_for_actor(user_id, limit=100)]
    return {"user_id": user_id, "events": events, "count": len(events)}


# ── A7: invite issuance + listing ────────────────────────────────────────────

@router.post("/invites")
def create_invite(body: CreateInviteRequest, request: Request) -> dict:
    """Issue a pilot invite (A7). Returns the code + its metadata."""
    admin_id = getattr(request.state, "user_id", None) or "unknown-admin"
    code = create_pilot_invite(
        created_by=admin_id,
        max_uses=body.max_uses,
        expires_at=body.expires_at,
        code=body.code,
    )
    invite = get_pilot_invite(code)
    if invite is None:  # pragma: no cover — create_pilot_invite just inserted it
        raise RuntimeError(f"Invite {code} was created but cannot be read back")
    log_audit_event(
        "INVITE_CREATED",
        admin_id,
        _client_ip(request),
        f"Pilot invite {code} issued (max_uses={invite['max_uses']}, expires={invite['expires_at']})",
    )
    return _serialize_invite(invite)


@router.get("/invites")
def list_invites() -> dict:
    """All pilot invites with usage + expiry status (backs the Invites view)."""
    invites = [_serialize_invite(i) for i in list_pilot_invites()]
    return {"invites": invites, "count": len(invites)}
