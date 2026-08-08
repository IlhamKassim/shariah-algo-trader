import datetime
import os
import logging
from fastapi import APIRouter, Depends, HTTPException, Request

from dashboard.api.db import log_audit_event
from dashboard.api.deps import get_config, get_alpaca
from dashboard.api.models import SettingsResponse, SettingsUpdateRequest
from shariah_algo_trader.config import Config

router = APIRouter()
logger = logging.getLogger(__name__)

ENV_PATH = "/home/ubuntu/shariah-algo-trader/.env"


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def mask_value(val: str | None) -> str:
    if val:
        return "••••••••••••"
    return ""

def mask_email(email: str | None) -> str:
    if not email or "@" not in email:
        return ""
    user, domain = email.split("@", 1)
    if len(user) <= 2:
        masked_user = user[0] + "••••" if user else "••••"
    else:
        masked_user = user[0] + "••••" + user[-1]
    return f"{masked_user}@{domain}"

def is_masked(val: str | None) -> bool:
    if not val:
        return True
    return "•" in val or "*" in val or val == "••••••••••••"


def update_env_file(filepath: str, updates: dict[str, str]):
    lines = []
    if os.path.exists(filepath):
        with open(filepath, "r", encoding="utf-8") as f:
            lines = f.readlines()
            
    updated_keys = set()
    new_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped and not stripped.startswith("#") and "=" in line:
            key, val = stripped.split("=", 1)
            key = key.strip()
            if key in updates:
                new_lines.append(f"{key}={updates[key]}\n")
                updated_keys.add(key)
                continue
        new_lines.append(line)
        
    for key, val in updates.items():
        if key not in updated_keys:
            if new_lines and not new_lines[-1].endswith("\n"):
                new_lines[-1] += "\n"
            new_lines.append(f"{key}={val}\n")
            
    with open(filepath, "w", encoding="utf-8") as f:
        f.writelines(new_lines)


def _sanitize_val(val: str | None) -> str:
    if not val:
        return ""
    return val.replace("\r", "").replace("\n", "").strip()


from dashboard.api.user_store import get_user_settings, save_user_settings
from dashboard.api.deps import is_admin
from dashboard.api.hardening import validate_alpaca_base_url

# Fields in SettingsUpdateRequest that are global/administrator configuration
# and must never be readable or writable by regular (non-admin) users.
_ADMIN_ONLY_FIELDS = (
    "dashboard_password",
    "google_client_id",
    "google_client_secret",
    "google_redirect_uri",
    "allowed_google_emails",
)


@router.get("/api/settings", response_model=SettingsResponse, response_model_exclude_none=True)
def get_settings(request: Request, cfg: Config = Depends(get_config)) -> SettingsResponse:
    user_id = getattr(request.state, "user_id", None) if hasattr(request, "state") else None
    admin = is_admin(request, cfg)
    user_data = get_user_settings(user_id) if user_id else None

    trading_mode = "paper"
    raw_live_key = ""
    raw_live_secret = ""
    shariah_trader_enabled = True
    day_trader_enabled = False

    if user_id:
        if user_data:
            trading_mode = user_data.get("trading_mode") or "paper"
            raw_key = user_data.get("alpaca_api_key") or ""
            raw_secret = user_data.get("alpaca_api_secret") or ""
            raw_live_key = user_data.get("alpaca_live_api_key") or ""
            raw_live_secret = user_data.get("alpaca_live_api_secret") or ""
            base_url = user_data.get("alpaca_base_url") or ("https://api.alpaca.markets" if trading_mode == "live" else cfg.alpaca_base_url)
            etf_symbol = user_data.get("etf_symbol") or cfg.etf_symbol
            top_n = user_data.get("top_n") or cfg.top_n
            sector_cap = user_data.get("sector_cap") if user_data.get("sector_cap") is not None else cfg.sector_cap
            drift_threshold = user_data.get("drift_threshold") if user_data.get("drift_threshold") is not None else cfg.drift_threshold
            shariah_trader_enabled = bool(user_data.get("shariah_trader_enabled") if user_data.get("shariah_trader_enabled") is not None else True)
            day_trader_enabled = bool(user_data.get("day_trader_enabled") if user_data.get("day_trader_enabled") is not None else False)
        else:
            raw_key = ""
            raw_secret = ""
            base_url = cfg.alpaca_base_url
            etf_symbol = cfg.etf_symbol
            top_n = cfg.top_n
            sector_cap = cfg.sector_cap
            drift_threshold = cfg.drift_threshold
    else:
        raw_key = cfg.alpaca_api_key
        raw_secret = os.environ.get("ALPACA_API_SECRET", "")
        base_url = cfg.alpaca_base_url
        etf_symbol = cfg.etf_symbol
        top_n = cfg.top_n
        sector_cap = cfg.sector_cap
        drift_threshold = cfg.drift_threshold

    raw_pass = os.environ.get("DASHBOARD_PASSWORD", "")
    raw_google_secret = os.environ.get("GOOGLE_CLIENT_SECRET", "")

    return SettingsResponse(
        trading_mode=trading_mode,
        alpaca_api_key_masked=mask_value(raw_key),
        alpaca_api_secret_masked=mask_value(raw_secret),
        alpaca_live_api_key_masked=mask_value(raw_live_key),
        alpaca_live_api_secret_masked=mask_value(raw_live_secret),
        alpaca_base_url=base_url,
        etf_symbol=etf_symbol,
        top_n=top_n,
        etf_symbols=cfg.etf_symbols,
        sector_cap=sector_cap,
        drift_threshold=drift_threshold,
        shariah_trader_enabled=shariah_trader_enabled,
        day_trader_enabled=day_trader_enabled,
        # Admin-only block: omitted entirely (exclude_none) for non-admins.
        dashboard_password_masked=mask_value(raw_pass) if admin else None,
        google_client_id_masked=mask_value(cfg.google_client_id) if admin else None,
        google_client_secret_masked=mask_value(raw_google_secret) if admin else None,
        google_redirect_uri=cfg.google_redirect_uri if admin else None,
        allowed_google_emails=[mask_email(e) for e in cfg.allowed_google_emails if e] if admin else None,
    )


@router.post("/api/settings")
def update_settings(
    request: Request,
    payload: SettingsUpdateRequest,
    cfg: Config = Depends(get_config)
):
    user_id = getattr(request.state, "user_id", None) if hasattr(request, "state") else None

    # Save to user_store if request is bound to a Supabase/auth user_id
    if user_id:
        # Regular users must not be able to write global/admin configuration —
        # reject outright instead of silently ignoring (which previously
        # returned 200 "success" for ignored writes).
        if not is_admin(request, cfg) and any(
            getattr(payload, field) is not None for field in _ADMIN_ONLY_FIELDS
        ):
            raise HTTPException(
                status_code=403,
                detail="Admin-only settings (password, Google OAuth, allowed emails) cannot be modified by regular users.",
            )

        user_updates = {}
        if payload.trading_mode is not None:
            if payload.trading_mode not in ("paper", "live"):
                raise HTTPException(status_code=400, detail="trading_mode must be 'paper' or 'live'")
            user_updates["trading_mode"] = payload.trading_mode
        if payload.alpaca_api_key is not None and not is_masked(payload.alpaca_api_key):
            user_updates["alpaca_api_key"] = _sanitize_val(payload.alpaca_api_key)
        if payload.alpaca_api_secret is not None and not is_masked(payload.alpaca_api_secret):
            user_updates["alpaca_api_secret"] = _sanitize_val(payload.alpaca_api_secret)
        if payload.alpaca_live_api_key is not None and not is_masked(payload.alpaca_live_api_key):
            user_updates["alpaca_live_api_key"] = _sanitize_val(payload.alpaca_live_api_key)
        if payload.alpaca_live_api_secret is not None and not is_masked(payload.alpaca_live_api_secret):
            user_updates["alpaca_live_api_secret"] = _sanitize_val(payload.alpaca_live_api_secret)
        if payload.alpaca_base_url is not None:
            clean_url = _sanitize_val(payload.alpaca_base_url)
            validated_url = validate_alpaca_base_url(clean_url)
            if not validated_url:
                raise HTTPException(
                    status_code=400,
                    detail="alpaca_base_url must be an https URL on an *.alpaca.markets host.",
                )
            user_updates["alpaca_base_url"] = validated_url
        if payload.etf_symbol is not None:
            user_updates["etf_symbol"] = _sanitize_val(payload.etf_symbol).upper()
        if payload.top_n is not None:
            if payload.top_n <= 0:
                raise HTTPException(status_code=400, detail="TOP_N must be greater than 0")
            user_updates["top_n"] = payload.top_n
        if payload.sector_cap is not None:
            if not (0.0 <= payload.sector_cap <= 1.0):
                raise HTTPException(status_code=400, detail="SECTOR_CAP must be between 0.0 and 1.0")
            user_updates["sector_cap"] = payload.sector_cap
        if payload.drift_threshold is not None:
            if not (0.0 <= payload.drift_threshold <= 1.0):
                raise HTTPException(status_code=400, detail="DRIFT_THRESHOLD must be between 0.0 and 1.0")
            user_updates["drift_threshold"] = payload.drift_threshold
        if payload.shariah_trader_enabled is not None:
            user_updates["shariah_trader_enabled"] = payload.shariah_trader_enabled
        if payload.day_trader_enabled is not None:
            user_updates["day_trader_enabled"] = payload.day_trader_enabled

        save_user_settings(user_id, user_updates)
        log_audit_event("USER_SETTINGS_UPDATE", user_id, _client_ip(request), f"Updated user settings: {list(user_updates.keys())}")
        return {"status": "success"}

    # Legacy global .env updates fallback if no user_id is present
    if cfg.dashboard_password:
        if not payload.current_password or payload.current_password != cfg.dashboard_password:
            log_audit_event("SUDO_VERIFY_FAILURE", "admin", _client_ip(request), "Failed SUDO mode password re-verification")
            raise HTTPException(status_code=401, detail="Password re-verification (SUDO mode) required to update settings.")

    updates = {}
    if payload.alpaca_api_key is not None and not is_masked(payload.alpaca_api_key):
        updates["ALPACA_API_KEY"] = _sanitize_val(payload.alpaca_api_key)
    if payload.alpaca_api_secret is not None and not is_masked(payload.alpaca_api_secret):
        updates["ALPACA_API_SECRET"] = _sanitize_val(payload.alpaca_api_secret)
    if payload.alpaca_base_url is not None:
        clean_url = _sanitize_val(payload.alpaca_base_url)
        validated_url = validate_alpaca_base_url(clean_url)
        if not validated_url:
            raise HTTPException(
                status_code=400,
                detail="alpaca_base_url must be an https URL on an *.alpaca.markets host.",
            )
        updates["ALPACA_BASE_URL"] = validated_url
    if payload.etf_symbol is not None:
        updates["ETF_SYMBOL"] = _sanitize_val(payload.etf_symbol).upper()
    if payload.top_n is not None:
        if payload.top_n <= 0:
            raise HTTPException(status_code=400, detail="TOP_N must be greater than 0")
        updates["TOP_N"] = str(payload.top_n)
    if payload.etf_symbols is not None:
        updates["ETF_SYMBOLS"] = ",".join([_sanitize_val(s).upper() for s in payload.etf_symbols if s and _sanitize_val(s)])
    if payload.sector_cap is not None:
        if not (0.0 <= payload.sector_cap <= 1.0):
            raise HTTPException(status_code=400, detail="SECTOR_CAP must be between 0.0 and 1.0")
        updates["SECTOR_CAP"] = f"{payload.sector_cap:.2f}"
    if payload.drift_threshold is not None:
        if not (0.0 <= payload.drift_threshold <= 1.0):
            raise HTTPException(status_code=400, detail="DRIFT_THRESHOLD must be between 0.0 and 1.0")
        updates["DRIFT_THRESHOLD"] = f"{payload.drift_threshold:.4f}"
    if payload.dashboard_password is not None and not is_masked(payload.dashboard_password):
        updates["DASHBOARD_PASSWORD"] = _sanitize_val(payload.dashboard_password)
    if payload.google_client_id is not None:
        updates["GOOGLE_CLIENT_ID"] = _sanitize_val(payload.google_client_id)
    if payload.google_client_secret is not None and not is_masked(payload.google_client_secret):
        updates["GOOGLE_CLIENT_SECRET"] = _sanitize_val(payload.google_client_secret)
    if payload.google_redirect_uri is not None:
        updates["GOOGLE_REDIRECT_URI"] = _sanitize_val(payload.google_redirect_uri)
    if payload.allowed_google_emails is not None:
        unmasked = [_sanitize_val(e).lower() for e in payload.allowed_google_emails if e and _sanitize_val(e) and not is_masked(e)]
        if unmasked:
            updates["ALLOWED_GOOGLE_EMAILS"] = ",".join(unmasked)

    if updates:
        try:
            update_env_file(ENV_PATH, updates)
            logger.info("Updated .env configurations: %s", list(updates.keys()))
            log_audit_event("SETTINGS_UPDATE", "admin", _client_ip(request), f"Updated configuration keys: {list(updates.keys())}")
            for k, v in updates.items():
                os.environ[k] = v
            if hasattr(get_config, "cache_clear"):
                get_config.cache_clear()
            if hasattr(get_alpaca, "cache_clear"):
                get_alpaca.cache_clear()
        except Exception as exc:
            logger.error("Failed to write configurations to .env: %s", exc)
            raise HTTPException(status_code=500, detail="Failed to save settings due to an internal error.")

    return {"status": "success"}


@router.post("/api/settings/mode")
def set_trading_mode(
    request: Request,
    payload: dict,
):
    user_id = getattr(request.state, "user_id", None) if hasattr(request, "state") else None
    mode = payload.get("mode")
    if mode not in ("paper", "live"):
        raise HTTPException(status_code=400, detail="mode must be 'paper' or 'live'")

    base_url = "https://api.alpaca.markets" if mode == "live" else "https://paper-api.alpaca.markets"
    risk_ack = bool(payload.get("riskAcknowledged") or payload.get("risk_acknowledged"))

    if user_id:
        existing = get_user_settings(user_id) or {}
        user_updates = {"trading_mode": mode, "alpaca_base_url": base_url}
        if mode == "live":
            # Server-side risk-acknowledgment gate: the consent is persisted
            # (user_id + timestamp), never trusted from client-side localStorage.
            if not existing.get("risk_acknowledged_at") and not risk_ack:
                raise HTTPException(
                    status_code=400,
                    detail="Risk acknowledgment required before enabling live trading. Please confirm the real-money risk disclosure.",
                )
            if risk_ack and not existing.get("risk_acknowledged_at"):
                user_updates["risk_acknowledged_at"] = datetime.datetime.now(tz=datetime.timezone.utc).isoformat()
        try:
            save_user_settings(user_id, user_updates)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        log_audit_event("TRADING_MODE_SWITCH", user_id, _client_ip(request), f"Switched trading mode to {mode}")
    else:
        if mode == "live" and not risk_ack:
            raise HTTPException(
                status_code=400,
                detail="Risk acknowledgment required before enabling live trading. Please confirm the real-money risk disclosure.",
            )
        update_env_file(ENV_PATH, {"ALPACA_BASE_URL": base_url})
        os.environ["ALPACA_BASE_URL"] = base_url
        log_audit_event("TRADING_MODE_SWITCH", "admin", _client_ip(request), f"Switched global trading mode to {mode}")

    return {"status": "success", "trading_mode": mode, "alpaca_base_url": base_url}
