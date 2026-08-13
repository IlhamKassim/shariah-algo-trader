"""FastAPI entrypoint for the standalone admin app (SPEC-BETA-PILOT.md §5).

Binds 127.0.0.1:8002 (see admin-app/shariah-admin-app.service). Auth is
imported, never copied: ``verify_auth`` (401 anonymous) + ``is_admin``
(403 non-admin) come from ``dashboard.api.deps`` and gate the whole
``/api/admin/*`` router at mount time.
"""

from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from admin_app.api.routers import admin
from dashboard.api.deps import get_config, is_admin, verify_auth

app = FastAPI(
    title="Shariah Admin App",
    version="0.1.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


@app.get("/api/health")
def health() -> dict:
    """Public liveness probe for uptime monitoring — no auth, no user data."""
    return {"status": "ok", "service": "shariah-admin-app"}


def require_admin(request: Request, cfg=Depends(get_config)) -> None:
    """403 unless the authenticated caller resolves as an admin (deps.py:219)."""
    if not is_admin(request, cfg):
        raise HTTPException(status_code=403, detail="Admin privileges required")


# Every /api/admin/* route needs verify_auth AND require_admin (AC-7):
# anonymous -> 401, authenticated non-admin (e.g. tester role) -> 403.
app.include_router(
    admin.router,
    prefix="/api/admin",
    dependencies=[Depends(verify_auth), Depends(require_admin)],
)


class SPAStaticFiles(StaticFiles):
    """Serve index.html for unmatched non-API paths (client-side routing).

    Same pattern as dashboard/api/main.py:139-149.
    """

    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code == 404 and not path.startswith("api/"):
                return await super().get_response("index.html", scope)
            raise


# SPA build output (admin-app/web/dist, produced by `npm run build`). Mounted
# last so /api/* routes win; skipped when the frontend has not been built yet.
_WEB_DIST = Path(__file__).resolve().parent.parent.parent / "web" / "dist"
if _WEB_DIST.exists():
    app.mount("/", SPAStaticFiles(directory=str(_WEB_DIST), html=True), name="static")
