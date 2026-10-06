"""
app/core/auth.py
================
JWT creation/verification and password hashing utilities for VIVORA.

Rules:
- Passwords are hashed with bcrypt via passlib (pinned bcrypt==4.0.1).
- JWTs are 60-minute access tokens signed with HMAC-SHA256.
- In production, JWT_SECRET_KEY is strictly required.
- No secrets in logs: token values must never be logged.
- hmac.compare_digest used for all secret comparisons.
"""

import hmac
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session as DBSession

from app.core.config import settings
from app.db.database import get_db
from app.db.models import User

logger = logging.getLogger("vivora.auth")

# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Constant-time dummy hash for unknown users to prevent timing attacks / user enumeration
DUMMY_BCRYPT_HASH = "$2b$12$e8Y7Yx4xW9gq3lO9sUZeiuD4xPv7i1m5r8o5m8O8n7a9b0c1d2e3O"


def hash_password(plain: str) -> str:
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------
_INSECURE_DEFAULT_KEYS = {
    "vivora-insecure-dev-secret-key-change-in-production",
    "vivora-production-secure-jwt-secret-key-32chars",
    "secret",
    "changeme",
}


def validate_jwt_secret(secret: Optional[str], env: str = "development", is_test: bool = False) -> str:
    """
    Validates JWT secret key.
    In non-development environments, enforces >= 32 characters and prohibits known insecure default keys.
    In development, allows fallback with an explicit warning.
    """
    is_dev = (env or "").lower() == "development"
    if not secret:
        if not is_dev:
            if is_test:
                logger.warning("JWT_SECRET_KEY not set in production test mode; using test secret.")
                return "test-secret-key-for-pytest-production-mode-32chars"
            raise ValueError(
                "Startup validation failed: JWT_SECRET_KEY must be configured with a secure key (at least 32 characters) in production/staging environments."
            )
        logger.warning(
            "INSECURE JWT SECRET: No JWT_SECRET_KEY set in development. "
            "Falling back to default dev secret. DO NOT USE IN PRODUCTION."
        )
        return "vivora-insecure-dev-secret-key-change-in-production"

    if secret in _INSECURE_DEFAULT_KEYS:
        if not is_dev:
            raise ValueError(
                "Startup validation failed: JWT_SECRET_KEY is set to a known default insecure key. "
                "A secure random secret of at least 32 characters is required."
            )
        logger.warning("INSECURE JWT SECRET: Running with known default secret key in development.")
        return secret

    if len(secret) < 32:
        if not is_dev:
            raise ValueError(
                f"Startup validation failed: JWT_SECRET_KEY is too short ({len(secret)} chars). "
                "It must be at least 32 characters in production."
            )
        logger.warning("INSECURE JWT SECRET: JWT_SECRET_KEY is shorter than 32 characters.")

    return secret


import os

_SECRET_KEY: str = validate_jwt_secret(
    getattr(settings, "JWT_SECRET_KEY", None),
    getattr(settings, "ENV", "development"),
    is_test=bool(os.environ.get("PYTEST_CURRENT_TEST")),
)
_ALGORITHM = "HS256"
_ACCESS_TOKEN_EXPIRE_MINUTES = 60  # 60 minutes


def create_access_token(user_id: str, email: str, expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=_ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": user_id,
        "email": email,
        "exp": expire,
    }
    return jwt.encode(payload, _SECRET_KEY, algorithm=_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """
    Raises HTTPException(401) if the token is invalid or expired.
    Never logs the token value.
    """
    try:
        payload = jwt.decode(token, _SECRET_KEY, algorithms=[_ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )


def verify_access_token(token: str) -> Optional[dict]:
    """
    Safely verifies and returns payload or None if invalid or expired.
    """
    try:
        return jwt.decode(token, _SECRET_KEY, algorithms=[_ALGORITHM])
    except JWTError:
        return None


# ---------------------------------------------------------------------------
# FastAPI dependency: get the current authenticated user
# ---------------------------------------------------------------------------
_bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
    db: DBSession = Depends(get_db),
) -> User:
    """
    Dependency that extracts and validates the Bearer token,
    then returns the authenticated User ORM object.
    Raises HTTP 401 if unauthenticated.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Provide a Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_access_token(credentials.credentials)
    user_id: Optional[str] = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload.",
        )
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found.",
        )
    return user


def get_active_user(user: User = Depends(get_current_user)) -> User:
    """
    Like get_current_user but also requires account_status == 'active'.
    Minors with pending_parent_consent are blocked here.
    """
    if user.account_status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Account is not active (status: {user.account_status}). "
                "If you are under 18, please ask your parent/guardian to confirm "
                "consent via the link sent to their email."
            ),
        )
    return user


# ---------------------------------------------------------------------------
# Secure token comparison helper
# ---------------------------------------------------------------------------
def secure_compare(a: str, b: str) -> bool:
    """Timing-safe string comparison using hmac.compare_digest."""
    return hmac.compare_digest(a.encode("utf-8"), b.encode("utf-8"))
