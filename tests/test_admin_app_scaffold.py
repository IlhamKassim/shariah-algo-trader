"""Scaffold tests for the standalone admin app (admin-app/, port 8002).

Covers the Phase 2 contract from SPEC-BETA-PILOT.md sections 5.1-5.4:

- GET /api/health is public (200, no auth).
- The /api/admin/* router is gated by dashboard auth imported from
  ``dashboard.api.deps`` (verify_auth + is_admin — never copied): anonymous
  401, tester-role JWT 403, admin JWT 200 (AC-7).
- The SPA static mount serves ``web/dist`` at "/".

The backend package lives at ``admin-app/admin_app/`` and is made importable
by the sys.path shim in ``tests/conftest.py`` (uvicorn reaches it the same
way via ``--app-dir admin-app``).
"""

from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

# The SPA static mount is conditional on web/dist existing at import time
# (dist/ is gitignored — it is produced by `npm run build` at deploy time).
# Materialize a placeholder index.html before importing the app so a fresh
# checkout can still exercise the mount contract without a Node build.
_DIST = Path(__file__).resolve().parent.parent / "admin-app" / "web" / "dist"
_DIST.mkdir(parents=True, exist_ok=True)
_INDEX = _DIST / "index.html"
if not _INDEX.exists():
    _INDEX.write_text(
        "<!doctype html><html><head><title>Shariah Admin</title></head>"
        '<body><div id="root"></div></body></html>',
        encoding="utf-8",
    )

from admin_app.api.main import app  # noqa: E402  (needs the dist placeholder above)
from dashboard.api.deps import get_config  # noqa: E402


class _MockSupabaseConfig:
    """Minimal Config stand-in: Supabase JWT mode on, no email allowlist."""

    supabase_enabled = True
    enforce_mfa = False
    allowed_google_emails = set()


@pytest.fixture
def client():
    app.dependency_overrides[get_config] = lambda: _MockSupabaseConfig()
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_health_ok_anonymous(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["service"] == "shariah-admin-app"


def test_admin_testers_401_anonymous(client):
    res = client.get("/api/admin/testers")
    assert res.status_code == 401


def test_admin_testers_403_for_tester_role(client):
    with patch("dashboard.api.deps._decode_supabase_jwt") as mock_decode:
        mock_decode.return_value = {
            "sub": "tester-user-1",
            "email": "tester@example.com",
            "app_metadata": {"role": "tester"},
            "aal": "aal1",
        }
        res = client.get("/api/admin/testers", headers={"Authorization": "Bearer tester-jwt"})
    assert res.status_code == 403


def test_admin_testers_200_for_admin(client):
    with patch("dashboard.api.deps._decode_supabase_jwt") as mock_decode:
        mock_decode.return_value = {
            "sub": "admin-user-1",
            "email": "aqilnazri9@gmail.com",
            "app_metadata": {"role": "admin"},
            "aal": "aal1",
        }
        res = client.get("/api/admin/testers", headers={"Authorization": "Bearer admin-jwt"})
    assert res.status_code == 200
    assert res.json() == {"testers": [], "count": 0}


def test_index_html_served_at_root(client):
    res = client.get("/")
    assert res.status_code == 200
    assert 'id="root"' in res.text
