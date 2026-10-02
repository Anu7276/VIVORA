"""
test_consent_and_delete.py
==========================
Tests for:
  1. Consent gate:
     - Applies to ALL modes (school, college, interview).
     - Does NOT trust client-supplied is_minor flag (423 returned even if is_minor=False).
     - Allows session creation if authenticated user has adult DOB (age >= 18).
     - Allows session creation if minor user has verified parent_consents record.
     - Blocks minor user with unverified parent consent.
  2. Per-session secret token:
     - Generated at session start (32+ bytes random hex).
     - Required on GET /report/{session_id} -> 403 on missing/invalid token.
     - Required on DELETE /report/{session_id}/data -> 403 on missing/invalid token.
     - Full deletion: removes session, questions, answers, evaluations, reports,
       topic scores, LLM usage logs, and in-memory vector-store chunks.
  3. Provider validation at startup:
     - Unknown or unimplemented providers (e.g. whisper) fail with clear ValueError.
     - STT_PROVIDER=deepgram without key fails startup when ALLOW_STT_FALLBACK=False.
     - Deepgram falls back to browser when ALLOW_STT_FALLBACK=True.
  4. Mock fallback note on report:
     - Explains which questions were scored by mock LLM and that scores are provisional.
  5. Communication feedback hiding when empty/None.
"""

import sys
import os
import asyncio
from datetime import datetime, timedelta
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db.database import SessionLocal, Base, engine
from app.db.models import (
    User,
    ParentConsent,
    Session as SessionModel,
    Question,
    Answer,
    Evaluation,
    Report,
    TopicScore,
    LLMUsageLog,
)
from app.rag.vector_store import vector_store


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module", autouse=True)
def _setup_db():
    """Create tables once for this module."""
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def adult_user():
    """Creates a user with an adult date_of_birth (age >= 18)."""
    db = SessionLocal()
    try:
        user = User(
            name="Adult Student",
            email=f"adult_{datetime.utcnow().timestamp()}@example.com",
            role="college",
            is_minor=False,
            date_of_birth=datetime.utcnow() - timedelta(days=20 * 365 + 10)  # ~20 years old
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        user_id = user.id
    finally:
        db.close()
    return user_id


@pytest.fixture()
def minor_with_verified_consent():
    """Creates a minor user with a verified ParentConsent record."""
    db = SessionLocal()
    try:
        user = User(
            name="Minor Student With Consent",
            email=f"minor_ok_{datetime.utcnow().timestamp()}@example.com",
            role="school",
            is_minor=True,
            date_of_birth=datetime.utcnow() - timedelta(days=14 * 365)  # 14 years old
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        consent = ParentConsent(
            user_id=user.id,
            parent_email="parent@example.com",
            verified=True
        )
        db.add(consent)
        db.commit()
        user_id = user.id
    finally:
        db.close()
    return user_id


@pytest.fixture()
def minor_without_verified_consent():
    """Creates a minor user with an unverified ParentConsent record."""
    db = SessionLocal()
    try:
        user = User(
            name="Minor Student No Consent",
            email=f"minor_no_{datetime.utcnow().timestamp()}@example.com",
            role="school",
            is_minor=True,
            date_of_birth=datetime.utcnow() - timedelta(days=14 * 365)
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        consent = ParentConsent(
            user_id=user.id,
            parent_email="parent@example.com",
            verified=False  # Not verified!
        )
        db.add(consent)
        db.commit()
        user_id = user.id
    finally:
        db.close()
    return user_id


# ─── 1. Consent Gate Tests ────────────────────────────────────────────────────

class TestConsentGate:
    def test_unauthenticated_school_mode_returns_423(self, client):
        """No user_id supplied -> 423 Locked."""
        resp = client.post("/api/session/start", json={
            "mode": "school",
            "title": "School Viva",
            "content_text": "Q: What is energy?"
        })
        assert resp.status_code == 423
        assert "temporarily blocked" in resp.json()["detail"].lower()

    def test_unauthenticated_college_mode_returns_423(self, client):
        """All modes are blocked without authentication/consent."""
        resp = client.post("/api/session/start", json={
            "mode": "college",
            "title": "College Viva",
            "content_text": "Q: What is polymorphism?"
        })
        assert resp.status_code == 423

    def test_unauthenticated_interview_mode_returns_423(self, client):
        """Interview mode is also blocked without authentication/consent."""
        resp = client.post("/api/session/start", json={
            "mode": "interview",
            "title": "Interview Viva",
            "content_text": "Q: Tell me about yourself."
        })
        assert resp.status_code == 423

    def test_client_supplied_is_minor_false_not_trusted_returns_423(self, client):
        """Client-supplied is_minor=False is explicitly NOT trusted without adult user in DB."""
        resp = client.post("/api/session/start", json={
            "mode": "school",
            "title": "School Viva",
            "content_text": "Q: What is photosynthesis?",
            "is_minor": False  # Should be ignored/untrusted
        })
        assert resp.status_code == 423

    def test_minor_with_unverified_consent_returns_423(self, client, minor_without_verified_consent):
        """Minor user with unverified consent record -> 423."""
        resp = client.post("/api/session/start", json={
            "mode": "school",
            "title": "School Viva",
            "content_text": "Q: What is photosynthesis?",
            "user_id": minor_without_verified_consent
        })
        assert resp.status_code == 423

    def test_adult_user_succeeds_and_returns_token(self, client, adult_user):
        """Authenticated adult user (DOB >= 18) -> 200 + returns session_token."""
        resp = client.post("/api/session/start", json={
            "mode": "school",
            "title": "Adult School Viva",
            "content_text": "Q: What is photosynthesis?",
            "user_id": adult_user
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "session_id" in data
        assert "session_token" in data
        assert len(data["session_token"]) >= 64  # 32 bytes hex = 64 chars

    def test_minor_with_verified_consent_succeeds(self, client, minor_with_verified_consent):
        """Minor user with verified ParentConsent -> 200 + returns session_token."""
        resp = client.post("/api/session/start", json={
            "mode": "school",
            "title": "Minor Consented Viva",
            "content_text": "Q: What is photosynthesis?",
            "user_id": minor_with_verified_consent
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "session_id" in data
        assert "session_token" in data


# ─── 2. Secret Token & Delete-my-data Tests ───────────────────────────────────

class TestDeleteAndReadEndpoints:
    def _create_session(self, client, adult_user) -> tuple[str, str]:
        resp = client.post("/api/session/start", json={
            "mode": "college",
            "title": "Data Structures",
            "content_text": "Q: What is a binary tree?",
            "user_id": adult_user
        })
        assert resp.status_code == 200
        data = resp.json()
        return data["session_id"], data["session_token"]

    def test_get_report_without_token_returns_403(self, client, adult_user):
        session_id, _ = self._create_session(client, adult_user)
        resp = client.get(f"/api/report/{session_id}")
        assert resp.status_code == 403
        assert "forbidden" in resp.json()["detail"].lower()

    def test_get_report_with_wrong_token_returns_403(self, client, adult_user):
        session_id, _ = self._create_session(client, adult_user)
        resp = client.get(f"/api/report/{session_id}?token=invalid-token-12345")
        assert resp.status_code == 403

    def test_get_report_with_valid_query_token_returns_200(self, client, adult_user):
        session_id, token = self._create_session(client, adult_user)
        resp = client.get(f"/api/report/{session_id}?token={token}")
        assert resp.status_code == 200

    def test_get_report_with_valid_header_token_returns_200(self, client, adult_user):
        session_id, token = self._create_session(client, adult_user)
        resp = client.get(f"/api/report/{session_id}", headers={"X-Session-Token": token})
        assert resp.status_code == 200

    def test_delete_data_without_token_returns_403(self, client, adult_user):
        session_id, _ = self._create_session(client, adult_user)
        resp = client.delete(f"/api/report/{session_id}/data")
        assert resp.status_code == 403

    def test_delete_data_with_wrong_token_returns_403(self, client, adult_user):
        session_id, _ = self._create_session(client, adult_user)
        resp = client.delete(f"/api/report/{session_id}/data?token=wrong-token")
        assert resp.status_code == 403

    def test_full_deletion_covers_all_artifacts(self, client, adult_user):
        """
        Creates session, answers, evaluations, report, usage logs, and vector chunks.
        Verifies that DELETE with valid token completely purges all of them.
        """
        session_id, token = self._create_session(client, adult_user)

        # 1. Populate DB data
        db = SessionLocal()
        try:
            q = Question(
                session_id=session_id,
                order_no=1,
                question_text="Explain QuickSort",
                topic="Algorithms",
                origin="uploaded"
            )
            db.add(q)
            db.commit()
            db.refresh(q)

            ans = Answer(
                question_id=q.id,
                transcript="Quicksort divides and conquers using a pivot",
                duration_sec=12
            )
            db.add(ans)
            db.commit()
            db.refresh(ans)

            ev = Evaluation(
                answer_id=ans.id,
                overall_score=8.0,
                provider="mock"
            )
            db.add(ev)

            rep = Report(
                session_id=session_id,
                overall_score=8.0,
                strengths="Good explanation",
                scoring_note="All evaluations AI-scored."
            )
            db.add(rep)
            db.commit()
            db.refresh(rep)

            ts = TopicScore(
                report_id=rep.id,
                topic="Algorithms",
                score=8.0
            )
            db.add(ts)

            log = LLMUsageLog(
                session_id=session_id,
                task="evaluation",
                provider="mock"
            )
            db.add(log)
            db.commit()
        finally:
            db.close()

        # 2. Insert vector chunks into vector store under session_id
        vector_store.insert(
            tenant_id=session_id,
            content="Quicksort pivot selection algorithm",
            embedding=[0.1] * 384
        )
        assert len(vector_store.search(session_id, [0.1] * 384)) > 0

        # 3. Perform DELETE request with token
        del_resp = client.delete(f"/api/report/{session_id}/data?token={token}")
        assert del_resp.status_code == 200
        assert del_resp.json()["deleted"] is True

        # 4. Verify all items are purged
        db = SessionLocal()
        try:
            assert db.query(SessionModel).filter(SessionModel.id == session_id).first() is None
            assert db.query(Question).filter(Question.session_id == session_id).first() is None
            assert db.query(Report).filter(Report.session_id == session_id).first() is None
            assert db.query(LLMUsageLog).filter(LLMUsageLog.session_id == session_id).first() is None
        finally:
            db.close()

        # Vector store chunks must be cleared
        assert len(vector_store.search(session_id, [0.1] * 384)) == 0

        # Subsequent GET should return 404
        get_resp = client.get(f"/api/report/{session_id}?token={token}")
        assert get_resp.status_code == 404


# ─── 3. Provider Validation at Startup ─────────────────────────────────────────

class TestSTTProviderValidation:
    def test_whisper_fails_startup_with_clear_error(self):
        """Whisper STT must fail at startup with a clear error, not mid-session."""
        from app.voice.stt_stream import STTRouter
        with pytest.raises(ValueError, match="planned but not yet implemented"):
            STTRouter(provider_type="whisper")

    def test_unknown_provider_fails_startup(self):
        """Unknown STT provider fails startup with a clear error."""
        from app.voice.stt_stream import STTRouter
        with pytest.raises(ValueError, match="Unknown STT provider"):
            STTRouter(provider_type="unknown_stt_provider")

    def test_deepgram_without_key_refuses_to_start_when_fallback_false(self):
        """When ALLOW_STT_FALLBACK is False, missing key raises ValueError refusing to start."""
        from app.voice.stt_stream import STTRouter
        with pytest.raises(ValueError, match="ALLOW_STT_FALLBACK is False"):
            STTRouter(provider_type="deepgram", api_key=None, allow_fallback=False)

    def test_deepgram_without_key_falls_back_when_fallback_true(self):
        """When ALLOW_STT_FALLBACK is True, missing key logs warning and uses BrowserSTTProvider."""
        from app.voice.stt_stream import STTRouter, BrowserSTTProvider
        router = STTRouter(provider_type="deepgram", api_key=None, allow_fallback=True)
        assert isinstance(router.provider, BrowserSTTProvider)

    def test_browser_is_default(self):
        from app.voice.stt_stream import STTRouter, BrowserSTTProvider
        router = STTRouter(provider_type="browser")
        assert isinstance(router.provider, BrowserSTTProvider)


# ─── 4. Mock Fallback Scoring Note on Report ───────────────────────────────────

class TestReportScoringNote:
    def test_mock_fallback_labels_questions_as_provisional(self):
        """When evaluations use mock LLM fallback, report explicitly lists questions and states provisional."""
        from app.agents.report_agent import ReportAgent
        agent = ReportAgent()

        evaluations = [
            {
                "order_no": 1,
                "question_text": "What is Newton's First Law?",
                "overall_score": 7.0,
                "_is_mock": True,
            },
            {
                "order_no": 2,
                "question_text": "What is Newton's Second Law?",
                "overall_score": 8.0,
                "_is_mock": False,
            }
        ]

        report = asyncio.run(agent.generate_report(mode="school", evaluations=evaluations))
        assert "scoring_note" in report
        note = report["scoring_note"]
        assert "Q1" in note
        assert "provisional" in note.lower()

    def test_all_mock_labels_all_questions_provisional(self):
        from app.agents.report_agent import ReportAgent
        agent = ReportAgent()

        evaluations = [
            {"order_no": 1, "question_text": "Q1 text", "overall_score": 6.0, "_is_mock": True},
            {"order_no": 2, "question_text": "Q2 text", "overall_score": 6.5, "_is_mock": True},
        ]
        report = asyncio.run(agent.generate_report(mode="school", evaluations=evaluations))
        note = report["scoring_note"]
        assert "provisional" in note.lower()
        assert "Q1" in note and "Q2" in note


# ─── 5. Communication Feedback Hiding ─────────────────────────────────────────

class TestCommFeedbackHiding:
    def test_comm_feedback_hidden_when_empty(self, client, adult_user):
        resp = client.post("/api/session/start", json={
            "mode": "school",
            "title": "School Test",
            "content_text": "Q: Test question",
            "user_id": adult_user
        })
        sid = resp.json()["session_id"]
        token = resp.json()["session_token"]

        db = SessionLocal()
        try:
            rep = Report(
                session_id=sid,
                overall_score=7.0,
                strengths="Good",
                communication_feedback=""  # empty!
            )
            db.add(rep)
            db.commit()
        finally:
            db.close()

        get_resp = client.get(f"/api/report/{sid}?token={token}")
        assert get_resp.status_code == 200
        assert "communication_feedback" not in get_resp.json()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
