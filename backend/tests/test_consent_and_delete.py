"""
test_consent_and_delete.py
==========================
Tests for:
  1. Minor consent gate — school-mode POST /session/start returns 423
     unless is_minor=False is explicitly passed.
  2. Non-school modes (college, interview) are not blocked.
  3. DELETE /report/{session_id}/data removes all session data.
  4. Communication_feedback is absent from report response when 0/empty.
  5. Whisper STT raises NotImplementedError immediately on init.
  6. Deepgram STT logs a warning when API key is missing and falls back to browser.
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch

from app.main import app
from app.db.database import SessionLocal, Base, engine
from app.db.models import Session as SessionModel, Report, LLMUsageLog


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


def _minimal_school_body(**kwargs):
    return {
        "mode": "school",
        "title": "Test Viva",
        "content_text": "Q: What is osmosis? A: Movement of water across a semi-permeable membrane.",
        **kwargs,
    }


# ─── 1. Consent gate — school mode ────────────────────────────────────────────

class TestConsentGate:
    def test_school_mode_without_is_minor_returns_423(self, client):
        """No is_minor field → safe default is to block (treat as minor)."""
        resp = client.post("/api/session/start", json=_minimal_school_body())
        assert resp.status_code == 423, (
            f"Expected 423 for school mode without is_minor; got {resp.status_code}: {resp.text}"
        )
        detail = resp.json()["detail"]
        assert "parental consent" in detail.lower() or "minor" in detail.lower()

    def test_school_mode_is_minor_true_returns_423(self, client):
        """is_minor=true → blocked."""
        resp = client.post(
            "/api/session/start",
            json=_minimal_school_body(is_minor=True)
        )
        assert resp.status_code == 423

    def test_school_mode_is_minor_false_bypasses_gate(self, client):
        """is_minor=False → dev bypass; session created."""
        resp = client.post(
            "/api/session/start",
            json=_minimal_school_body(is_minor=False)
        )
        assert resp.status_code == 200, (
            f"Expected 200 for school mode with is_minor=False; got {resp.status_code}: {resp.text}"
        )
        assert "session_id" in resp.json()

    def test_college_mode_not_blocked(self, client):
        """College mode has no minor gate."""
        resp = client.post("/api/session/start", json={
            "mode": "college",
            "title": "College Viva",
            "content_text": "Q: Explain osmosis. A: Water moves from low to high solute concentration.",
        })
        assert resp.status_code == 200

    def test_interview_mode_not_blocked(self, client):
        """Interview mode has no minor gate."""
        resp = client.post("/api/session/start", json={
            "mode": "interview",
            "title": "Interview Prep",
            "content_text": "Q: Describe your experience. A: I have 3 years of Python experience.",
        })
        assert resp.status_code == 200


# ─── 2. Delete-my-data endpoint ───────────────────────────────────────────────

class TestDeleteSessionData:
    def _create_session_bypassed(self, client) -> str:
        """Create a school session via dev bypass; return session_id."""
        resp = client.post(
            "/api/session/start",
            json=_minimal_school_body(is_minor=False)
        )
        assert resp.status_code == 200
        return resp.json()["session_id"]

    def test_delete_existing_session_returns_200(self, client):
        session_id = self._create_session_bypassed(client)
        resp = client.delete(f"/api/report/{session_id}/data")
        assert resp.status_code == 200
        data = resp.json()
        assert data["deleted"] is True
        assert data["session_id"] == session_id

    def test_delete_nonexistent_session_returns_404(self, client):
        resp = client.delete("/api/report/nonexistent-session-id/data")
        assert resp.status_code == 404

    def test_session_actually_gone_after_delete(self, client):
        session_id = self._create_session_bypassed(client)
        client.delete(f"/api/report/{session_id}/data")
        # GET the report should now return 404
        resp = client.get(f"/api/report/{session_id}")
        assert resp.status_code == 404


# ─── 3. Communication feedback hidden when 0 / empty ──────────────────────────

class TestCommFeedbackHiding:
    def _get_report_payload(self, session_id: str, comm_value, client) -> dict:
        """
        Inject a Report row directly and hit the report endpoint.
        """
        db = SessionLocal()
        try:
            session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
            if not session:
                return {}
            report = Report(
                session_id=session_id,
                overall_score=7.5,
                strengths="Good effort",
                improvements="More detail",
                revision_plan="Revise chapter 3",
                communication_feedback=comm_value,
            )
            db.add(report)
            db.commit()
        finally:
            db.close()

        resp = client.get(f"/api/report/{session_id}")
        assert resp.status_code == 200
        return resp.json()

    def test_empty_comm_feedback_is_omitted(self, client):
        resp = client.post(
            "/api/session/start",
            json=_minimal_school_body(is_minor=False)
        )
        sid = resp.json()["session_id"]
        payload = self._get_report_payload(sid, "", client)
        assert "communication_feedback" not in payload, (
            "Empty communication_feedback should be omitted from report response"
        )

    def test_none_comm_feedback_is_omitted(self, client):
        resp = client.post(
            "/api/session/start",
            json=_minimal_school_body(is_minor=False)
        )
        sid = resp.json()["session_id"]
        payload = self._get_report_payload(sid, None, client)
        assert "communication_feedback" not in payload

    def test_real_comm_feedback_is_included(self, client):
        resp = client.post(
            "/api/session/start",
            json={"mode": "interview", "title": "Interview", "content_text": "Q: Tell me about yourself."}
        )
        sid = resp.json()["session_id"]
        feedback_text = "Good pace, minimal filler words. Work on confidence."
        payload = self._get_report_payload(sid, feedback_text, client)
        assert "communication_feedback" in payload
        assert payload["communication_feedback"] == feedback_text


# ─── 4. STT provider status ───────────────────────────────────────────────────

class TestSTTProviderStatus:
    def test_whisper_raises_not_implemented(self):
        from app.voice.stt_stream import STTRouter
        with pytest.raises(NotImplementedError, match="whisper"):
            STTRouter(provider_type="whisper")

    def test_deepgram_without_key_falls_back_to_browser(self):
        from app.voice.stt_stream import STTRouter, BrowserSTTProvider
        router = STTRouter(provider_type="deepgram", api_key=None)
        assert isinstance(router.provider, BrowserSTTProvider), (
            "Deepgram without API key should fall back to BrowserSTTProvider"
        )

    def test_browser_is_default(self):
        from app.voice.stt_stream import STTRouter, BrowserSTTProvider
        router = STTRouter()
        assert isinstance(router.provider, BrowserSTTProvider)

    def test_deepgram_with_key_uses_deepgram(self):
        from app.voice.stt_stream import STTRouter, DeepgramSTTProvider
        router = STTRouter(provider_type="deepgram", api_key="test-key")
        assert isinstance(router.provider, DeepgramSTTProvider)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
