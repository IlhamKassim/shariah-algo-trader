"""Tests for defense-in-depth HTTPS enforcement behind a reverse proxy.

Starlette's built-in ``HTTPSRedirectMiddleware`` keys off the raw
``scope["scheme"]`` only, which is useless behind a "Flexible"-mode proxy
(Cloudflare) where the origin sees ``http`` for *all* traffic. Our
``ForwardedProtoHTTPSRedirectMiddleware`` reads the proxy-reported
``X-Forwarded-Proto`` header instead (same pattern as ``_client_ip`` / XFF).
"""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from dashboard.api.hardening import ForwardedProtoHTTPSRedirectMiddleware
from dashboard.api.main import app as real_app


def _make_prod_app() -> FastAPI:
    """Build an app wired exactly like the production one (redirect enabled)."""
    prod_app = FastAPI()
    prod_app.add_middleware(ForwardedProtoHTTPSRedirectMiddleware)

    @prod_app.get("/health")
    async def health():
        return {"status": "ok"}

    return prod_app


def test_forwarded_proto_http_redirects_to_https():
    client = TestClient(_make_prod_app())
    response = client.get(
        "/health",
        headers={"X-Forwarded-Proto": "http"},
        follow_redirects=False,  # observe the 307, don't loop
    )
    assert response.status_code == 307
    location = response.headers.get("location", "")
    assert location.startswith("https://")


def test_forwarded_proto_https_pass_through():
    client = TestClient(_make_prod_app())
    response = client.get(
        "/health",
        headers={"X-Forwarded-Proto": "https"},
    )
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_real_app_does_not_enable_redirect_in_test_env():
    """pytest-env sets no environment block and conftest sets no
    ENVIRONMENT/RENDER, so the real app must NOT have the redirect middleware
    attached — otherwise local dev and the whole suite would redirect-loop.
    """
    assert not any(
        m.cls is ForwardedProtoHTTPSRedirectMiddleware
        for m in real_app.user_middleware
    )