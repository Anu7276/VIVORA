from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from app.db.database import get_db
from app.db.models import Report, Session, Question
from typing import List, Dict, Any

router = APIRouter()

@router.get("/{session_id}")
async def get_session_report(session_id: str, db: DBSession = Depends(get_db)):
    """Retrieves full analytical performance scorecard for a session."""
    report = db.query(Report).filter(Report.session_id == session_id).first()
    session = db.query(Session).filter(Session.id == session_id).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # If report was not generated yet, calculate from answers
    if not report:
        return {
            "session_id": session_id,
            "status": session.status,
            "message": "Report generation pending or session not completed"
        }

    topic_breakdown = [
        {
            "topic": ts.topic,
            "score": ts.score,
            "level": ts.level
        } for ts in report.topic_scores
    ]

    questions_review = []
    for q in session.questions:
        ans = q.answers[0] if q.answers else None
        ev = ans.evaluation if ans else None
        questions_review.append({
            "order_no": q.order_no,
            "question_text": q.question_text,
            "topic": q.topic,
            "student_transcript": ans.transcript if ans else "(Not answered)",
            "score": ev.overall_score if ev else 0.0,
            "feedback": ev.feedback if ev else "No answer provided",
            "missing_concepts": ev.missing_concepts if ev else "",
            "model_answer": ev.model_answer if ev else q.reference_answer
        })

    return {
        "report_id": report.id,
        "session_id": session_id,
        "mode": session.mode,
        "overall_score": report.overall_score,
        "strengths": [s.strip() for s in (report.strengths or "").split("\n") if s.strip()],
        "improvements": [i.strip() for i in (report.improvements or "").split("\n") if i.strip()],
        "revision_plan": [r.strip() for r in (report.revision_plan or "").split("\n") if r.strip()],
        "communication_feedback": report.communication_feedback,
        "topic_scores": topic_breakdown,
        "questions_review": questions_review,
        "generated_at": report.generated_at
    }
