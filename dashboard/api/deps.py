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
            trading_mode = user_settings.get("trading_mode") or "paper"
            if trading_mode == "live":
                api_key = user_settings.get("alpaca_live_api_key") or user_settings.get("alpaca_api_key")
                api_secret = user_settings.get("alpaca_live_api_secret") or user_settings.get("alpaca_api_secret")
                base_url = user_settings.get("alpaca_base_url") if user_settings.get("alpaca_base_url") and "paper" not in user_settings.get("alpaca_base_url") else "https://api.alpaca.markets"
            else:
                api_key = user_settings.get("alpaca_api_key")
                api_secret = user_settings.get("alpaca_api_secret")
                base_url = user_settings.get("alpaca_base_url") or cfg.alpaca_base_url

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


