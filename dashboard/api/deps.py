import jwt
from functools import lru_cache
from fastapi import Request, HTTPException, Depends

from shariah_algo_trader.config import Config
from shariah_algo_trader.execution.alpaca_client import AlpacaClient


@lru_cache
def get_config() -> Config:
    return Config()


@lru_cache
def get_alpaca() -> AlpacaClient:
    cfg = get_config()
    return AlpacaClient(cfg.alpaca_api_key, cfg.alpaca_api_secret, cfg.alpaca_base_url)


def verify_auth(request: Request, cfg: Config = Depends(get_config)):
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

