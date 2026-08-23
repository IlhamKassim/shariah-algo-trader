"""Regression tests for the six Strix pentest findings (scan 0fd4, 2026-08-07).

Covers:
- vuln-0001: SSRF via unvalidated alpaca_base_url (settings write + read fallback)
- vuln-0002: admin configuration disclosure in GET /api/settings
- vuln-0003: live trading mode without server-side risk acknowledgment
- vuln-0004: missing function-level authorization on POST /api/universe/refresh
- vuln-0005: cross-user notifications feed / shared read-state
- vuln-0006: HTTP 500 on GET /api/compare for empty portfolio history
"""

import socket
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from dashboard.api.main import app
from dashboard.api.deps import get_config


@pytest.fixture
def client():
    return TestClient(app)


class SupabaseMockConfig:
    """SaaS/tenant mode config: Supabase auth on, no global admin credentials."""

    def __init__(self):
        self.alpaca_api_key = "SERVER_DEFAULT_KEY"
        self.alpaca_api_secret = "SERVER_DEFAULT_SECRET"
        self.alpaca_base_url = "https://paper-api.alpaca.markets"
        self.etf_symbol = "SPUS"
        self.top_n = 20
        self.etf_symbols = ["SPUS", "HLAL"]
        self.sector_cap = 0.20
        self.drift_threshold = 0.03
        self.dashboard_password = None
        self.google_client_id = None
        self.google_client_secret = None
        self.google_redirect_uri = None
        self.allowed_google_emails = {"aqilnazri9@gmail.com"}
        self.clerk_enabled = False
        self.supabase_enabled = True
        self.enforce_mfa = False


@pytest.fixture
def supabase_env(monkeypatch):
    """Isolate notification + user-store DBs and day-trader env to a temp dir."""
    import dashboard.api.db as dbmod
    import dashboard.api.user_store as usmod
    import tempfile
    tmp = tempfile.mkdtemp(prefix="strix_fix_test_")
    monkeypatch.setattr(dbmod, "_DB_PATH", __import__("pathlib").Path(tmp) / "notifications.db")
    monkeypatch.setattr(dbmod, "_initialized", False)
    monkeypatch.setattr(usmod, "_DB_PATH", __import__("pathlib").Path(tmp) / "user_settings.db")
    monkeypatch.setattr(usmod, "_initialized", False)
    monkeypatch.delenv("DAY_ALPACA_API_KEY", raising=False)
    monkeypatch.delenv("DAY_ALPACA_API_SECRET", raising=False)
    return tmp


# ═════════════════════════════════════════════════════════════════════════════
# vuln-0001 — SSRF via alpaca_base_url
# ═════════════════════════════════════════════════════════════════════════════

class TestAlpacaBaseUrlValidation:
    def test_accepts_legit_alpaca_hosts(self):
        from dashboard.api.hardening import validate_alpaca_base_url
        assert validate_alpaca_base_url("https://api.alpaca.markets") == "https://api.alpaca.markets"
        assert validate_alpaca_base_url("https://paper-api.alpaca.markets") == "https://paper-api.alpaca.markets"
        assert validate_alpaca_base_url("https://data.alpaca.markets/v2") == "https://data.alpaca.markets/v2"
        assert validate_alpaca_base_url("https://broker-api.alpaca.markets/") == "https://broker-api.alpaca.markets"

    def test_rejects_ssrf_payloads(self):
        from dashboard.api.hardening import validate_alpaca_base_url
        # metadata / link-local / loopback targets (the Strix PoCs)
        assert validate_alpaca_base_url("http://169.254.169.254") is None
        assert validate_alpaca_base_url("http://127.0.0.1:8000") is None
        assert validate_alpaca_base_url("http://169.254.169.254/latest/meta-data") is None
        # wrong scheme / foreign host / IP literal / creds / odd port
        assert validate_alpaca_base_url("http://api.alpaca.markets") is None
        assert validate_alpaca_base_url("https://evil.com") is None
        assert validate_alpaca_base_url("https://10.0.0.5") is None
        assert validate_alpaca_base_url("https://user:pass@api.alpaca.markets") is None
        assert validate_alpaca_base_url("https://api.alpaca.markets:8443") is None
        assert validate_alpaca_base_url("") is None
        assert validate_alpaca_base_url(None) is None

    def test_rejects_dns_rebinding_to_private_ip(self, monkeypatch):
        from dashboard.api.hardening import validate_alpaca_base_url
        # Host passes the name allowlist but resolves to a private address
        # (simulated rebinding) — must be rejected.
        monkeypatch.setattr(
            socket, "getaddrinfo",
            lambda host, port: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("10.0.0.99", 443))],
        )
        assert validate_alpaca_base_url("https://api.alpaca.markets") is None

    def test_settings_reject_bad_base_url_for_tenant(self, client, supabase_env):
        app.dependency_overrides[get_config] = lambda: SupabaseMockConfig()
        with patch("dashboard.api.deps._decode_supabase_jwt") as mock_decode:
            mock_decode.return_value = {"sub": "strix_fix_ssrf_user", "aal": "aal1"}
            headers = {"Authorization": "Bearer x"}
            for bad in ("http://169.254.169.254", "http://127.0.0.1:8000", "https://evil.com"):
                res = client.post("/api/settings", json={"alpaca_base_url": bad}, headers=headers)
                assert res.status_code == 400, bad
            res = client.post("/api/settings", json={"alpaca_base_url": "https://api.alpaca.markets"}, headers=headers)
            assert res.status_code == 200
        app.dependency_overrides.clear()

    def test_get_alpaca_falls_back_when_stored_url_invalid(self, monkeypatch):
        """Defense in depth: a stored bad URL (e.g. from before the fix) must
        never carry credentials — fall back to the safe default endpoint."""
        from dashboard.api.deps import get_alpaca
        from shariah_algo_trader.execution.alpaca_client import AlpacaClient

        class Cfg:
            allowed_google_emails = set()
            alpaca_base_url = "https://paper-api.alpaca.markets"

        # get_alpaca replaces any non-Config cfg with get_config(), so the
        # paper fallback must be pinned via the global config — otherwise the
        # assertion depends on the server's live .env ALPACA_BASE_URL.
        monkeypatch.setattr(
            "dashboard.api.deps.get_config",
            lambda: SimpleNamespace(
                alpaca_base_url="https://paper-api.alpaca.markets",
                allowed_google_emails=set(),
            ),
        )

        request = SimpleNamespace(
            state=SimpleNamespace(user_id="strix_fix_legacy_user", user_email=None, user={})
        )
        monkeypatch.setattr(
            "dashboard.api.user_store.get_user_settings",
            lambda uid: {
                "trading_mode": "paper",
                "alpaca_api_key": "KEY",
                "alpaca_api_secret": "SECRET",
                "alpaca_base_url": "http://169.254.169.254",  # old bad row
            },
        )
        with patch.object(AlpacaClient, "__init__", lambda self, k, s, b: setattr(self, "_base_url", b)):
            client = get_alpaca(request, Cfg())
        assert client is not None
        assert client._base_url == "https://paper-api.alpaca.markets"


# ═════════════════════════════════════════════════════════════════════════════
# vuln-0002 — admin configuration disclosure
# ═════════════════════════════════════════════════════════════════════════════

class TestAdminSettingsDisclosure:
    def test_non_admin_gets_no_admin_block(self, client, supabase_env):
        app.dependency_overrides[get_config] = lambda: SupabaseMockConfig()
        with patch("dashboard.api.deps._decode_supabase_jwt") as mock_decode:
            mock_decode.return_value = {"sub": "strix_fix_tenant", "aal": "aal1"}
            res = client.get("/api/settings", headers={"Authorization": "Bearer x"})
            assert res.status_code == 200
            data = res.json()
            # Per-user fields still present
            assert data["top_n"] == 20
            assert data["trading_mode"] == "paper"
            # Admin block must be absent entirely — not masked, not null
            for field in ("dashboard_password_masked", "google_client_id_masked",
                          "google_client_secret_masked", "google_redirect_uri",
                          "allowed_google_emails"):
                assert field not in data, field
        app.dependency_overrides.clear()

    def test_non_admin_write_to_admin_fields_rejected(self, client, supabase_env):
        app.dependency_overrides[get_config] = lambda: SupabaseMockConfig()
        with patch("dashboard.api.deps._decode_supabase_jwt") as mock_decode:
            mock_decode.return_value = {"sub": "strix_fix_tenant", "aal": "aal1"}
            headers = {"Authorization": "Bearer x"}
            res = client.post("/api/settings", json={"dashboard_password": "hacked"}, headers=headers)
            assert res.status_code == 403
            res = client.post("/api/settings", json={"google_redirect_uri": "https://evil.com/cb"}, headers=headers)
            assert res.status_code == 403
            res = client.post("/api/settings", json={"allowed_google_emails": ["attacker@gmail.com"]}, headers=headers)
            assert res.status_code == 403
        app.dependency_overrides.clear()

    def test_admin_sees_masked_admin_block(self, client, supabase_env, monkeypatch):
        app.dependency_overrides[get_config] = lambda: SupabaseMockConfig()
        monkeypatch.setenv("DASHBOARD_PASSWORD", "securepassword")
        monkeypatch.delenv("GOOGLE_CLIENT_SECRET", raising=False)
        with patch("dashboard.api.deps._decode_supabase_jwt") as mock_decode:
            mock_decode.return_value = {
                "sub": "strix_fix_admin",
                "email": "aqilnazri9@gmail.com",
                "aal": "aal1",
            }
            res = client.get("/api/settings", headers={"Authorization": "Bearer x"})
            assert res.status_code == 200
            data = res.json()
            assert data["dashboard_password_masked"] == "••••••••••••"
            assert data["allowed_google_emails"] == ["a••••9@gmail.com"]
        app.dependency_overrides.clear()


# ═════════════════════════════════════════════════════════════════════════════
# vuln-0003 — live mode without server-side risk acknowledgment
# ═════════════════════════════════════════════════════════════════════════════

class TestLiveModeRiskAck:
    def test_live_switch_requires_server_side_ack(self, client, supabase_env):
        app.dependency_overrides[get_config] = lambda: SupabaseMockConfig()
        with patch("dashboard.api.deps._decode_supabase_jwt") as mock_decode:
            mock_decode.return_value = {"sub": "strix_fix_ack_user", "aal": "aal1"}
            headers = {"Authorization": "Bearer x"}

            # No ack → refused (this was the vulnerability)
            res = client.post("/api/settings/mode", json={"mode": "live"}, headers=headers)
            assert res.status_code == 400
            assert "Risk acknowledgment required" in res.json()["detail"]

            # With ack → accepted and persisted
            res = client.post("/api/settings/mode", json={"mode": "live", "riskAcknowledged": True}, headers=headers)
            assert res.status_code == 200
            assert res.json()["trading_mode"] == "live"

            # Subsequent switches without re-sending ack are allowed
            res = client.post("/api/settings/mode", json={"mode": "paper"}, headers=headers)
            assert res.status_code == 200
            res = client.post("/api/settings/mode", json={"mode": "live"}, headers=headers)
            assert res.status_code == 200

            # The acknowledgment is persisted per-user (audit trail)
            from dashboard.api.user_store import get_user_settings
            data = get_user_settings("strix_fix_ack_user")
            assert data is not None
            assert data["risk_acknowledged_at"]
        app.dependency_overrides.clear()


# ═════════════════════════════════════════════════════════════════════════════
# vuln-0004 — missing function-level authorization on universe refresh
# ═════════════════════════════════════════════════════════════════════════════

class TestUniverseRefreshAuthz:
    # /api/universe/refresh is rate-limited to 2 requests/60s per client IP by
    # a process-wide, module-level limiter (dashboard/api/main.py's
    # RateLimitMiddleware instance persists for the whole test session). Give
    # each test its own X-Forwarded-For so it isn't starved by other tests/
    # runs that already exercised this same endpoint from the default IP.
    def test_non_admin_cannot_trigger_refresh(self, client, supabase_env):
        app.dependency_overrides[get_config] = lambda: SupabaseMockConfig()
        with patch("dashboard.api.deps._decode_supabase_jwt") as mock_decode:
            mock_decode.return_value = {"sub": "strix_fix_tenant", "aal": "aal1"}
            res = client.post(
                "/api/universe/refresh",
                headers={"Authorization": "Bearer x", "X-Forwarded-For": "10.10.10.1"},
            )
            assert res.status_code == 403
        app.dependency_overrides.clear()

    def test_admin_can_trigger_refresh(self, client, supabase_env):
        app.dependency_overrides[get_config] = lambda: SupabaseMockConfig()
        async def _noop(cache, cfg, portfolio):
            pass
        with patch("dashboard.api.deps._decode_supabase_jwt") as mock_decode, \
             patch("dashboard.api.routers.universe._refresh_background", new=_noop):
            mock_decode.return_value = {
                "sub": "strix_fix_admin",
                "email": "aqilnazri9@gmail.com",
                "aal": "aal1",
            }
            res = client.post(
                "/api/universe/refresh",
                headers={"Authorization": "Bearer x", "X-Forwarded-For": "10.10.10.2"},
            )
            assert res.status_code == 200
            assert res.json()["status"] == "computing"
        app.dependency_overrides.clear()

    def test_per_account_cooldown(self, supabase_env):
        """Direct function-level check (bypasses the per-IP middleware limiter)."""
        from fastapi import BackgroundTasks
        from dashboard.api.routers import universe as universe_router
        universe_router._last_refresh_at.clear()

        cfg = SimpleNamespace(allowed_google_emails={"aqilnazri9@gmail.com"})
        request = SimpleNamespace(
            state=SimpleNamespace(user_id="strix_fix_admin", user_email="aqilnazri9@gmail.com", user={})
        )
        cache = SimpleNamespace(computing=False, stocks=[])
        first = universe_router.refresh_universe(request, BackgroundTasks(), cfg, None, cache)
        assert first["status"] == "computing"
        cache.computing = False  # simulate the background recompute finishing
        with pytest.raises(HTTPException) as excinfo:
            universe_router.refresh_universe(request, BackgroundTasks(), cfg, None, cache)
        assert excinfo.value.status_code == 429

    def test_first_ever_refresh_not_blocked_by_low_monotonic_clock(self, supabase_env, monkeypatch):
        """time.monotonic() is time since an arbitrary reference point (often
        system boot on Linux), not the epoch — it can be under the 60s cooldown
        window right after a fresh process start (a freshly-booted CI runner, or
        just after a systemd restart). A brand-new user_key must never be
        spuriously rate-limited just because the clock itself is young."""
        from fastapi import BackgroundTasks
        from dashboard.api.routers import universe as universe_router
        universe_router._last_refresh_at.clear()
        monkeypatch.setattr(universe_router.time, "monotonic", lambda: 5.0)

        cfg = SimpleNamespace(allowed_google_emails={"aqilnazri9@gmail.com"})
        request = SimpleNamespace(
            state=SimpleNamespace(user_id="strix_fix_fresh_clock", user_email="aqilnazri9@gmail.com", user={})
        )
        cache = SimpleNamespace(computing=False, stocks=[])
        result = universe_router.refresh_universe(request, BackgroundTasks(), cfg, None, cache)
        assert result["status"] == "computing"


# ═════════════════════════════════════════════════════════════════════════════
# vuln-0005 — cross-user notifications feed
# ═════════════════════════════════════════════════════════════════════════════

class TestNotificationsIsolation:
    def _seed(self):
        from dashboard.api import db as dbmod
        dbmod.init_db()
        old_ts = "2020-01-01T00:00:00Z"  # old enough to never hit daily digests
        dbmod.insert_notification("pfx_global_1", "platform", "platform", "critical",
                                  "Global Alert", "infra", old_ts, user_id=None)
        dbmod.insert_notification("pfx_user_a_1", "system", "warning", "warning",
                                  "A Warning", "for A", old_ts, user_id="strix_fix_a")
        dbmod.insert_notification("pfx_user_b_1", "system", "warning", "warning",
                                  "B Warning", "for B", old_ts, user_id="strix_fix_b")
        return dbmod

    def test_feed_is_tenant_isolated(self, client, supabase_env):
        self._seed()
        app.dependency_overrides[get_config] = lambda: SupabaseMockConfig()
        with patch("dashboard.api.deps._decode_supabase_jwt") as mock_decode:
            # User A sees only A's items — not B's, not the global one
            mock_decode.return_value = {"sub": "strix_fix_a", "aal": "aal1"}
            res_a = client.get("/api/notifications", headers={"Authorization": "Bearer a"})
            ids_a = {item["id"] for item in res_a.json()["items"]}
            assert ids_a == {"pfx_user_a_1"}

            # User B sees only B's items
            mock_decode.return_value = {"sub": "strix_fix_b", "aal": "aal1"}
            res_b = client.get("/api/notifications", headers={"Authorization": "Bearer b"})
            ids_b = {item["id"] for item in res_b.json()["items"]}
            assert ids_b == {"pfx_user_b_1"}

            # Admin sees everything including the platform-level item
            mock_decode.return_value = {"sub": "strix_fix_admin", "email": "aqilnazri9@gmail.com", "aal": "aal1"}
            res_admin = client.get("/api/notifications", headers={"Authorization": "Bearer admin"})
            ids_admin = {item["id"] for item in res_admin.json()["items"]}
            assert {"pfx_global_1", "pfx_user_a_1", "pfx_user_b_1"} <= ids_admin
        app.dependency_overrides.clear()

    def test_read_state_is_owner_scoped(self, client, supabase_env):
        self._seed()
        app.dependency_overrides[get_config] = lambda: SupabaseMockConfig()
        with patch("dashboard.api.deps._decode_supabase_jwt") as mock_decode:
            # User B tries to mark A's item as read — must be a no-op
            mock_decode.return_value = {"sub": "strix_fix_b", "aal": "aal1"}
            client.patch("/api/notifications/pfx_user_a_1/read", headers={"Authorization": "Bearer b"})
            mock_decode.return_value = {"sub": "strix_fix_a", "aal": "aal1"}
            res_a = client.get("/api/notifications", headers={"Authorization": "Bearer a"})
            item_a = next(i for i in res_a.json()["items"] if i["id"] == "pfx_user_a_1")
            assert item_a["read"] is False

            # User A's own read-all only touches A's items
            client.patch("/api/notifications/read-all", headers={"Authorization": "Bearer a"})
            res_a = client.get("/api/notifications", headers={"Authorization": "Bearer a"})
            assert res_a.json()["unread_count"] == 0

            # B's item is untouched by A's read-all
            mock_decode.return_value = {"sub": "strix_fix_b", "aal": "aal1"}
            res_b = client.get("/api/notifications", headers={"Authorization": "Bearer b"})
            item_b = next(i for i in res_b.json()["items"] if i["id"] == "pfx_user_b_1")
            assert item_b["read"] is False
        app.dependency_overrides.clear()


# ═════════════════════════════════════════════════════════════════════════════
# vuln-0006 — HTTP 500 on /api/compare for empty portfolio history
# ═════════════════════════════════════════════════════════════════════════════

class TestCompareEmptyHistory:
    def test_fresh_account_gets_graceful_empty_response(self, client, supabase_env):
        app.dependency_overrides[get_config] = lambda: SupabaseMockConfig()
        with patch("dashboard.api.deps._decode_supabase_jwt") as mock_decode:
            # Exactly the Strix PoC: brand-new account, no keys, empty history
            mock_decode.return_value = {"sub": "strix_fix_fresh_user", "aal": "aal1"}
            res = client.get("/api/compare", headers={"Authorization": "Bearer x"})
            assert res.status_code == 200
            data = res.json()
            assert data["dates"] == []
            assert data["shariah_equity"] == []
            assert data["daytrader_equity"] == []
            assert data["shariah"]["total_return_pct"] == 0.0
            assert data["daytrader_available"] is False
        app.dependency_overrides.clear()
