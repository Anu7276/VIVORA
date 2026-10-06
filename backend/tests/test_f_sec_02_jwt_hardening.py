import pytest
from app.core.auth import validate_jwt_secret

def test_production_rejects_empty_jwt_secret():
    with pytest.raises(ValueError, match="JWT_SECRET_KEY"):
        validate_jwt_secret("", "production")

    with pytest.raises(ValueError, match="JWT_SECRET_KEY"):
        validate_jwt_secret(None, "production")

def test_production_rejects_short_jwt_secret():
    with pytest.raises(ValueError, match="at least 32"):
        validate_jwt_secret("short-secret-less-than-32-chars", "production")

def test_production_rejects_known_default_secrets():
    with pytest.raises(ValueError, match="known default"):
        validate_jwt_secret("vivora-production-secure-jwt-secret-key-32chars", "production")

    with pytest.raises(ValueError, match="known default"):
        validate_jwt_secret("vivora-insecure-dev-secret-key-change-in-production", "production")

def test_production_accepts_strong_secret():
    valid = "a" * 32
    assert validate_jwt_secret(valid, "production") == valid

def test_development_allows_fallback_with_warning():
    res = validate_jwt_secret(None, "development")
    assert res is not None
    assert len(res) > 0
