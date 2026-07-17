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
    if cfg.clerk_enabled:
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

        token = auth_header.split(" ")[1]
        try:
            payload = jwt.decode(
                token,
                cfg.clerk_jwt_verification_key,
                algorithms=["RS256"],
                options={"verify_aud": False}
            )
            request.state.user = payload
            return True
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token has expired")
        except jwt.InvalidTokenError as e:
            raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

    if not cfg.dashboard_password:
        return None

    # Import locally to avoid circular dependencies
    from dashboard.api.routers.auth import verify_session_token

    token = request.cookies.get("session_token")
    if not token or not verify_session_token(token, cfg):
        raise HTTPException(status_code=401, detail="Not authenticated")

    return True
