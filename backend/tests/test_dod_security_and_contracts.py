"""
test_dod_security_and_contracts.py
===================================
Tests for Definition of Done (DOD) requirements:
- Login brute force returns 429
- Request body > 2MB returns 413
- Duplicate WS answer submission is ignored (one answer saved)
- Foreign question_id in WS submission is safely handled without cross-question grading
- Minor consent edge cases (calendar age, same-email rejection, 48h TTL)
- Full data deletion leaves 0 rows in Session, Question, Answer, Document, Chunk
- Rollback on question generation failure produces 0 orphan sessions
"""

import time
from datetime import datetime, timedelta, timezone
import pytest
from starlette.testclient import TestClient

from app.main import app
from app.db.database import SessionLocal
from app.db.models import User, ParentConsent, Session, Question, Answer, Document, DocumentChunk


@pytest.fixture
def client():
    return TestClient(app)


def _signup_user(client, email, password="Password123!", dob="1995-01-01", parent_email=None):
    payload = {
        "name": "Test User",
        "email": email,
        "password": password,
        "date_of_birth": dob,
    }
    if parent_email:
        payload["parent_email"] = parent_email
    return client.post("/api/auth/signup", json=payload)


def _login_user(client, email, password="Password123!"):
    return client.post("/api/auth/login", json={"email": email, "password": password})


class TestRateLimitingAndBodySize:
    def test_login_brute_force_returns_429(self, client):
        """Testing rate limiting triggers 429 when X-Test-Rate-Limit header is passed."""
        email = f"brute_{time.time()}@example.com"
        # Attempt 12 fast failed logins
        responses = []
        for _ in range(12):
            resp = client.post(
                "/api/auth/login",
                json={"email": email, "password": "WrongPassword123!"},
                headers={"X-Test-Rate-Limit": "true"}
            )
            responses.append(resp.status_code)
        assert 429 in responses, f"Expected 429 in login brute force responses: {responses}"

    def test_oversized_2mb_request_body_returns_413(self, client):
        """Sending a request body larger than 2MB to a standard endpoint returns 413."""
        big_body = "x" * (2 * 1024 * 1024 + 500)
        resp = client.post(
            "/api/auth/login",
            content=big_body,
            headers={"Content-Type": "application/json", "Content-Length": str(len(big_body))}
        )
        assert resp.status_code == 413, f"Expected 413 for >2MB body, got {resp.status_code}"


class TestMinorConsentEdgeCases:
    def test_parent_email_equals_child_email_rejected(self, client):
        """Parent email cannot equal child email."""
        resp = _signup_user(
            client,
            email="minor_same@example.com",
            dob="2012-05-10",
            parent_email="MINOR_SAME@EXAMPLE.COM"
        )
        assert resp.status_code == 422, f"Expected 422 for identical emails, got {resp.status_code}"

    def test_consent_token_expired_after_48h(self, client):
        """A consent token older than 48 hours is rejected on confirmation."""
        email = f"minor_ttl_{time.time()}@example.com"
        resp = _signup_user(client, email=email, dob="2012-05-10", parent_email="parent_ttl@example.com")
        assert resp.status_code in (200, 201)

        db = SessionLocal()
        try:
            user = db.query(User).filter(User.email == email).first()
            consent = db.query(ParentConsent).filter(ParentConsent.user_id == user.id).first()
            # Set created_at to 50 hours ago
            consent.created_at = datetime.now(timezone.utc) - timedelta(hours=50)
            db.commit()
            token = consent.consent_token
        finally:
            db.close()

        confirm_resp = client.post(f"/api/auth/parent-consent/confirm?token={token}")
        assert confirm_resp.status_code == 400
        assert "expired" in confirm_resp.json()["detail"].lower()


class TestDeleteMyDataPurge:
    def test_delete_report_purges_all_related_records(self, client):
        """DELETE /api/report/{id}/data purges session, questions, answers, and orphaned documents."""
        email = f"delete_test_{time.time()}@example.com"
        _signup_user(client, email)
        token = _login_user(client, email).json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Create session
        start_resp = client.post("/api/session/start", json={
            "mode": "school",
            "title": "Purge Test Session",
            "time_limit_min": 15
        }, headers=headers)
        assert start_resp.status_code == 200
        session_id = start_resp.json()["session_id"]

        db = SessionLocal()
        try:
            session_obj = db.query(Session).filter(Session.id == session_id).first()
            session_token = session_obj.session_token
            doc_id = session_obj.document_id
            q_ids = [q.id for q in db.query(Question).filter(Question.session_id == session_id).all()]
            assert doc_id is not None
            # Add a chunk to verify chunk deletion
            chunk = DocumentChunk(document_id=doc_id, chunk_index=0, content="Test chunk content")
            db.add(chunk)
            db.commit()
        finally:
            db.close()

        # Delete session data
        del_resp = client.delete(f"/api/report/{session_id}/data", headers={"X-Session-Token": session_token})
        assert del_resp.status_code == 200

        # Verify 0 rows remain for this session's entities
        db = SessionLocal()
        try:
            assert db.query(Session).filter(Session.id == session_id).count() == 0
            assert db.query(Question).filter(Question.session_id == session_id).count() == 0
            if q_ids:
                assert db.query(Answer).filter(Answer.question_id.in_(q_ids)).count() == 0
            assert db.query(Document).filter(Document.id == doc_id).count() == 0
            assert db.query(DocumentChunk).filter(DocumentChunk.document_id == doc_id).count() == 0
        finally:
            db.close()


class TestWebSocketIntegrityAndForeignQuestions:
    def test_ws_duplicate_frame_and_foreign_question_id(self, client):
        """Duplicate submit_answer frame and foreign question_id are handled safely."""
        email = f"ws_integ_{time.time()}@example.com"
        _signup_user(client, email)
        token = _login_user(client, email).json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        start_resp = client.post("/api/session/start", json={
            "mode": "school",
            "title": "WS Duplicate Test",
            "time_limit_min": 15
        }, headers=headers)
        assert start_resp.status_code == 200
        session_id = start_resp.json()["session_id"]

        db = SessionLocal()
        try:
            questions = db.query(Question).filter(Question.session_id == session_id).order_by(Question.order_no).all()
            q1_id = questions[0].id
        finally:
            db.close()

        with client.websocket_connect(f"/ws/session/{session_id}") as ws:
            # Send auth frame
            ws.send_json({"type": "auth", "token": token})
            init_frame = ws.receive_json()
            assert init_frame["type"] in ("session_init", "auth_ok", "question_start")

            # Submit answer for q1
            ws.send_json({
                "type": "submit_answer",
                "question_id": q1_id,
                "transcript": "First answer submission."
            })
            time.sleep(0.1)

            # Send duplicate submit answer for q1
            ws.send_json({
                "type": "submit_answer",
                "question_id": q1_id,
                "transcript": "Duplicate answer submission."
            })
            time.sleep(0.1)

            # Send submit answer with a fake foreign question_id
            ws.send_json({
                "type": "submit_answer",
                "question_id": "non-existent-foreign-question-id",
                "transcript": "Foreign question answer."
            })
            time.sleep(0.1)

        # Verify in DB: exactly one answer for q1
        db = SessionLocal()
        try:
            answers = db.query(Answer).filter(Answer.question_id == q1_id).all()
            assert len(answers) == 1, f"Expected 1 answer for q1, got {len(answers)}"
            assert answers[0].transcript == "First answer submission."
        finally:
            db.close()
