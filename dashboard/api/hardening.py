import threading
import time
from collections import defaultdict, deque

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response


class _FixedWindowLimiter:
    """Best-effort per-key rate limiter using an in-memory sliding window.

    Single-process only (matches this app's other in-memory caches, e.g.
    UniverseCache) — good enough for a single small Render worker, not a
    distributed limiter.
    """

    def __init__(self, max_requests: int, window_seconds: float):
        self._max = max_requests
        self._window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] > self._window:
                hits.popleft()
            if len(hits) >= self._max:
                return False
            hits.append(now)
            return True


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Applies a generous default limit to all /api/* routes, plus tighter
    per-route limits (e.g. the expensive universe refresh) passed in explicitly.
    """

    def __init__(
        self,
        app,
        default_limiter: _FixedWindowLimiter,
        route_limiters: dict[tuple[str, str], _FixedWindowLimiter] | None = None,
    ):
        super().__init__(app)
        self._default = default_limiter
        self._routes = route_limiters or {}

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.url.path.startswith("/api/"):
            limiter = self._routes.get((request.method, request.url.path), self._default)
            if not limiter.allow(_client_ip(request)):
                return JSONResponse(
                    {"detail": "Rate limit exceeded — please slow down."},
                    status_code=429,
                )
        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data:; "
            "connect-src 'self'; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self'"
        )
        return response


def build_default_limiter() -> _FixedWindowLimiter:
    return _FixedWindowLimiter(max_requests=120, window_seconds=60)


def build_refresh_limiter() -> _FixedWindowLimiter:
    return _FixedWindowLimiter(max_requests=2, window_seconds=60)
