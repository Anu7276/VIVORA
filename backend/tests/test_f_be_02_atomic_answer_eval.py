import pytest
from unittest.mock import patch
from app.db.database import SessionLocal
from app.db.models import Session as SessionModel, Question, Answer, Evaluation
from app.services.session_service import SessionService

def test_atomic_rollback_on_evaluation_failure():
    db = SessionLocal()
    try:
        # Create dummy session & question
        sess = SessionModel(mode="school", status="live")
        db.add(sess)
        db.flush()

        q = Question(session_id=sess.id, question_text="Test question?")
        db.add(q)
        db.commit()
        db.refresh(q)

        # Count answers before
        initial_answers = db.query(Answer).filter(Answer.question_id == q.id).count()

        # Mock Evaluation constructor or insertion to fail
        with patch("app.services.session_service.Evaluation", side_effect=ValueError("Simulated evaluation crash")):
            with pytest.raises(ValueError, match="Simulated evaluation crash"):
                SessionService.record_answer_and_eval(
                    db=db,
                    question_id=q.id,
                    transcript="My answer transcript",
                    duration_sec=10,
                    filler_count=0,
                    evaluation_data={"overall_score": 8.0}
                )

        # Verify no orphan answer was committed
        final_answers = db.query(Answer).filter(Answer.question_id == q.id).count()
        assert final_answers == initial_answers, "Orphan Answer record was committed despite evaluation failure!"
    finally:
        db.rollback()
        db.close()

def test_unscored_answer_tolerated_in_session_evaluations():
    db = SessionLocal()
    try:
        sess = SessionModel(mode="school", status="live")
        db.add(sess)
        db.flush()

        q = Question(session_id=sess.id, question_text="What is mitosis?")
        db.add(q)
        db.flush()

        # Insert answer directly without evaluation
        ans = Answer(question_id=q.id, transcript="Cell division", duration_sec=5)
        db.add(ans)
        db.commit()

        evals = SessionService.get_session_evaluations(db, sess.id)
        assert len(evals) == 1
        assert evals[0]["scored"] is False
        assert evals[0]["overall_score"] == 0.0
    finally:
        db.rollback()
        db.close()
