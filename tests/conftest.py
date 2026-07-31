import pytest


@pytest.fixture(autouse=True)
def _encryption_master_key(monkeypatch):
    """Ensure credential encryption has a master key in every test process.

    dashboard.api.crypto._get_fernet_key fails closed when this is unset,
    so any test path that (transitively) encrypts/decrypts credentials
    needs a value present regardless of the local .env.
    """
    monkeypatch.setenv("ENCRYPTION_MASTER_KEY", "test-only-encryption-master-key")
