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

def is_masked(val: str | None) -> bool:
    if not val:
        return True
    return "•" in val or val == "••••••••••••"

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


@router.get("/api/settings", response_model=SettingsResponse)
def get_settings(cfg: Config = Depends(get_config)) -> SettingsResponse:
    # Read raw secrets from environment since they might be hidden/masked in cfg
    raw_secret = os.environ.get("ALPACA_API_SECRET", "")
    raw_pass = os.environ.get("DASHBOARD_PASSWORD", "")
    raw_google_secret = os.environ.get("GOOGLE_CLIENT_SECRET", "")

    return SettingsResponse(
        alpaca_api_key_masked=mask_value(cfg.alpaca_api_key),
        alpaca_api_secret_masked=mask_value(raw_secret),
        alpaca_base_url=cfg.alpaca_base_url,
        etf_symbol=cfg.etf_symbol,
        top_n=cfg.top_n,
        etf_symbols=cfg.etf_symbols,
        sector_cap=cfg.sector_cap,
        drift_threshold=cfg.drift_threshold,
        dashboard_password_masked=mask_value(raw_pass),
        google_client_id_masked=mask_value(cfg.google_client_id),
        google_client_secret_masked=mask_value(raw_google_secret),

        google_redirect_uri=cfg.google_redirect_uri,
        allowed_google_emails=list(cfg.allowed_google_emails),
    )


@router.post("/api/settings")
def update_settings(
    request: Request,
    payload: SettingsUpdateRequest,
    cfg: Config = Depends(get_config)
):
    # Enforce password re-verification (SUDO mode) if password authentication is enabled
    if cfg.dashboard_password:
        if not payload.current_password or payload.current_password != cfg.dashboard_password:
            log_audit_event("SUDO_VERIFY_FAILURE", "admin", _client_ip(request), "Failed SUDO mode password re-verification")
            raise HTTPException(status_code=401, detail="Password re-verification (SUDO mode) required to update settings.")

    updates = {}



    # Alpaca key
    if payload.alpaca_api_key is not None:
        updates["ALPACA_API_KEY"] = _sanitize_val(payload.alpaca_api_key)
        
    # Alpaca secret (if not masked/empty)
    if payload.alpaca_api_secret is not None and not is_masked(payload.alpaca_api_secret):
        updates["ALPACA_API_SECRET"] = _sanitize_val(payload.alpaca_api_secret)

    # Alpaca base url
    if payload.alpaca_base_url is not None:
        updates["ALPACA_BASE_URL"] = _sanitize_val(payload.alpaca_base_url)

    # ETF Symbol
    if payload.etf_symbol is not None:
        updates["ETF_SYMBOL"] = _sanitize_val(payload.etf_symbol).upper()

    # Top N
    if payload.top_n is not None:
        if payload.top_n <= 0:
            raise HTTPException(status_code=400, detail="TOP_N must be greater than 0")
        updates["TOP_N"] = str(payload.top_n)

    # ETF Symbols (additional list)
    if payload.etf_symbols is not None:
        updates["ETF_SYMBOLS"] = ",".join([_sanitize_val(s).upper() for s in payload.etf_symbols if s and _sanitize_val(s)])

    # Sector Cap
    if payload.sector_cap is not None:
        if not (0.0 <= payload.sector_cap <= 1.0):
            raise HTTPException(status_code=400, detail="SECTOR_CAP must be between 0.0 and 1.0")
        updates["SECTOR_CAP"] = f"{payload.sector_cap:.2f}"

    # Drift Threshold
    if payload.drift_threshold is not None:
        if not (0.0 <= payload.drift_threshold <= 1.0):
            raise HTTPException(status_code=400, detail="DRIFT_THRESHOLD must be between 0.0 and 1.0")
        updates["DRIFT_THRESHOLD"] = f"{payload.drift_threshold:.4f}"

    # Dashboard Password (if not masked/empty)
    if payload.dashboard_password is not None and not is_masked(payload.dashboard_password):
        updates["DASHBOARD_PASSWORD"] = _sanitize_val(payload.dashboard_password)

    # Google Client ID
    if payload.google_client_id is not None:
        updates["GOOGLE_CLIENT_ID"] = _sanitize_val(payload.google_client_id)

    # Google Client Secret (if not masked/empty)
    if payload.google_client_secret is not None and not is_masked(payload.google_client_secret):
        updates["GOOGLE_CLIENT_SECRET"] = _sanitize_val(payload.google_client_secret)

    # Google Redirect URI
    if payload.google_redirect_uri is not None:
        updates["GOOGLE_REDIRECT_URI"] = _sanitize_val(payload.google_redirect_uri)

    # Allowed Google Emails
    if payload.allowed_google_emails is not None:
        updates["ALLOWED_GOOGLE_EMAILS"] = ",".join([_sanitize_val(e).lower() for e in payload.allowed_google_emails if e and _sanitize_val(e)])


    if updates:
        try:
            update_env_file(ENV_PATH, updates)
            logger.info("Updated .env configurations: %s", list(updates.keys()))
            log_audit_event("SETTINGS_UPDATE", "admin", _client_ip(request), f"Updated configuration keys: {list(updates.keys())}")

            
            # Apply changes to current os.environ so that load_dotenv reads them
            for k, v in updates.items():
                os.environ[k] = v
                
            # Clear caches so the next API request gets a fresh Config and Alpaca Client
            get_config.cache_clear()
            get_alpaca.cache_clear()
            
        except Exception as exc:
            logger.error("Failed to write configurations to .env: %s", exc)
            raise HTTPException(status_code=500, detail="Failed to save settings due to an internal error.")


    return {"status": "success"}
