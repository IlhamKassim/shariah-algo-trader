import pytest
from dashboard.api.crypto import encrypt_credential, decrypt_credential


def test_credential_encryption_roundtrip():
    original_key = "PKI4MGJIDVVHHTZOG37RMREWGB"
    cipher_text = encrypt_credential(original_key)
    assert cipher_text is not None
    assert cipher_text != original_key

    decrypted_key = decrypt_credential(cipher_text)
    assert decrypted_key == original_key

def test_empty_credential_encryption():
    assert encrypt_credential(None) is None
    assert decrypt_credential(None) is None
    assert decrypt_credential("invalid-token") is None


def test_missing_master_key_fails_closed(monkeypatch):
    monkeypatch.delenv("ENCRYPTION_MASTER_KEY", raising=False)
    with pytest.raises(RuntimeError):
        encrypt_credential("some-secret")
