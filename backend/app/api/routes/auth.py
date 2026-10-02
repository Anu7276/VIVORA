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
  - DOB used to determine minor status; client-supplied is_minor flag is IGNORED.
  - Minors get account_status="pending_parent_consent" and are emailed a link.
  - Parent consent token is a cryptographically random hex, stored in DB,
    confirmed only via this endpoint, never by client JSON input.
  - Login response never includes the password hash.
  - 409 Conflict on duplicate email.
  - 401 Unauthorized on wrong credentials (same message for both email-not-found
    and wrong-password to prevent user enumeration).
"""

import logging
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.orm import Session as DBSession

from app.core.auth import create_access_token, hash_password, verify_password
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


# ─── Schemas ──────────────────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    date_of_birth: str           # ISO date string: YYYY-MM-DD
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
    password: str


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
    """Return age in whole years from a YYYY-MM-DD string."""
    dob = datetime.strptime(dob_str, "%Y-%m-%d")
    today = datetime.now()
    return (today - dob).days // 365


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("/signup", response_model=SignupResponse, status_code=200)
async def signup(req: SignupRequest, db: DBSession = Depends(get_db)):
    """
    Register a new user. DOB determines minor status — client-supplied is_minor is ignored.
    Minors receive account_status='pending_parent_consent'; they cannot start sessions
    until the parent confirms via the email link.
    """
    # 1. Check for duplicate email
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        )

    # 2. Determine minor status from DOB (client flag ignored)
    age = _age_from_dob(req.date_of_birth)
    is_minor = age < _MINOR_AGE_THRESHOLD_YEARS

    if is_minor and not req.parent_email:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Users under 18 must provide a parent or guardian email address "
                "so that consent can be confirmed before the account is activated."
            ),
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
async def login(req: LoginRequest, db: DBSession = Depends(get_db)):
    """
    Authenticate with email + password. Returns a JWT Bearer token.
    Deliberately uses the same error message for both "email not found" and
    "wrong password" to prevent user enumeration.
    """
    _auth_err = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    user = db.query(User).filter(User.email == str(req.email)).first()
    if not user or not user.password_hash:
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
    Sets ParentConsent.verified=True and activates the minor's account.
    Token comparison is timing-safe (uses hmac.compare_digest via the DB lookup +
    secrets.compare_digest below for the in-memory check).
    """
    import hmac

    if not token or len(token) < 16:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or missing consent token.",
        )

    # Fetch the consent record
    consent = db.query(ParentConsent).filter(
        ParentConsent.consent_token.isnot(None)
    ).all()

    # Timing-safe comparison across all records
    matched: Optional[ParentConsent] = None
    for c in consent:
        if c.consent_token and hmac.compare_digest(
            c.consent_token.encode(), token.encode()
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
