import pytest
from starlette.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from app.db.models import Session as SessionModel, Question, Answer, Evaluation, User
from app.core.auth import create_access_token
from app.services.session_service import session_service

@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c

def test_eager_loading_prevents_detached_instance_error():
    """F-BE-03: Eager loading loads relations so accessing them doesn't fail when detached."""
    db = SessionLocal()
    try:
        sess = SessionModel(mode="school", status="live")
        db.add(sess)
        db.flush()

        q = Question(session_id=sess.id, question_text="What is ATP?")
        db.add(q)
        db.flush()

        ans = Answer(question_id=q.id, transcript="Energy currency")
        db.add(ans)
        db.flush()

        ev = Evaluation(answer_id=ans.id, overall_score=9.0)
        db.add(ev)
        db.commit()

        # Load with eager=True
        loaded_sess = session_service.get_session(db, sess.id, eager=True)
        assert loaded_sess is not None

        # Expunge to detach from DB session
        db.expunge_all()

        # Access relations - will raise DetachedInstanceError if not eagerly loaded
        assert len(loaded_sess.questions) == 1
        assert len(loaded_sess.questions[0].answers) == 1
        assert loaded_sess.questions[0].answers[0].evaluation.overall_score == 9.0
    finally:
        db.rollback()
        db.close()

def test_report_access_with_user_jwt_without_session_token(client):
    """F-FUNC-03: Allow report access with owner JWT without requiring session_token."""
    import uuid
    db = SessionLocal()
    try:
        user = User(email=f"report_owner_{uuid.uuid4().hex[:8]}@example.com", name="Report Owner")
        db.add(user)
        db.flush()

        sess = SessionModel(user_id=user.id, mode="school", status="completed", session_token="secret_token_123")
        db.add(sess)
        db.commit()

        jwt_token = create_access_token(user.id, user.email)

        # Access report using Bearer token only (no X-Session-Token or token query param)
        resp = client.get(
            f"/api/report/{sess.id}",
            headers={"Authorization": f"Bearer {jwt_token}"}
        )
        assert resp.status_code == 200, f"Expected 200 with user JWT, got {resp.status_code}: {resp.text}"
    finally:
        db.rollback()
        db.close()
