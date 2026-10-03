import hmac
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Query
from sqlalchemy.orm import Session as DBSession
from app.core.auth import secure_compare
from app.db.database import get_db
from app.db.models import Report, Session, Question, Answer, Evaluation, LLMUsageLog, User, Document, DocumentChunk
from app.rag.vector_store import vector_store
from app.rag.retriever import rag_retriever

router = APIRouter()


def _verify_session_token(session: Session, token: Optional[str]):
    """
    Enforces per-session secret token validation.
    Both GET report and DELETE data endpoints require the random 32+ byte token
    issued when the session was created.

    Security rules:
      - If session.session_token is None/empty, access is DENIED (no bypass).
      - Token comparison uses hmac.compare_digest (constant-time) to prevent timing attacks.
    """
    if not token or not token.strip():
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Missing session token. The per-session secret token is required.",
        )

    if not session.session_token:
        raise HTTPException(
            status_code=403,
            detail="Forbidden: This session has no token on record.",
        )

    if not secure_compare(token.strip(), session.session_token):
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Invalid session token.",
        )


@router.get("/{session_id}")
async def get_session_report(
    session_id: str,
    token: Optional[str] = Query(None, description="Per-session secret token"),
    x_session_token: Optional[str] = Header(None, alias="X-Session-Token"),
    db: DBSession = Depends(get_db)
):
    """Retrieves full analytical performance scorecard for a session."""
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Verify per-session secret token (prefer X-Session-Token header)
    auth_token = x_session_token or token
    _verify_session_token(session, auth_token)

    report = db.query(Report).filter(Report.session_id == session_id).first()

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
            "reference_answer": q.reference_answer or "",
            "model_answer": ev.model_answer if (ev and ev.model_answer) else (q.reference_answer or ""),
            "concept_match": "Full Match" if (ev and ev.overall_score is not None and ev.overall_score >= 8.0) else "Partial Match" if (ev and ev.overall_score is not None and ev.overall_score >= 5.0) else "Needs Review",
            "provider": ev.provider if ev else "mock"
        })

    comm_feedback = report.communication_feedback
    include_comm = bool(comm_feedback and comm_feedback.strip())

    payload: Dict[str, Any] = {
        "report_id": report.id,
        "session_id": session_id,
        "mode": session.mode,
        "overall_score": report.overall_score,
        "strengths": [s.strip() for s in (report.strengths or "").split("\n") if s.strip()],
        "improvements": [i.strip() for i in (report.improvements or "").split("\n") if i.strip()],
        "revision_plan": [r.strip() for r in (report.revision_plan or "").split("\n") if r.strip()],
        "topic_scores": topic_breakdown,
        "questions_review": questions_review,
        "scoring_note": report.scoring_note,
        "generated_at": report.generated_at,
    }
    if include_comm:
        payload["communication_feedback"] = comm_feedback

    return payload


# ── Delete-my-data endpoint (Requirement C5) ───────────────────────────────────

@router.delete("/{session_id}/data")
async def delete_session_data(
    session_id: str,
    token: Optional[str] = Query(None, description="Per-session secret token"),
    x_session_token: Optional[str] = Header(None, alias="X-Session-Token"),
    db: DBSession = Depends(get_db)
):
    """
    Permanently deletes all data for a session (GDPR / data-subject right).
    Requires the per-session secret token.

    Deletes:
      - Transcripts & answers
      - Evaluations
      - Reports & topic scores
      - LLM usage logs for this session
      - In-memory vector-store chunks for this session / document
      - Document & DocumentChunk rows if no other session uses that document
      - Session and Question records
    """
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Verify per-session secret token (prefer X-Session-Token header)
    auth_token = x_session_token or token
    _verify_session_token(session, auth_token)

    doc_id = session.document_id

    # 1. Clear in-memory vector-store chunks & retriever cache for this document
    if doc_id:
        vector_store.clear_tenant(doc_id)
        rag_retriever.invalidate_cache(doc_id)
    vector_store.clear_tenant(session_id)
    rag_retriever.invalidate_cache(session_id)

    # 2. Delete LLM usage logs referencing this session
    db.query(LLMUsageLog).filter(LLMUsageLog.session_id == session_id).delete()

    # 3. Check if other sessions share this document
    other_sessions_using_doc = (
        db.query(Session).filter(Session.document_id == doc_id, Session.id != session_id).first()
        if doc_id else None
    )

    # 4. Delete the session (cascade handles Questions, Answers, Evaluations, Report, TopicScores)
    db.delete(session)

    # 5. If no other session uses this document, delete Document & DocumentChunk rows
    if doc_id and not other_sessions_using_doc:
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if doc:
            db.delete(doc)

    db.commit()

    return {
        "deleted": True,
        "session_id": session_id,
        "message": (
            "All session data deleted: transcripts, evaluations, report, "
            "topic scores, LLM usage logs, vector-store chunks, and associated document artifacts."
        ),
    }
