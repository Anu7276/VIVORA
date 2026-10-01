from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.db.database import get_db
from app.db.models import Session, Question, Answer, Evaluation, User, ParentConsent
from app.services.session_service import session_service

router = APIRouter()

class CreateSessionRequest(BaseModel):
    mode: str = "school"  # school | college | interview
    title: str = "Science Viva Practice"
    content_text: str = ""
    question_source: Optional[str] = None
    time_limit_min: Optional[int] = None
    user_id: Optional[str] = None
    is_minor: Optional[bool] = None  # Client-supplied is_minor is NOT trusted


CONSENT_GATE_ERROR = (
    "Session creation is temporarily blocked across all modes pending authentication and consent verification. "
    "Client-supplied is_minor flags are not trusted. To create a session, provide an authenticated user_id "
    "with a stored date_of_birth showing an adult age (18+) or a verified parent_consents record. "
    "(Temporary safeguard, not a real safeguard until auth system is implemented)."
)

@router.post("/start")
async def start_new_session(req: CreateSessionRequest, db: DBSession = Depends(get_db)):
    """Initializes a new viva session and prepares questions."""

    # ── Consent gate (Requirement 1) ──────────────────────────────────────────
    # Applied to ALL modes. Client-supplied is_minor flag is NEVER trusted.
    # Allowed ONLY if:
    #   1. Authenticated user has stored date_of_birth showing age >= 18 (adult), OR
    #   2. Authenticated user has a verified parent_consents record.
    # Label: temporary, not a real safeguard until full auth exists.
    is_authorized = False
    if req.user_id:
        user = db.query(User).filter(User.id == req.user_id).first()
        if user:
            if user.date_of_birth:
                today = datetime.utcnow()
                dob = user.date_of_birth
                age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
                if age >= 18:
                    is_authorized = True
            if not is_authorized:
                consent = db.query(ParentConsent).filter(
                    ParentConsent.user_id == user.id,
                    ParentConsent.verified == True
                ).first()
                if consent:
                    is_authorized = True

    if not is_authorized:
        raise HTTPException(
            status_code=423,
            detail=CONSENT_GATE_ERROR,
        )

    session = session_service.create_session(
        db=db,
        mode=req.mode,
        title=req.title,
        content_text=req.content_text,
        question_source=req.question_source,
        time_limit_min=req.time_limit_min,
        user_id=req.user_id
    )
    return {
        "session_id": session.id,
        "session_token": session.session_token,
        "mode": session.mode,
        "question_source": session.question_source,
        "time_limit_min": session.time_limit_min,
        "status": session.status,
        "total_questions": len(session.questions)
    }

@router.get("/{session_id}")
async def get_session_details(session_id: str, db: DBSession = Depends(get_db)):
    """Fetches session metadata, current questions and answers."""
    session = session_service.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    questions_list = []
    for q in session.questions:
        ans_data = None
        if q.answers:
            ans = q.answers[0]
            ans_data = {
                "id": ans.id,
                "transcript": ans.transcript,
                "duration_sec": ans.duration_sec,
                "evaluation": {
                    "overall_score": ans.evaluation.overall_score,
                    "correctness_score": ans.evaluation.correctness_score,
                    "feedback": ans.evaluation.feedback,
                    "model_answer": ans.evaluation.model_answer
                } if ans.evaluation else None
            }

        questions_list.append({
            "id": q.id,
            "order_no": q.order_no,
            "question_text": q.question_text,
            "topic": q.topic,
            "difficulty": q.difficulty,
            "origin": q.origin,
            "answer": ans_data
        })

    return {
        "session_id": session.id,
        "mode": session.mode,
        "time_limit_min": session.time_limit_min,
        "status": session.status,
        "started_at": session.started_at,
        "questions": questions_list
    }
