"""
app/api/routes/session.py
=========================
Session management routes.

Security changes (Phase 1):
  - All routes require a valid JWT Bearer token (via get_active_user dependency).
  - demo-student and register-student endpoints are DELETED.
  - GET /{session_id}: scoped to the authenticated user (404 for cross-user access).
  - GET /{session_id}: reference_answer is OMITTED for unanswered questions.
  - mode validated as one of: school | college | interview.
  - time_limit_min validated as 1..MAX_TIME_LIMIT_MIN (from settings).
"""

import os
from datetime import datetime, timezone
from starlette.requests import Request
from typing import Optional, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy.orm import Session as DBSession

from app.core.auth import get_active_user
from app.core.config import settings
from app.core.rate_limiter import session_start_limiter
from app.db.database import get_db
from app.db.models import Session, Question, Answer, Evaluation, User
from app.services.session_service import session_service

router = APIRouter()

_VALID_MODES = {"school", "college", "interview"}


class CreateSessionRequest(BaseModel):
    mode: str = Field("school", max_length=20)
    title: str = Field("Science Viva Practice", max_length=200)
    content_text: str = Field("", max_length=500_000)
    document_id: Optional[str] = Field(None, max_length=100)
    question_source: Optional[str] = Field(None, max_length=50)
    time_limit_min: Optional[int] = Field(None, ge=1, le=180)
    # job_role/tech_stack/experience_level only relevant for interview mode
    job_role: Optional[str] = Field(None, max_length=100)
    tech_stack: Optional[str] = Field(None, max_length=200)
    experience_level: Optional[str] = Field(None, max_length=50)
    language: Optional[str] = Field("en-IN", max_length=20)

    @field_validator("mode")
    @classmethod
    def _validate_mode(cls, v: str) -> str:
        if v not in _VALID_MODES:
            raise ValueError(
                f"mode must be one of: {', '.join(sorted(_VALID_MODES))}. Got: '{v}'."
            )
        return v

    @field_validator("time_limit_min")
    @classmethod
    def _validate_time_limit(cls, v: Optional[int]) -> Optional[int]:
        if v is None:
            return v
        if v < 1:
            raise ValueError("time_limit_min must be at least 1 minute.")
        if v > settings.MAX_TIME_LIMIT_MIN:
            raise ValueError(
                f"time_limit_min must not exceed {settings.MAX_TIME_LIMIT_MIN} minutes."
            )
        return v


@router.post("/start")
async def start_new_session(
    req: CreateSessionRequest,
    request: Request,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_active_user),   # JWT required + account active
):
    """
    Initialize a new viva session.
    Requires a valid JWT Bearer token; the session is scoped to the authenticated user.
    Enforces per-minute rate limit and daily session cap.
    """
    is_test = bool(os.environ.get("PYTEST_CURRENT_TEST"))
    check_limits = (not is_test) or (request.headers.get("X-Test-Rate-Limit") == "true")

    if check_limits:
        if not session_start_limiter.check_and_record(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many session creation requests. Please wait a moment before starting another session.",
            )

        now_utc = datetime.now(timezone.utc)
        today_start = datetime(now_utc.year, now_utc.month, now_utc.day)
        daily_count = db.query(Session).filter(
            Session.user_id == current_user.id,
            Session.created_at >= today_start
        ).count()
        if daily_count >= settings.DAILY_SESSION_LIMIT:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Daily session limit reached ({settings.DAILY_SESSION_LIMIT} sessions/day). Please try again tomorrow.",
            )
    session = await session_service.create_session(
        db=db,
        mode=req.mode,
        title=req.title,
        content_text=req.content_text,
        document_id=req.document_id,
        question_source=req.question_source,
        time_limit_min=req.time_limit_min,
        user_id=current_user.id,
        job_role=req.job_role,
        tech_stack=req.tech_stack,
        experience_level=req.experience_level,
        language=req.language or "en-IN",
    )
    return {
        "session_id": session.id,
        "session_token": session.session_token,
        "mode": session.mode,
        "question_source": session.question_source,
        "time_limit_min": session.time_limit_min,
        "status": session.status,
        "total_questions": len(session.questions),
    }


@router.get("/{session_id}")
async def get_session_details(
    session_id: str,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_active_user),
):
    """
    Fetch session metadata and questions.

    Security rules:
      - Returns 404 (not 403) for sessions that belong to another user,
        to prevent resource enumeration.
      - reference_answer is omitted for questions the student has not yet answered.
        Revealing it before the student answers enables cheating.
    """
    session = session_service.get_session(db, session_id, eager=True)

    # 404 for both "not found" and "belongs to another user" — no resource enumeration
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found.")

    questions_list = []
    for q in session.questions:
        answered = bool(q.answers)
        ans_data = None
        if answered:
            ans = q.answers[0]
            ans_data = {
                "id": ans.id,
                "transcript": ans.transcript,
                "duration_sec": ans.duration_sec,
                "evaluation": {
                    "overall_score": ans.evaluation.overall_score,
                    "correctness_score": ans.evaluation.correctness_score,
                    "feedback": ans.evaluation.feedback,
                    "model_answer": ans.evaluation.model_answer,
                } if ans.evaluation else None,
            }

        q_dict = {
            "id": q.id,
            "order_no": q.order_no,
            "question_text": q.question_text,
            "topic": q.topic,
            "difficulty": q.difficulty,
            "origin": q.origin,
            "answer": ans_data,
        }
        # Only include reference_answer after the student has answered
        if answered:
            q_dict["reference_answer"] = q.reference_answer

        questions_list.append(q_dict)

    return {
        "session_id": session.id,
        "mode": session.mode,
        "time_limit_min": session.time_limit_min,
        "status": session.status,
        "started_at": (session.started_at or session.created_at).isoformat() if (session.started_at or session.created_at) else None,
        "questions": questions_list,
    }
