from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from pydantic import BaseModel
from typing import Optional, List
from app.db.database import get_db
from app.db.models import Session, Question, Answer, Evaluation
from app.services.session_service import session_service

router = APIRouter()

class CreateSessionRequest(BaseModel):
    mode: str = "school"  # school | college | interview
    title: str = "Science Viva Practice"
    content_text: str = ""
    question_source: Optional[str] = None
    time_limit_min: Optional[int] = None

@router.post("/start")
async def start_new_session(req: CreateSessionRequest, db: DBSession = Depends(get_db)):
    """Initializes a new viva session and prepares questions."""
    session = session_service.create_session(
        db=db,
        mode=req.mode,
        title=req.title,
        content_text=req.content_text,
        question_source=req.question_source,
        time_limit_min=req.time_limit_min
    )
    return {
        "session_id": session.id,
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
