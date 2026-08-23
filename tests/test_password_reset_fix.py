"""Regression tests for the password-reset fix (FIXSPEC t_04e21741).

The reset flow is frontend-only (browser talks directly to Supabase gotrue),
and this repo has no JS test runner, so these tests assert the behavioral
contract of the frontend source: the recovery page exists, the route is
public, the redirect target is /reset-password, and the login page offers a
logged-out entry point. They fail on main (pre-fix) and pass on
fix/password-reset.

Run: .venv/bin/python -m pytest tests/test_password_reset_fix.py -v
"""

import re
from pathlib import Path

WEB_SRC = Path(__file__).resolve().parent.parent / "dashboard" / "web" / "src"


def _read(rel_path: str) -> str:
    p = WEB_SRC / rel_path
    assert p.exists(), f"missing frontend source: {p}"
    return p.read_text(encoding="utf-8")


# ---------------------------------------------------------------- ResetPassword page

def test_reset_password_page_exists():
    src = _read("pages/ResetPassword.tsx")
    # Must define and export the component the route references.
    assert re.search(r"(export\s+function|export\s+default|function)\s+ResetPassword", src)


def test_reset_password_page_subscribes_to_password_recovery_event():
    src = _read("pages/ResetPassword.tsx")
    assert "onAuthStateChange" in src
    assert "PASSWORD_RECOVERY" in src


def test_reset_password_page_falls_back_to_recovery_hash():
    src = _read("pages/ResetPassword.tsx")
    # Landing on the emailed link: /reset-password#access_token=...&type=recovery
    assert "type=recovery" in src


def test_reset_password_page_calls_update_user():
    src = _read("pages/ResetPassword.tsx")
    assert "updateUser" in src
    assert "password" in src


def test_reset_password_page_shows_invalid_link_state():
    src = _read("pages/ResetPassword.tsx")
    assert re.search(r"Invalid or expired", src, re.IGNORECASE)


def test_reset_password_page_enforces_password_policy():
    """New password must satisfy the hardened signup policy (commit faea872):
    >=12 chars, upper, lower, digit, special."""
    src = _read("pages/ResetPassword.tsx")
    assert "12" in src
    assert "/[A-Z]/" in src
    assert "/[a-z]/" in src
    assert "/[0-9]/" in src
    assert re.search(r"special", src, re.IGNORECASE)


def test_reset_password_page_signs_out_and_redirects_on_success():
    src = _read("pages/ResetPassword.tsx")
    assert "signOut" in src
    assert '"/login"' in src or '"/login"' in src or "navigate" in src


# ---------------------------------------------------------------- Route registration

def test_app_registers_public_reset_password_route():
    # The route lives in AuthenticatedApp.tsx, not App.tsx: Clerk (and every
    # auth-dependent route) is code-split out of the initial bundle so the
    # public Landing page doesn't pay for loading the auth SDK. The route
    # itself is still public — it's a sibling of `/app/*`, not nested inside
    # the `ProtectedRoute`-wrapped branch.
    src = _read("AuthenticatedApp.tsx")
    assert 'path="/reset-password"' in src
    assert "ResetPassword" in src
    # Must be outside the protected `/app/*` route: it must appear before it
    # in the file so the reset page is reachable while logged out.
    assert src.index("/reset-password") < src.index('path="/app/*"')


# ---------------------------------------------------------------- Settings redirect

def test_settings_sends_reset_link_to_reset_password_page():
    src = _read("pages/Settings.tsx")
    assert "resetPasswordForEmail" in src
    assert "reset-password" in src
    assert "/login" not in src.split("resetPasswordForEmail")[1].split("}")[0]


# ---------------------------------------------------------------- Login entry point

def test_login_offers_forgot_password_link():
    src = _read("pages/Login.tsx")
    assert re.search(r"forgot", src, re.IGNORECASE)
    assert "resetPasswordForEmail" in src
    assert "reset-password" in src
