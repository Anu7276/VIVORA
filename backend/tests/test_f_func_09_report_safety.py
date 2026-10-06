"""
Test F-FUNC-09: End Session Navigation and Report Resilience
Verifies:
1. Frontend session/[id]/page.tsx does not immediately execute router.push inside handleEndInterview
   before session_completed arrives.
2. Frontend report/[id]/page.tsx safely handles pending report responses (message: 'pending')
   with optional chaining on questions_review, topic_scores, etc., preventing client crashes.
3. Backend GET /api/report/{id} pending payload structure is handled gracefully.
"""

import pathlib
import pytest
from starlette.testclient import TestClient

from app.main import app
from app.db.database import SessionLocal
from app.db.models import Session as SessionModel, User
from app.core.auth import create_access_token, hash_password


def test_session_page_waits_for_completion():
    """Verify handleEndInterview does not immediately push to /report before session completes."""
    session_file = pathlib.Path(__file__).resolve().parent.parent.parent / "frontend" / "src" / "app" / "session" / "[id]" / "page.tsx"
    assert session_file.exists()
    content = session_file.read_text(encoding="utf-8")

    # It must NOT have handleEndInterview with immediate router.push directly after ws.send
    bad_pattern = 'wsRef.current.send(JSON.stringify({ type: "end_session" }));\n    router.push('
    assert bad_pattern not in content, "handleEndInterview still performs immediate router.push without waiting for session_completed"


def test_report_page_uses_optional_chaining_on_questions_review():
    """Verify report/[id]/page.tsx guards questions_review against undefined."""
    report_file = pathlib.Path(__file__).resolve().parent.parent.parent / "frontend" / "src" / "app" / "report" / "[id]" / "page.tsx"
    assert report_file.exists()
    content = report_file.read_text(encoding="utf-8")

    # Must NOT directly access report.questions_review.length without optional chaining or fallback
    assert "report.questions_review.length" not in content, "report.questions_review.length is unsafe without optional chaining / null check"
    assert "report?.questions_review" in content or "questions_review ||" in content or "questions_review ??" in content, "report page must guard questions_review"


def test_backend_report_pending_payload_contract():
    """Backend returns status message when report is pending."""
    client = TestClient(app)
    db = SessionLocal()
    try:
        user = User(
            name="Pending Report User",
            email=f"pending_{id(client)}@example.com",
            password_hash=hash_password("Pass123!"),
            account_status="active"
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        session = SessionModel(
            user_id=user.id,
            mode="school",
            language="en-IN",
            time_limit_min=15,
            status="in_progress",
            session_token="secret_token_123"
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        token = create_access_token(user.id, user.email)
        resp = client.get(
            f"/api/report/{session.id}?token=secret_token_123",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "message" in data or "questions_review" in data
    finally:
        db.close()
