import pytest
import asyncio
from app.db.database import SessionLocal, Base, engine
from app.services.session_service import session_service
from app.db.models import User
from datetime import datetime, timedelta

def test_college_viva_generates_top_10_questions_with_followups():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Create an adult student user
        user = db.query(User).filter(User.email == "college_tester@example.com").first()
        if not user:
            user = User(
                name="Vikram Patel",
                email="college_tester@example.com",
                role="college",
                is_minor=False,
                date_of_birth=datetime.utcnow() - timedelta(days=21 * 365)
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        session = asyncio.run(session_service.create_session(
            db=db,
            mode="college",
            title="Operating Systems: Process Synchronization & Deadlocks",
            content_text="Topics: Critical section problem, Peterson's algorithm, Semaphores, Mutex, Deadlock conditions (Mutual Exclusion, Hold and Wait, No Preemption, Circular Wait), Banker's Algorithm.",
            question_source="generated",
            user_id=user.id
        ))

        assert session is not None
        assert session.mode == "college"
        assert len(session.questions) == 10, f"Expected 10 questions generated for College Viva, got {len(session.questions)}"

        # Verify each question has text, topic, reference answer, and follow-up question
        for idx, q in enumerate(session.questions):
            assert q.question_text and len(q.question_text) > 5, f"Q{idx+1} question_text missing"
            assert q.reference_answer and len(q.reference_answer) > 5, f"Q{idx+1} reference_answer missing"
            assert q.followup_question and len(q.followup_question) > 5, f"Q{idx+1} followup_question missing"
            assert q.followup_answer and len(q.followup_answer) > 5, f"Q{idx+1} followup_answer missing"

    finally:
        db.close()
