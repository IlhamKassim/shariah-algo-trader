import os
import sys
from pathlib import Path

import pytest

# Make the standalone admin app's package importable: admin-app/ (hyphen)
# holds the importable admin_app/ package, which is not on the default
# sys.path under pytest (uvicorn reaches it via --app-dir at runtime).
_ADMIN_APP_DIR = Path(__file__).resolve().parent.parent / "admin-app"
if str(_ADMIN_APP_DIR) not in sys.path:
    sys.path.insert(0, str(_ADMIN_APP_DIR))

# The admin SPA static mount (admin_app/api/main.py:65-67) is conditional on
# admin-app/web/dist existing at IMPORT time of the app module. dist/ is
# gitignored (produced by `npm run build` at deploy time), so a fresh checkout
# has no dist/. Materialize a placeholder index.html HERE — conftest.py loads
# before ANY test module is imported, so every test file sees the mount no
# matter the import order (previously test_admin_api.py's module-level import
# of admin_app.api.main raced the scaffold module's own placeholder hack and
# won on a fresh checkout, leaving GET / to 404).
_ADMIN_WEB_DIST = _ADMIN_APP_DIR / "web" / "dist"
_ADMIN_WEB_DIST.mkdir(parents=True, exist_ok=True)
_ADMIN_INDEX = _ADMIN_WEB_DIST / "index.html"
if not _ADMIN_INDEX.exists():
    _ADMIN_INDEX.write_text(
        "<!doctype html><html><head><title>Shariah Admin</title></head>"
        '<body><div id="root"></div></body></html>',
        encoding="utf-8",
    )


@pytest.fixture(autouse=True)
def _encryption_master_key(monkeypatch):
    """Ensure credential encryption has a master key in every test process.

    dashboard.api.crypto._get_fernet_key fails closed when this is unset,
    so any test path that (transitively) encrypts/decrypts credentials
    needs a value present regardless of the local .env.
    """
    monkeypatch.setenv("ENCRYPTION_MASTER_KEY", "test-only-encryption-master-key")


@pytest.fixture(autouse=True)
def _alpaca_env_defaults(monkeypatch):
    """Config() demands ALPACA_*/ETF_SYMBOL/TOP_N at construction (config.py:6-12).

    On this server they come from the gitignored .env; a fresh checkout or CI
    runner has none, so Config() raises OSError in any test that constructs it.
    Fill only the gaps with inert values -- tests never reach the real broker.
    """
    defaults = {
        "ALPACA_API_KEY": "test-key",
        "ALPACA_API_SECRET": "test-secret",
        "ALPACA_BASE_URL": "https://paper-api.alpaca.markets",
        "ETF_SYMBOL": "SPUS",
        "TOP_N": "20",
    }
    for key, val in defaults.items():
        if not os.environ.get(key):
            monkeypatch.setenv(key, val)


@pytest.fixture(autouse=True)
def _mock_dns_for_alpaca(monkeypatch):
    """Ensure socket.getaddrinfo never flakes on external DNS lookups for Alpaca hosts in CI."""
    import socket
    real_getaddrinfo = socket.getaddrinfo

    def _safe_getaddrinfo(host, port, *args, **kwargs):
        if host and isinstance(host, str) and (host == "alpaca.markets" or host.endswith(".alpaca.markets")):
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("104.22.66.1", port or 443))]
        return real_getaddrinfo(host, port, *args, **kwargs)

    monkeypatch.setattr(socket, "getaddrinfo", _safe_getaddrinfo)

