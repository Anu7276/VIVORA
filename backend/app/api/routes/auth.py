"""
app/api/routes/auth.py
======================
Authentication routes:
  POST /api/auth/signup           — register a new user
  POST /api/auth/login            — authenticate and receive JWT
  POST /api/auth/parent-consent/confirm — parent confirms via email link token

Rules:
  - Passwords validated: min 8 chars, at least one digit or symbol.
  - Email validated by pydantic EmailStr (uses email-validator).
  - Exact calendar DOB comparison used to determine minor status; client-supplied is_minor flag is IGNORED.
  - Parent email cannot equal child's email (case-insensitive).
  - Minors get account_status="pending_parent_consent" and are emailed a link.
  - Parent consent token is a cryptographically random hex, stored in DB with created_at timestamp,
    enforced with a 48h TTL, confirmed only via the confirm endpoint, never by client JSON input.
  - Login response never includes the password hash.
  - Constant-time dummy bcrypt verification for unknown emails to prevent timing attacks.
  - Rate limiting on /signup and /login per IP and per email.
"""

import hmac
import logging
import re
import secrets
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.orm import Session as DBSession

from app.core.auth import create_access_token, hash_password, verify_password, DUMMY_BCRYPT_HASH, get_active_user
from app.core.config import settings
from app.core.email_sender import get_email_sender
from app.db.database import get_db
from app.db.models import User, ParentConsent

logger = logging.getLogger("vivora.auth")

router = APIRouter()

_MIN_PASSWORD_LEN = 8
_MINOR_AGE_THRESHOLD_YEARS = 18
_CONSENT_TOKEN_BYTES = 32
_CONSENT_LINK_TTL_HOURS = 48


# ─── Rate Limiter ─────────────────────────────────────────────────────────────
from app.core.rate_limiter import SimpleRateLimiter

# Rate limiters: 10 requests / min per IP, 5 requests / min per email
_ip_rate_limiter = SimpleRateLimiter(max_requests=10, window_sec=60)
_email_rate_limiter = SimpleRateLimiter(max_requests=5, window_sec=60)


def _check_rate_limit(request: Request, email: str) -> None:
    client_ip = request.client.host if request.client else "unknown"
    import os
    if os.environ.get("PYTEST_CURRENT_TEST") and client_ip == "testclient":
        if request.headers.get("X-Test-Rate-Limit") != "true":
            return
    if not _ip_rate_limiter.check_and_record(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many authentication requests from your IP. Please try again later.",
        )
    if not _email_rate_limiter.check_and_record(email.strip().lower()):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many authentication requests for this email address. Please try again later.",
        )


# ─── Schemas ──────────────────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    name: str = Field(..., max_length=100)
    email: EmailStr
    password: str = Field(..., max_length=200)
    date_of_birth: str = Field(..., max_length=10)           # ISO date string: YYYY-MM-DD
    parent_email: Optional[EmailStr] = None  # required for minors

    @field_validator("password")
    @classmethod
    def _validate_password(cls, v: str) -> str:
        if len(v) < _MIN_PASSWORD_LEN:
            raise ValueError(
                f"Password must be at least {_MIN_PASSWORD_LEN} characters long."
            )
        if not re.search(r"[0-9!@#$%^&*()_+\-=\[\]{}|;:',.<>?/]", v):
            raise ValueError(
                "Password must contain at least one digit or special character."
            )
        return v

    @field_validator("date_of_birth")
    @classmethod
    def _validate_dob(cls, v: str) -> str:
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError:
            raise ValueError("date_of_birth must be in YYYY-MM-DD format.")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., max_length=200)


class SignupResponse(BaseModel):
    user_id: str
    email: str
    name: str
    status: str                   # "active" or "pending_parent_consent"
    access_token: Optional[str] = None  # None for pending_parent_consent accounts


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    name: str


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _age_from_dob(dob_str: str) -> int:
    """Return age in whole years from a YYYY-MM-DD string using exact calendar comparison."""
    dob = datetime.strptime(dob_str, "%Y-%m-%d").date()
    today = datetime.now(timezone.utc).date()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("/signup", response_model=SignupResponse, status_code=200)
async def signup(req: SignupRequest, request: Request, db: DBSession = Depends(get_db)):
    """
    Register a new user. Exact calendar DOB determines minor status — client-supplied is_minor is ignored.
    Minors receive account_status='pending_parent_consent'; they cannot start sessions
    until the parent confirms via the email link.
    """
    _check_rate_limit(request, str(req.email))

    # 1. Check for duplicate email
    existing = db.query(User).filter(User.email == str(req.email)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        )

    # 2. Determine minor status from DOB (client flag ignored)
    age = _age_from_dob(req.date_of_birth)
    is_minor = age < _MINOR_AGE_THRESHOLD_YEARS

    if is_minor:
        if not req.parent_email:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "Users under 18 must provide a parent or guardian email address "
                    "so that consent can be confirmed before the account is activated."
                ),
            )
        if str(req.parent_email).strip().lower() == str(req.email).strip().lower():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Parent email cannot be the same as the child's email address.",
            )

    # 3. Create user
    account_status = "pending_parent_consent" if is_minor else "active"
    dob_dt = datetime.strptime(req.date_of_birth, "%Y-%m-%d")

    user = User(
        name=req.name,
        email=str(req.email),
        password_hash=hash_password(req.password),
        is_minor=is_minor,
        date_of_birth=dob_dt,
        account_status=account_status,
        role="school" if is_minor else "college",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # 4. For minors: create ParentConsent record and send email
    if is_minor:
        consent_token = secrets.token_hex(_CONSENT_TOKEN_BYTES)
        consent = ParentConsent(
            user_id=user.id,
            parent_email=str(req.parent_email),
            verified=False,
            consent_token=consent_token,
            created_at=datetime.now(timezone.utc),
        )
        db.add(consent)
        db.commit()

        confirm_url = (
            f"{settings.FRONTEND_URL}/parent-consent/confirm?token={consent_token}"
        )
        try:
            sender = get_email_sender()
            sender.send_parent_consent_email(
                parent_email=str(req.parent_email),
                child_name=req.name,
                confirm_url=confirm_url,
            )
        except Exception as e:
            logger.error(f"Failed to send parent consent email for user {user.id}: {e}")
            if settings.ENV == "production":
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to send parent consent verification email. Please try again.",
                )

        return SignupResponse(
            user_id=user.id,
            email=user.email,
            name=user.name,
            status="pending_parent_consent",
            access_token=None,
        )

    # 5. Adult: issue access token immediately
    token = create_access_token(user_id=user.id, email=user.email)
    return SignupResponse(
        user_id=user.id,
        email=user.email,
        name=user.name,
        status="active",
        access_token=token,
    )


@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest, request: Request, db: DBSession = Depends(get_db)):
    """
    Authenticate with email + password. Returns a JWT Bearer token.
    Deliberately uses constant-time comparison and the same error message for both
    'email not found' and 'wrong password' to prevent user enumeration.
    """
    _check_rate_limit(request, str(req.email))

    _auth_err = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    user = db.query(User).filter(User.email == str(req.email)).first()
    if not user or not user.password_hash:
        # Perform constant-time dummy verification to mitigate timing attack
        verify_password(req.password, DUMMY_BCRYPT_HASH)
        raise _auth_err

    if not verify_password(req.password, user.password_hash):
        raise _auth_err

    token = create_access_token(user_id=user.id, email=user.email)
    return LoginResponse(
        access_token=token,
        user_id=user.id,
        email=user.email,
        name=user.name,
    )


@router.post("/parent-consent/confirm")
async def confirm_parent_consent(
    token: str = Query(..., description="Consent token from the parent email link"),
    db: DBSession = Depends(get_db),
):
    """
    Called by the parent when they click the link in the consent email.
    Enforces 48-hour TTL, sets ParentConsent.verified=True, and activates the minor's account.
    Token comparison is timing-safe.
    """
    if not token or len(token) < 16:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or missing consent token.",
        )

    # Fetch the consent records
    consents = db.query(ParentConsent).filter(
        ParentConsent.consent_token.isnot(None)
    ).all()

    # Timing-safe comparison across all records
    matched: Optional[ParentConsent] = None
    for c in consents:
        if c.consent_token and hmac.compare_digest(
            c.consent_token.encode("utf-8"), token.encode("utf-8")
        ):
            matched = c
            break

    if not matched or matched.verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "This consent link is invalid, has already been used, or has expired. "
                "Please ask your child to sign up again to receive a new link."
            ),
        )

    # Enforce 48-hour TTL
    if matched.created_at:
        created_at = matched.created_at
        if created_at.tzinfo is not None:
            created_at = created_at.astimezone(timezone.utc).replace(tzinfo=None)
        now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
        if (now_utc - created_at) > timedelta(hours=_CONSENT_LINK_TTL_HOURS):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This consent link has expired (48-hour limit). Please ask your child to sign up again.",
            )

    # Activate account
    matched.verified = True
    matched.consent_date = datetime.now(timezone.utc).replace(tzinfo=None)
    matched.consent_token = None  # invalidate token immediately after use

    user = db.query(User).filter(User.id == matched.user_id).first()
    if user:
        user.account_status = "active"

    db.commit()

    return {
        "confirmed": True,
        "message": (
            f"Thank you! Consent confirmed. "
            f"The account for '{user.name if user else 'your child'}' is now active."
        ),
    }


@router.get("/me")
def get_current_user_profile(current_user: User = Depends(get_active_user)):
    """Return the currently authenticated active user's profile."""
    return {
        "user_id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "account_status": current_user.account_status,
    }

