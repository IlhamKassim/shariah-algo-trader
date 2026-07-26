import base64
import hashlib
import os
from cryptography.fernet import Fernet

def _get_fernet_key() -> bytes:
    """Derive a 32-byte Fernet key from the server master secret environment variable."""
    raw_secret = (
        os.environ.get("ENCRYPTION_MASTER_KEY")
        or os.environ.get("DASHBOARD_SESSION_SECRET")
        or "shariah-algo-trader-master-encryption-key-2026"
    )
    digest = hashlib.sha256(raw_secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)

def encrypt_credential(plain_text: str | None) -> str | None:
    """Encrypt a plain text credential into an AES-256 Fernet token."""
    if not plain_text:
        return None
    fernet = Fernet(_get_fernet_key())
    return fernet.encrypt(plain_text.encode("utf-8")).decode("utf-8")

def decrypt_credential(cipher_text: str | None) -> str | None:
    """Decrypt an AES-256 Fernet token back to plain text."""
    if not cipher_text:
        return None
    try:
        fernet = Fernet(_get_fernet_key())
        return fernet.decrypt(cipher_text.encode("utf-8")).decode("utf-8")
    except Exception:
        return None
