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
from dashboard.api.db import (
    count_audit_logs_filtered,
    fetch_audit_logs,
    fetch_audit_logs_filtered,
    fetch_audit_logs_for_actor,
    list_audit_event_types,
    log_audit_event,
)
from dashboard.api.user_store import (
    create_pilot_invite,
    delete_pilot_invite,
    delete_pilot_user,
    ensure_user_settings_row,
    get_paper_credentials,
    get_pilot_invite,
    get_pilot_user,
    get_trading_prefs,
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

# In-memory TTL cache for aggregate risk & analytics (60 seconds)
_risk_cache: dict = {"generated_at": None, "payload": None}


def _derive_cust_id(user_id: str) -> str:
    cleaned = user_id.replace("-", "")[:8].upper()
    if len(cleaned) == 8:
        return f"{cleaned[:4]}-{cleaned[4:8]}"
    return cleaned.upper()



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
            "first_name": meta.get("first_name"),
            "last_name": meta.get("last_name"),
            "quant_handle": meta.get("quant_handle"),
            "country": meta.get("country"),
            "investor_type": meta.get("investor_type"),
            "paper_capital": meta.get("paper_capital", 100000.0),
            "onboarding_completed_at": meta.get("onboarding_completed_at"),
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


@router.delete("/testers/{user_id}")
@router.delete("/customers/{user_id}")
def remove_customer(user_id: str, request: Request) -> dict:
    """Remove a customer/tester completely from SQLite and Supabase."""
    admin_id = getattr(request.state, "user_id", None) or "unknown-admin"

    if user_id == admin_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own administrator account")

    user = _require_pilot_user(user_id)

    if user.get("role") == "admin":
        raise HTTPException(status_code=403, detail="Cannot delete a platform administrator")

    delete_pilot_user(user_id)

    log_audit_event(
        "TESTER_REMOVED",
        admin_id,
        _client_ip(request),
        f"Customer {user_id} ({user['email']}) deleted from local database and Supabase",
    )
    return {"user_id": user_id, "deleted": True}




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


@router.delete("/invites/{code}")
def remove_invite(code: str, request: Request) -> dict:
    """Delete a pilot invite code locally and from Supabase."""
    invite = get_pilot_invite(code)
    if not invite:
        raise HTTPException(status_code=404, detail=f"Invite code {code!r} not found")

    admin_id = getattr(request.state, "user_id", None) or "unknown-admin"
    delete_pilot_invite(code)

    log_audit_event(
        "INVITE_DELETED",
        admin_id,
        _client_ip(request),
        f"Pilot invite {code} deleted from local database and Supabase",
    )
    return {"code": code, "deleted": True}



# ── B1: consolidated customer CRM profile ────────────────────────────────────

@router.get("/customers/{user_id}/profile")
def customer_profile(user_id: str, cache=Depends(get_universe_cache)) -> dict:
    """Consolidated profile for the CRM profile panel (B1).

    Gracefully degrades if paper keys are absent or Alpaca paper account
    is temporarily unreachable (does not 502 the entire profile).
    """
    user = _require_pilot_user(user_id)
    meta = get_user_settings_meta(user_id) or {}
    prefs = get_trading_prefs(user_id)
    activity = fetch_audit_logs_for_actor(user_id, limit=1)

    portfolio: dict = {"status": "no_keys"}
    compliance: dict = {"status": "no_keys"}

    if meta.get("has_paper_keys"):
        try:
            client = _paper_client_for(user_id)
            account = client.get("/v2/account")
            positions = client.get("/v2/positions") or []
            unrealized_pl = round(
                sum(float(p.get("unrealized_pl") or 0.0) for p in positions), 2
            )
            portfolio = {
                "status": "ok",
                "equity": str(account.get("equity") or "0.00"),
                "cash": str(account.get("cash") or "0.00"),
                "buying_power": str(account.get("buying_power") or "0.00"),
                "position_count": len(positions),
                "unrealized_pl": unrealized_pl,
                "positions": positions,
                "paper_base_url": PAPER_BASE_URL,
            }

            eligible = (
                cache.raw_universe
                if cache.raw_universe
                else {s["symbol"] for s in cache.stocks}
            )
            comp_res = compute_compliance(
                held_symbols=[p["symbol"] for p in positions],
                eligible_symbols=eligible,
                universe_size=len(eligible),
                last_checked=(
                    cache.last_computed_at.isoformat()
                    if cache.last_computed_at
                    else None
                ),
            )
            compliance = {
                "status": "ok",
                "compliant": comp_res["compliant"],
                "violations": comp_res["violations"],
                "held_count": comp_res["held_count"],
                "universe_size": comp_res["universe_size"],
                "last_checked": comp_res["last_checked"],
            }
        except (AlpacaError, Exception) as exc:
            logger.warning("Customer profile paper fetch error for %s: %s", user_id, exc)
            portfolio = {"status": "unreachable"}
            compliance = {"status": "unreachable"}

    return {
        "user_id": user["user_id"],
        "cust_id": _derive_cust_id(user["user_id"]),
        "email": user["email"],
        "role": user["role"],
        "state": user["state"],
        "invite_code": user["invite_code"],
        "linkedin_url": user["linkedin_url"],
        "notes": user["notes"],
        "approved_by": user["approved_by"],
        "created_at": user["created_at"],
        "updated_at": user["updated_at"],
        "first_name": meta.get("first_name"),
        "last_name": meta.get("last_name"),
        "quant_handle": meta.get("quant_handle"),
        "country": meta.get("country"),
        "investor_type": meta.get("investor_type"),
        "paper_capital": meta.get("paper_capital", 100000.0),
        "onboarding_completed_at": meta.get("onboarding_completed_at"),
        "trading_mode": meta.get("trading_mode", "paper"),
        "shariah_trader_enabled": meta.get("shariah_trader_enabled", 0),
        "has_paper_keys": meta.get("has_paper_keys", False),
        "has_live_keys": meta.get("has_live_keys", False),
        "prefs": prefs,
        "portfolio": portfolio,
        "compliance": compliance,
        "last_activity_at": activity[0]["created_at"] if activity else None,
    }



# ── B2: aggregate analytics and risk ──────────────────────────────────────────

@router.get("/analytics/risk")
def analytics_risk(cache=Depends(get_universe_cache)) -> dict:
    """Aggregated analytics & risk with in-memory 60s TTL cache (B2)."""
    now = datetime.datetime.now(tz=datetime.timezone.utc)
    gen_at = _risk_cache.get("generated_at")
    if gen_at and _risk_cache.get("payload"):
        delta = (now - gen_at).total_seconds()
        if delta < 60:
            return _risk_cache["payload"]

    all_users = list_pilot_users()
    total_customers = len(all_users)
    active_traders = 0
    portfolio_value_usd = 0.0
    accounts_evaluated = 0
    accounts_unreachable = 0
    compliant_accounts = 0
    low_risk = 0
    med_risk = 0
    high_risk = 0

    alerts: list[dict] = []
    flagged: list[dict] = []

    eligible = (
        cache.raw_universe
        if cache.raw_universe
        else {s["symbol"] for s in cache.stocks}
    )

    for user in all_users:
        uid = user["user_id"]
        cid = _derive_cust_id(uid)
        meta = get_user_settings_meta(uid) or {}
        is_active = user["state"] == "active"
        is_enabled = meta.get("shariah_trader_enabled", 0) == 1

        if is_active and is_enabled:
            active_traders += 1

        activity = fetch_audit_logs_for_actor(uid, limit=1)
        last_act = activity[0]["created_at"] if activity else None

        if not meta.get("has_paper_keys"):
            if is_active:
                alerts.append({
                    "created_at": user["created_at"],
                    "severity": "warning",
                    "code": "NO_PAPER_KEYS",
                    "user_id": uid,
                    "message": f"{cid} — Active tester has no Alpaca paper credentials configured",
                })
                flagged.append({
                    "user_id": uid,
                    "cust_id": cid,
                    "risk_level": "MED",
                    "last_activity_at": last_act,
                    "exposure_usd": 0.0,
                    "state": user["state"],
                    "reasons": ["Missing paper credentials"],
                })
            continue

        # Try evaluating Alpaca paper portfolio
        try:
            client = _paper_client_for(uid)
            account = client.get("/v2/account")
            positions = client.get("/v2/positions") or []
            eq = float(account.get("equity") or 0.0)
            portfolio_value_usd += eq
            accounts_evaluated += 1

            comp_res = compute_compliance(
                held_symbols=[p["symbol"] for p in positions],
                eligible_symbols=eligible,
                universe_size=len(eligible),
                last_checked=None,
            )

            is_compliant = comp_res["compliant"]
            violations = comp_res["violations"]

            if is_compliant:
                compliant_accounts += 1
                if is_enabled:
                    low_risk += 1
                else:
                    med_risk += 1
                    flagged.append({
                        "user_id": uid,
                        "cust_id": cid,
                        "risk_level": "MED",
                        "last_activity_at": last_act,
                        "exposure_usd": eq,
                        "state": user["state"],
                        "reasons": ["Trader engine currently disabled"],
                    })
            else:
                high_risk += 1
                alerts.append({
                    "created_at": _utcnow_iso(),
                    "severity": "critical",
                    "code": "COMPLIANCE_VIOLATION",
                    "user_id": uid,
                    "message": f"{cid} — {len(violations)} non-compliant holdings: {', '.join(violations[:3])}",
                })
                flagged.append({
                    "user_id": uid,
                    "cust_id": cid,
                    "risk_level": "HIGH",
                    "last_activity_at": last_act,
                    "exposure_usd": eq,
                    "state": user["state"],
                    "reasons": [f"{len(violations)} non-compliant holdings"],
                })

        except (AlpacaError, Exception) as exc:
            accounts_unreachable += 1
            alerts.append({
                "created_at": _utcnow_iso(),
                "severity": "warning",
                "code": "ACCOUNT_UNREACHABLE",
                "user_id": uid,
                "message": f"{cid} — Paper trading account unreachable: {exc}",
            })
            flagged.append({
                "user_id": uid,
                "cust_id": cid,
                "risk_level": "MED",
                "last_activity_at": last_act,
                "exposure_usd": 0.0,
                "state": user["state"],
                "reasons": ["Alpaca paper API unreachable"],
            })

    # Pull recent TESTER_REVOKED events into alerts
    revoked_events = fetch_audit_logs_filtered(event_type="TESTER_REVOKED", limit=5)
    for rev in revoked_events:
        alerts.append({
            "created_at": rev["created_at"],
            "severity": "critical",
            "code": "TESTER_REVOKED",
            "user_id": rev["actor"],
            "message": f"TESTER REVOKED — {rev['details']}",
        })

    # Sort alerts by created_at DESC, cap at 8
    alerts.sort(key=lambda a: a.get("created_at") or "", reverse=True)
    alerts = alerts[:8]

    # Calculate compliance percentage and status
    if accounts_evaluated > 0:
        compliance_pct = round((compliant_accounts / accounts_evaluated) * 100.0, 1)
        if compliance_pct >= 95.0:
            compliance_status = "OPTIMAL"
        elif compliance_pct >= 80.0:
            compliance_status = "WATCH"
        else:
            compliance_status = "CRITICAL"
    else:
        compliance_pct = None
        compliance_status = "N/A"

    payload = {
        "generated_at": now.isoformat(),
        "cache_ttl_seconds": 60,
        "kpis": {
            "total_customers": total_customers,
            "active_traders": active_traders,
            "portfolio_value_usd": round(portfolio_value_usd, 2),
            "accounts_evaluated": accounts_evaluated,
            "accounts_unreachable": accounts_unreachable,
            "compliance_pct": compliance_pct,
            "compliance_status": compliance_status,
        },
        "risk_distribution": {
            "low": low_risk,
            "med": med_risk,
            "high": high_risk,
        },
        "alerts": alerts,
        "flagged": flagged,
    }

    _risk_cache["generated_at"] = now
    _risk_cache["payload"] = payload
    return payload


# ── B3: filterable audit logs ────────────────────────────────────────────────

@router.get("/audit")
def list_audit_logs(
    limit: int = 50,
    offset: int = 0,
    event_type: str | None = None,
    q: str | None = None,
    since: str | None = None,
) -> dict:
    """Filterable audit log endpoint with pagination and event types (B3)."""
    rows = fetch_audit_logs_filtered(
        event_type=event_type,
        q=q,
        since=since,
        limit=limit,
        offset=offset,
    )
    total = count_audit_logs_filtered(
        event_type=event_type,
        q=q,
        since=since,
    )
    event_types = list_audit_event_types()

    # Preload pilot user IDs for resolving actor_cust_id
    pilot_users = {u["user_id"]: _derive_cust_id(u["user_id"]) for u in list_pilot_users()}

    events = []
    for r in rows:
        actor = r["actor"]
        events.append({
            "id": r["id"],
            "event_type": r["event_type"],
            "actor": actor,
            "actor_cust_id": pilot_users.get(actor),
            "ip_address": r["ip_address"],
            "details": r["details"],
            "created_at": r["created_at"],
        })

    return {
        "events": events,
        "total": total,
        "limit": limit,
        "offset": offset,
        "event_types": event_types,
    }

