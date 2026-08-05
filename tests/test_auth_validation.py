import pytest
from dashboard.api.routers.auth import validate_email_format, validate_password_complexity


def test_validate_email_format():
    assert validate_email_format("johnny@gmail.com") is True
    assert validate_email_format("user.name+tag@sub.domain.co") is True

    # Invalid formats
    assert validate_email_format("invalid-email") is False
    assert validate_email_format("user@") is False
    assert validate_email_format("@domain.com") is False
    assert validate_email_format("user@domain") is False
    assert validate_email_format("") is False


def test_validate_password_complexity():
    # Valid strong password
    valid, msg = validate_password_complexity("StrongP@ssw0rd123!")
    assert valid is True
    assert msg == ""

    # Less than 12 chars
    valid, msg = validate_password_complexity("Short1!")
    assert valid is False
    assert "at least 12 characters" in msg

    # Missing uppercase
    valid, msg = validate_password_complexity("weakp@ssw0rd123!")
    assert valid is False
    assert "uppercase" in msg

    # Missing lowercase
    valid, msg = validate_password_complexity("WEAKP@SSW0RD123!")
    assert valid is False
    assert "lowercase" in msg

    # Missing numeric digit
    valid, msg = validate_password_complexity("StrongP@ssword!")
    assert valid is False
    assert "numeric digit" in msg

    # Missing special char
    valid, msg = validate_password_complexity("StrongPassword123")
    assert valid is False
    assert "special character" in msg
