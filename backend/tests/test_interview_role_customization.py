import pytest
import asyncio
from app.db.database import SessionLocal, Base, engine
from app.db.models import User, Session, Question
from app.services.session_service import session_service
from datetime import datetime, timedelta, timezone

@pytest.fixture(scope="module")
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield

def test_interview_customizes_questions_for_job_role_and_tech_stack(setup_db):
    db = SessionLocal()
    try:
        # Create adult user
        user = User(
            name="Interview Candidate",
            email=f"candidate_{datetime.now(timezone.utc).timestamp()}@example.com",
            role="interview",
            is_minor=False,
            date_of_birth=datetime.now(timezone.utc) - timedelta(days=25 * 365)
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create session with specific Job Role and Tech Stack
        session = asyncio.run(session_service.create_session(
            db=db,
            mode="interview",
            title="Senior Full-Stack Engineer Technical Interview",
            job_role="Full Stack Engineer",
            tech_stack="React, Node.js, TypeScript, PostgreSQL, Docker, AWS",
            experience_level="Senior",
            user_id=user.id
        ))

        assert session is not None
        assert session.mode == "interview"

        questions = db.query(Question).filter(Question.session_id == session.id).order_by(Question.order_no).all()
        assert len(questions) >= 5, f"Expected at least 5 questions, got {len(questions)}"

        # Verify that questions include reference answers, follow-up questions, and reflect the role/tech stack
        all_topics = " ".join([q.topic for q in questions]).lower()

        assert "full stack" in all_topics or "architect" in all_topics or "concurrency" in all_topics
        for q in questions:
            assert q.question_text and len(q.question_text) > 15
            assert q.reference_answer and len(q.reference_answer) > 10
            assert q.followup_question and len(q.followup_question) > 10
            assert q.followup_answer and len(q.followup_answer) > 5

    finally:
        db.close()
