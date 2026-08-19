import ipaddress
import socket
import threading
import time
import urllib.parse
from collections import defaultdict, deque

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, RedirectResponse, Response


# ── SSRF guard for user-supplied Alpaca base URLs ────────────────────────────

def validate_alpaca_base_url(url: str | None) -> str | None:
    """Validate and normalize an Alpaca base URL against SSRF.

    Returns the normalized ``https://<host><path>`` URL when safe, else
    ``None``. Safe means: https scheme, host on ``*.alpaca.markets`` (not an
    IP literal), no embedded credentials, no non-default port, and every
    address the host currently resolves to is a public (non-private,
    non-loopback, non-link-local, non-reserved) IP.
    """
    if not url:
        return None
    try:
        parsed = urllib.parse.urlparse(url.strip())
    except ValueError:
        return None
    if parsed.scheme != "https" or not parsed.hostname:
        return None
    if parsed.username or parsed.password:
        return None
    if parsed.port not in (None, 443):
        return None
    host = parsed.hostname.rstrip(".")
    if host != "alpaca.markets" and not host.endswith(".alpaca.markets"):
        return None
    # Reject IP-literal hosts outright so the name allowlist cannot be
    # bypassed with an encoded/alternative IP form.
    try:
        ipaddress.ip_address(host)
        return None
    except ValueError:
        pass
    # Resolve server-side and require every returned address to be public
    # (mitigates DNS rebinding to internal/cloud-metadata ranges).
    try:
        infos = socket.getaddrinfo(host, None)
    except OSError:
        return None
    if not infos:
        return None
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if (
            ip.is_private or ip.is_loopback or ip.is_link_local
            or ip.is_reserved or ip.is_multicast or ip.is_unspecified
        ):
            return None
    path = parsed.path.rstrip("/")
    return f"https://{host}{path}"


class ForwardedProtoHTTPSRedirectMiddleware(BaseHTTPMiddleware):
    """Defense-in-depth: force the **client-visible** protocol up to https.

    Starlette's built-in ``HTTPSRedirectMiddleware`` only inspects
    ``scope["scheme"]``. Behind a reverse proxy (e.g. Cloudflare in "Flexible"
    mode) the origin sees ``http`` for *all* traffic — even a browser's HTTPS
    request, because the edge proxies over plaintext to the origin. So that
    middleware would 307-loop everything until the proxy is switched to
    "Full (strict)".

    Instead we read the proxy-reported ``X-Forwarded-Proto`` header (the same
    pattern ``_client_ip`` uses for ``x-forwarded-for``) and redirect 307 to
    https whenever the *client* connected over plaintext. Only add this in
    production; the client still connects over plaintext because Cloudflare
    is in Flexible mode, so this intentionally requires the operator to flip
    Cloudflare to Full (strict) at the same time, or the site will redirect-loop.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        forwarded_proto = request.headers.get("x-forwarded-proto", "").strip().lower()
        client_scheme = forwarded_proto or (request.url.scheme or "http")
        if client_scheme == "http":
            url = request.url.replace(scheme="https")
            if url.port in (80, 443):
                # Drop the default port so the Location header is clean.
                url = url.replace(netloc=url.hostname or url.netloc)
            return RedirectResponse(str(url), status_code=307)
        return await call_next(request)


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

    def reset(self) -> None:
        """Clear all recorded hits. Test-only escape hatch — this limiter is a
        process-wide singleton (attached to the app at import time), so
        without this, tests that share the app instance leak rate-limit state
        into each other based on execution order."""
        with self._lock:
            self._hits.clear()


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
            "script-src 'self' https://clerk.shariahtrading.my https://*.clerk.accounts.dev https://challenges.cloudflare.com 'unsafe-inline'; "
            "style-src 'self' https://fonts.googleapis.com https://clerk.shariahtrading.my https://*.clerk.accounts.dev 'unsafe-inline'; "
            "font-src 'self' https://fonts.gstatic.com https://clerk.shariahtrading.my https://*.clerk.accounts.dev; "
            "img-src 'self' data: https://img.clerk.com https://clerk.shariahtrading.my https://*.clerk.accounts.dev https://*.supabase.co; "
            "connect-src 'self' "
            "https://clerk.shariahtrading.my https://*.clerk.accounts.dev wss://clerk.shariahtrading.my "
            "https://*.supabase.co wss://*.supabase.co "
            "https://api.alpaca.markets https://paper-api.alpaca.markets; "
            "frame-src 'self' https://clerk.shariahtrading.my https://*.clerk.accounts.dev https://challenges.cloudflare.com https://*.supabase.co; "
            "worker-src 'self' blob:; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self'"
        )
        return response


def build_default_limiter() -> _FixedWindowLimiter:
    return _FixedWindowLimiter(max_requests=120, window_seconds=60)


def build_refresh_limiter() -> _FixedWindowLimiter:
    return _FixedWindowLimiter(max_requests=2, window_seconds=60)


def build_auth_limiter() -> _FixedWindowLimiter:
    return _FixedWindowLimiter(max_requests=5, window_seconds=60)


def build_waitlist_limiter() -> _FixedWindowLimiter:
    return _FixedWindowLimiter(max_requests=3, window_seconds=60)
