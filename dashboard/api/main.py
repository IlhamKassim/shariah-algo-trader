import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from dashboard.api.cache import get_universe_cache
from dashboard.api.deps import get_alpaca, get_config, verify_auth
from dashboard.api.hardening import (
    RateLimitMiddleware,
    SecurityHeadersMiddleware,
    build_default_limiter,
    build_refresh_limiter,
)
from dashboard.api.routers import (
    account,
    activity,
    auth,
    compare,
    compliance,
    day_trader,
    notifications,
    performance,
    portfolio,
    settings,
    status,
    universe,
)
from dashboard.api.routers.universe import schedule_startup_refresh
from dashboard.api.notifications_seeder import seed_notifications


@asynccontextmanager
async def lifespan(app: FastAPI):
    cfg = get_config()
    client = get_alpaca()
    cache = get_universe_cache()
    schedule_startup_refresh(cache, cfg, client)
    seed_notifications()
    yield


app = FastAPI(
    title="Shariah Algo Trader Dashboard",
    version="0.1.0",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    *[o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o.strip()],
]

app.add_middleware(
    RateLimitMiddleware,
    default_limiter=build_default_limiter(),
    route_limiters={("POST", "/api/universe/refresh"): build_refresh_limiter()},
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Open auth router endpoints (login, logout, status)
app.include_router(auth.router)

# Secure all other endpoints
app.include_router(status.router, dependencies=[Depends(verify_auth)])
app.include_router(account.router, dependencies=[Depends(verify_auth)])
app.include_router(portfolio.router, dependencies=[Depends(verify_auth)])
app.include_router(universe.router, dependencies=[Depends(verify_auth)])
app.include_router(activity.router, dependencies=[Depends(verify_auth)])
app.include_router(compliance.router, dependencies=[Depends(verify_auth)])
app.include_router(performance.router, dependencies=[Depends(verify_auth)])
app.include_router(compare.router, dependencies=[Depends(verify_auth)])
app.include_router(day_trader.router, dependencies=[Depends(verify_auth)])
app.include_router(notifications.router, dependencies=[Depends(verify_auth)])
app.include_router(settings.router, dependencies=[Depends(verify_auth)])


class SPAStaticFiles(StaticFiles):
    """Serve index.html for any unmatched path so React Router can handle
    client-side routes (e.g. a direct visit or refresh on /universe)."""

    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code == 404 and not path.startswith("api/"):
                return await super().get_response("index.html", scope)
            raise


_STATIC = Path(__file__).parent / "static"
if _STATIC.exists():
    app.mount("/", SPAStaticFiles(directory=str(_STATIC), html=True), name="static")
