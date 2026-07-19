import hashlib
import hmac
import secrets
import time
import urllib.parse
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
import httpx
from pydantic import BaseModel

from dashboard.api.deps import get_config
from shariah_algo_trader.config import Config

_FALLBACK_SECRET = secrets.token_hex(32)


def _get_secret(cfg: Config) -> str:
    return cfg.dashboard_session_secret or _FALLBACK_SECRET


def generate_session_token(cfg: Config, max_age: int = 7 * 24 * 3600) -> str:
    expiry = int(time.time()) + max_age
    secret = _get_secret(cfg)
    msg = f"{expiry}"
    signature = hmac.new(
        secret.encode("utf-8"), msg.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    return f"{expiry}.{signature}"


def verify_session_token(token: str, cfg: Config) -> bool:
    try:
        parts = token.split(".")
        if len(parts) != 2:
            return False
        expiry_str, signature = parts
        expiry = int(expiry_str)
        if time.time() > expiry:
            return False  # Session expired

        secret = _get_secret(cfg)
        msg = f"{expiry}"
        expected_sig = hmac.new(
            secret.encode("utf-8"), msg.encode("utf-8"), hashlib.sha256
        ).hexdigest()

        return hmac.compare_digest(signature, expected_sig)
    except Exception:
        return False


class LoginRequest(BaseModel):
    password: str


class AuthStatusResponse(BaseModel):
    auth_enabled: bool
    password_auth_enabled: bool
    google_auth_enabled: bool
    clerk_enabled: bool
    authenticated: bool


router = APIRouter()


@router.get("/api/auth/status", response_model=AuthStatusResponse)
def get_auth_status(
    request: Request, cfg: Config = Depends(get_config)
) -> AuthStatusResponse:
    if getattr(cfg, "clerk_enabled", False):
        auth_header = request.headers.get("Authorization")
        authenticated = False
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                import jwt
                raw_key = getattr(cfg, "clerk_jwt_verification_key", None) or ""
                key = raw_key.replace("\\n", "\n")
                jwt.decode(
                    token,
                    key,
                    algorithms=["RS256"],
                    options={"verify_aud": False}
                )
                authenticated = True
            except Exception:
                pass
        return AuthStatusResponse(
            auth_enabled=True,
            password_auth_enabled=False,
            google_auth_enabled=False,
            clerk_enabled=True,
            authenticated=authenticated,
        )

    password_auth_enabled = bool(cfg.dashboard_password)
    google_auth_enabled = bool(
        cfg.google_client_id
        and cfg.google_client_secret
        and cfg.google_redirect_uri
        and cfg.allowed_google_emails
    )
    auth_enabled = password_auth_enabled or google_auth_enabled

    if not auth_enabled:
        return AuthStatusResponse(
            auth_enabled=False,
            password_auth_enabled=False,
            google_auth_enabled=False,
            clerk_enabled=False,
            authenticated=True,
        )

    token = request.cookies.get("session_token")
    authenticated = bool(token and verify_session_token(token, cfg))
    return AuthStatusResponse(
        auth_enabled=True,
        password_auth_enabled=password_auth_enabled,
        google_auth_enabled=google_auth_enabled,
        clerk_enabled=False,
        authenticated=authenticated,
    )


@router.post("/api/auth/login")
def login(
    request: Request,
    response: Response,
    body: LoginRequest,
    cfg: Config = Depends(get_config),
):
    if not cfg.dashboard_password:
        return {"status": "ok", "message": "Auth disabled"}

    if body.password != cfg.dashboard_password:
        raise HTTPException(status_code=401, detail="Incorrect password")

    max_age = 7 * 24 * 3600  # 7 days
    token = generate_session_token(cfg, max_age=max_age)

    # Use secure cookies if running on HTTPS
    is_secure = (
        request.headers.get("x-forwarded-proto") == "https"
        or request.url.scheme == "https"
    )

    response.set_cookie(
        key="session_token",
        value=token,
        max_age=max_age,
        expires=max_age,
        httponly=True,
        samesite="lax",
        secure=is_secure,
    )
    return {"status": "ok"}


@router.post("/api/auth/logout")
def logout(response: Response):
    response.delete_cookie(key="session_token")
    return {"status": "ok"}


@router.get("/api/auth/google/login")
def google_login(cfg: Config = Depends(get_config)):
    google_auth_enabled = bool(
        cfg.google_client_id and cfg.google_client_secret and cfg.google_redirect_uri
    )
    if not google_auth_enabled:
        raise HTTPException(
            status_code=400, detail="Google authentication is not configured."
        )

    params = {
        "client_id": cfg.google_client_id,
        "redirect_uri": cfg.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "prompt": "select_account",
    }
    url = (
        "https://accounts.google.com/o/oauth2/v2/auth?"
        + urllib.parse.urlencode(params)
    )
    return RedirectResponse(url)


@router.get("/api/auth/google/callback")
async def google_callback(
    request: Request,
    response: Response,
    code: str | None = None,
    error: str | None = None,
    cfg: Config = Depends(get_config),
):
    if error:
        return RedirectResponse(f"/login?error={urllib.parse.quote(error)}")
    if not code:
        return RedirectResponse("/login?error=missing_code")

    google_auth_enabled = bool(
        cfg.google_client_id
        and cfg.google_client_secret
        and cfg.google_redirect_uri
        and cfg.allowed_google_emails
    )
    if not google_auth_enabled:
        return RedirectResponse("/login?error=google_auth_not_configured")

    try:
        # 1. Exchange authorization code for token
        async with httpx.AsyncClient() as client:
            token_res = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": cfg.google_client_id,
                    "client_secret": cfg.google_client_secret,
                    "redirect_uri": cfg.google_redirect_uri,
                    "grant_type": "authorization_code",
                },
                timeout=10.0,
            )
            if token_res.status_code != 200:
                return RedirectResponse("/login?error=token_exchange_failed")
            token_data = token_res.json()
            access_token = token_data.get("access_token")
            if not access_token:
                return RedirectResponse("/login?error=missing_access_token")

            # 2. Fetch user profile from Google info endpoint
            userinfo_res = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=10.0,
            )
            if userinfo_res.status_code != 200:
                return RedirectResponse("/login?error=profile_fetch_failed")
            userinfo = userinfo_res.json()
            email = userinfo.get("email")
            if not email:
                return RedirectResponse("/login?error=email_not_provided")

            # 3. Verify whitelisted email
            email_lower = email.strip().lower()
            if email_lower not in cfg.allowed_google_emails:
                return RedirectResponse("/login?error=unauthorized_email")

            # 4. Success! Issue session token and cookie
            max_age = 7 * 24 * 3600  # 7 days
            token = generate_session_token(cfg, max_age=max_age)

            is_secure = (
                request.headers.get("x-forwarded-proto") == "https"
                or request.url.scheme == "https"
            )

            redirect_resp = RedirectResponse("/")
            redirect_resp.set_cookie(
                key="session_token",
                value=token,
                max_age=max_age,
                expires=max_age,
                httponly=True,
                samesite="lax",
                secure=is_secure,
            )
            return redirect_resp

    except Exception as exc:
        return RedirectResponse(
            f"/login?error=auth_exception&detail={urllib.parse.quote(str(exc))}"
        )


@router.post("/api/auth/verify")
def verify_password(payload: LoginRequest, cfg: Config = Depends(get_config)):
    if not cfg.dashboard_password:
        return {"status": "success"}
    if payload.password != cfg.dashboard_password:
        raise HTTPException(status_code=401, detail="Incorrect password")
    return {"status": "success"}
