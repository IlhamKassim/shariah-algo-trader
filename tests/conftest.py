import sys
from pathlib import Path

import pytest

# Make the standalone admin app's package importable: admin-app/ (hyphen)
# holds the importable admin_app/ package, which is not on the default
# sys.path under pytest (uvicorn reaches it via --app-dir at runtime).
_ADMIN_APP_DIR = Path(__file__).resolve().parent.parent / "admin-app"
if str(_ADMIN_APP_DIR) not in sys.path:
    sys.path.insert(0, str(_ADMIN_APP_DIR))


@pytest.fixture(autouse=True)
def _encryption_master_key(monkeypatch):
    """Ensure credential encryption has a master key in every test process.

    dashboard.api.crypto._get_fernet_key fails closed when this is unset,
    so any test path that (transitively) encrypts/decrypts credentials
    needs a value present regardless of the local .env.
    """
    monkeypatch.setenv("ENCRYPTION_MASTER_KEY", "test-only-encryption-master-key")
