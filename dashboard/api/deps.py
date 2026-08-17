import os
import jwt
import json
import time
import urllib.request
from functools import lru_cache
from fastapi import Request, HTTPException, Depends
from jwt.algorithms import ECAlgorithm, RSAAlgorithm, HMACAlgorithm


from shariah_algo_trader.config import Config
from shariah_algo_trader.execution.alpaca_client import AlpacaClient

# ── JWKS cache ──────────────────────────────────────────────────────────────
_jwks_cache: dict = {}
_jwks_cache_ttl: float = 0
_JWKS_CACHE_SECONDS = 3600  # refresh public keys every hour


def _fetch_jwks(jwks_url: str) -> dict:
    """Fetch and cache Supabase JWKS public keys with graceful fallback."""
    global _jwks_cache, _jwks_cache_ttl
    now = time.time()
    if _jwks_cache and now < _jwks_cache_ttl:
        return _jwks_cache
    try:
        req = urllib.request.Request(jwks_url, headers={"User-Agent": "ShariahAlgoTrader/1.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
        _jwks_cache = {k["kid"]: k for k in data.get("keys", [])}
        _jwks_cache_ttl = now + _JWKS_CACHE_SECONDS
        return _jwks_cache
    except Exception as e:
        if _jwks_cache:
            return _jwks_cache
        raise e


def _decode_supabase_jwt(token: str, cfg: Config) -> dict:
    """Decode a Supabase JWT using JWKS (ES256/RS256) or HS256 fallback."""
    # Try JWKS-based verification first (ES256 — new Supabase default)
    jwks_url = cfg.supabase_jwks_url or (
        f"{cfg.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
        if cfg.supabase_url else None
    )
    if jwks_url:
        try:
            header = jwt.get_unverified_header(token)
            kid = header.get("kid")
            alg = header.get("alg", "ES256")
            jwks = _fetch_jwks(jwks_url)
            key_data = jwks.get(kid) if kid else (next(iter(jwks.values()), None) if jwks else None)
            if key_data:
                if alg.startswith("ES"):
                    public_key = ECAlgorithm.from_jwk(json.dumps(key_data))
                elif alg.startswith("RS"):
                    public_key = RSAAlgorithm.from_jwk(json.dumps(key_data))
                else:
                    public_key = None
                if public_key:
                    return jwt.decode(
                        token, public_key, algorithms=[alg],
                        options={"verify_aud": False}
                    )
        except jwt.ExpiredSignatureError:
            raise
        except Exception:
            pass  # fall through to HS256

    # HS256 fallback (legacy Supabase projects)
    secret = cfg.supabase_jwt_secret
    if secret and not secret.startswith("sb_"):
        return jwt.decode(
            token, secret, algorithms=["HS256"],
            options={"verify_aud": False}
        )

    raise jwt.InvalidTokenError("Unable to verify Supabase JWT — check SUPABASE_JWKS_URL or SUPABASE_JWT_SECRET")


@lru_cache
def get_config() -> Config:
    return Config()


def get_alpaca(request: Request = None, cfg: Config = Depends(get_config)) -> AlpacaClient | None:
    if not isinstance(cfg, Config):
        cfg = get_config()

    if request is not None and not getattr(request.state, "user_id", None):
        try:
            verify_auth(request, cfg)
        except Exception:
            pass

    user_id = getattr(request.state, "user_id", None) if (request is not None and hasattr(request, "state")) else None
    user_email = getattr(request.state, "user_email", None) if (request is not None and hasattr(request, "state")) else None

    if user_id:
        from dashboard.api.user_store import get_user_settings
        user_settings = get_user_settings(user_id)
        if user_settings:
            from dashboard.api.hardening import validate_alpaca_base_url
            trading_mode = user_settings.get("trading_mode") or "paper"
            stored_url = user_settings.get("alpaca_base_url") or ""
            validated_url = validate_alpaca_base_url(stored_url)
            if trading_mode == "live":
                api_key = user_settings.get("alpaca_live_api_key") or user_settings.get("alpaca_api_key")
                api_secret = user_settings.get("alpaca_live_api_secret") or user_settings.get("alpaca_api_secret")
                # Never send credentials to a user-supplied host that fails
                # SSRF validation — fall back to the safe live endpoint.
                base_url = validated_url or "https://api.alpaca.markets"
            else:
                api_key = user_settings.get("alpaca_api_key")
                api_secret = user_settings.get("alpaca_api_secret")
                base_url = validated_url or cfg.alpaca_base_url

            if api_key and api_secret:
                return AlpacaClient(api_key, api_secret, base_url)

        # In Supabase SaaS mode, authenticated users without custom credentials get None
        if getattr(cfg, "supabase_enabled", False):
            return None

        # Primary admin email fallback if no custom keys saved yet (Google OAuth legacy mode):
        allowed = [e.lower() for e in cfg.allowed_google_emails] if cfg.allowed_google_emails else []
        if user_email and user_email.lower() in allowed:
            return AlpacaClient(cfg.alpaca_api_key, cfg.alpaca_api_secret, cfg.alpaca_base_url)

        # Authenticated new user without custom Alpaca credentials configured: return None
        return None

    # In Supabase SaaS mode, do not leak server admin credentials to unauthenticated requests
    if getattr(cfg, "supabase_enabled", False):
        return None

    # Server background loops or single-tenant legacy mode fallback:
    return AlpacaClient(cfg.alpaca_api_key, cfg.alpaca_api_secret, cfg.alpaca_base_url)


def verify_auth(request: Request, cfg: Config = Depends(get_config)):
    if getattr(cfg, "supabase_enabled", False):
        auth_header = request.headers.get("Authorization")
        token = None
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
        elif request.cookies.get("sb-access-token"):
            token = request.cookies.get("sb-access-token")

        if not token:
            raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

        try:
            payload = _decode_supabase_jwt(token, cfg)
            request.state.user = payload
            request.state.user_id = payload.get("sub")
            request.state.user_email = payload.get("email")
            aal = payload.get("aal", "aal1")
            request.state.mfa_verified = (aal == "aal2")

            if getattr(cfg, "enforce_mfa", False) and aal != "aal2":
                raise HTTPException(
                    status_code=403,
                    detail="Multi-Factor Authentication (MFA) required. Please verify TOTP.",
                )

            return True
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Supabase session has expired")
        except jwt.InvalidTokenError as e:
            raise HTTPException(status_code=401, detail=f"Invalid Supabase token: {str(e)}")

    if getattr(cfg, "clerk_enabled", False):
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

        token = auth_header.split(" ")[1]
        try:
            raw_key = getattr(cfg, "clerk_jwt_verification_key", None) or ""
            key = raw_key.replace("\\n", "\n")
            expected_aud = getattr(cfg, "clerk_jwt_audience", None)
            decode_options = {"verify_aud": True} if expected_aud else {"verify_aud": False}
            decode_kwargs = {"algorithms": ["RS256"], "options": decode_options}
            if expected_aud:
                decode_kwargs["audience"] = expected_aud
            payload = jwt.decode(token, key, **decode_kwargs)
            request.state.user = payload
            return True

        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token has expired")
        except jwt.InvalidTokenError as e:
            raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

    password_auth_enabled = bool(cfg.dashboard_password)
    google_auth_enabled = bool(
        cfg.google_client_id
        and cfg.google_client_secret
        and cfg.google_redirect_uri
        and cfg.allowed_google_emails
    )
    auth_enabled = password_auth_enabled or google_auth_enabled

    if not auth_enabled:
        return True

    # Import locally to avoid circular dependencies
    from dashboard.api.routers.auth import verify_session_token

    token = request.cookies.get("session_token")
    if not token or not verify_session_token(token, cfg):
        raise HTTPException(status_code=401, detail="Not authenticated")

    return True


_ADMIN_APP_METADATA_ROLES = {"admin", "service_role", "owner", "supabase_admin"}


def is_admin(request: Request, cfg: Config | None = None) -> bool:
    """Return True for the platform owner/operator.

    - In SaaS mode (Supabase / Clerk enabled), unauthenticated requests (no user_id)
      fail closed and are NEVER granted admin privileges.
    - Legacy password/OAuth session mode (no Supabase ``user_id`` bound to the
      request) is owner-only, so those callers are admins.
    - Supabase mode grants admin when:
      1. JWT ``app_metadata.role`` is an admin role.
      2. Local SQLite ``pilot_users.role`` is 'admin'.
      3. Caller email is in ``ADMIN_EMAILS`` or ``ALLOWED_GOOGLE_EMAILS``.
    """
    if cfg is None:
        cfg = get_config()

    user_id = getattr(request.state, "user_id", None) if hasattr(request, "state") else None
    if not user_id:
        if getattr(cfg, "supabase_enabled", False) or getattr(cfg, "clerk_enabled", False):
            return False
        return True
    payload = getattr(request.state, "user", None) or {}
    app_meta = payload.get("app_metadata") or {}
    if app_meta.get("role") in _ADMIN_APP_METADATA_ROLES:
        return True


    # Check local SQLite pilot database role
    from dashboard.api.user_store import get_pilot_role
    if get_pilot_role(user_id) == "admin":
        return True

    email = getattr(request.state, "user_email", None)
    if email:
        email_clean = email.strip().lower()
        if hasattr(cfg, "admin_emails") and email_clean in cfg.admin_emails:
            return True
        if hasattr(cfg, "allowed_google_emails") and email_clean in cfg.allowed_google_emails:
            return True
        admin_env = os.environ.get("ADMIN_EMAILS", "") or os.environ.get("ALLOWED_ADMIN_EMAILS", "")
        if admin_env:
            allowed_set = {e.strip().lower() for e in admin_env.split(",") if e.strip()}
            if email_clean in allowed_set:
                return True

    return False



def is_tester_request(request: Request) -> bool:
    """True when the authenticated caller is a pilot tester (paper-only role).

    Reads the role from the JWT ``app_metadata.role`` first (set at approval
    time); falls back to the local ``pilot_users.role`` when the JWT predates
    approval (SPEC-BETA-PILOT.md section 6). Gated by ``PILOT_GUARD_DISABLE``
    so the guardrails can be feature-flagged off for rollback (section 10).
    """
    from dashboard.api.user_store import get_pilot_role, pilot_guard_enabled

    if not pilot_guard_enabled():
        return False
    user_id = getattr(request.state, "user_id", None) if hasattr(request, "state") else None
    if not user_id:
        return False
    payload = getattr(request.state, "user", None) or {}
    app_meta = payload.get("app_metadata") or {}
    if app_meta.get("role") == "tester":
        return True
    return get_pilot_role(user_id) == "tester"


