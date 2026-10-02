"""
app/core/auth.py
================
JWT creation/verification and password hashing utilities for VIVORA.

Rules:
- Passwords are hashed with bcrypt via passlib.
- JWTs are short-lived (15 min default) access tokens.
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


def hash_password(plain: str) -> str:
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------
# Loaded once at module import; never logged.
_SECRET_KEY: str = getattr(settings, "JWT_SECRET_KEY", None) or secrets.token_hex(32)
_ALGORITHM = "HS256"
_ACCESS_TOKEN_EXPIRE_MINUTES = 60  # 1 hour


def create_access_token(user_id: str, email: str) -> str:
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
