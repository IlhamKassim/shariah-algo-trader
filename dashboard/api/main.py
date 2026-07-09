import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from dashboard.api.cache import get_universe_cache
from dashboard.api.deps import get_alpaca, get_config
from dashboard.api.hardening import (
    RateLimitMiddleware,
    SecurityHeadersMiddleware,
    build_default_limiter,
    build_refresh_limiter,
)
from dashboard.api.routers import account, activity, compare, compliance, day_trader, performance, portfolio, status, universe
from dashboard.api.routers.universe import schedule_startup_refresh


@asynccontextmanager
async def lifespan(app: FastAPI):
    cfg = get_config()
    client = get_alpaca()
    cache = get_universe_cache()
    schedule_startup_refresh(cache, cfg, client)
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

app.include_router(status.router)
app.include_router(account.router)
app.include_router(portfolio.router)
app.include_router(universe.router)
app.include_router(activity.router)
app.include_router(compliance.router)
app.include_router(performance.router)
app.include_router(compare.router)
app.include_router(day_trader.router)

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
