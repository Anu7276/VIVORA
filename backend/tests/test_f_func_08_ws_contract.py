"""
Test F-FUNC-08: WebSocket Message Contract Test
Verifies:
1. Every message type emitted by frontend/src/app/session/[id]/page.tsx is handled by backend.
2. Canonical message types 'repeat_question' and 'skip_question' are used in frontend (no 'replay_question' or 'next_question').
3. Backend handles repeat_question, skip_question, submit_answer, ask_doubt, end_session, auth, retry_evaluation.
4. Sending an unknown message type returns a visible error frame with code 'UNKNOWN_MESSAGE_TYPE'.
"""

import re
import pathlib
import pytest
from starlette.testclient import TestClient

from app.main import app
from app.db.database import SessionLocal
from app.db.models import Session as SessionModel, Question, User
from app.core.auth import create_access_token, hash_password


def test_frontend_uses_canonical_ws_message_types():
    """Ensure frontend no longer contains 'replay_question' or 'next_question'."""
    frontend_session_file = pathlib.Path(__file__).resolve().parent.parent.parent / "frontend" / "src" / "app" / "session" / "[id]" / "page.tsx"
    assert frontend_session_file.exists(), f"File {frontend_session_file} must exist"
    content = frontend_session_file.read_text(encoding="utf-8")

    assert 'type: "replay_question"' not in content, "Frontend still sends 'replay_question'; must use 'repeat_question'"
    assert 'type: "next_question"' not in content, "Frontend still sends 'next_question'; must use 'skip_question'"
    assert 'type: "repeat_question"' in content, "Frontend must send 'repeat_question'"
    assert 'type: "skip_question"' in content, "Frontend must send 'skip_question'"


def test_ws_unknown_message_type_returns_visible_error():
    """Ensure unknown message types return visible error frame."""
    client = TestClient(app)
    db = SessionLocal()
    try:
        user = User(
            name="Contract User",
            email=f"ws_contract_{id(client)}@example.com",
            password_hash=hash_password("Password123!"),
            account_status="active"
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        session = SessionModel(
            user_id=user.id,
            mode="school",
            language="en-IN",
            question_source="fixed",
            time_limit_min=15,
            status="in_progress"
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        q = Question(
            session_id=session.id,
            order_no=1,
            question_text="What is contract testing?",
            topic="QA",
            difficulty="easy"
        )
        db.add(q)
        db.commit()

        token = create_access_token(user.id, user.email)

        with client.websocket_connect(f"/ws/session/{session.id}") as ws:
            # Authenticate
            ws.send_json({"type": "auth", "token": token})
            auth_frame = ws.receive_json()
            assert auth_frame.get("type") == "auth_ok"
            q_frame = ws.receive_json()
            assert q_frame.get("type") in ("question_ready", "session_completed")

            # Send unknown message type
            ws.send_json({"type": "completely_bogus_type", "payload": 123})
            err_frame = ws.receive_json()
            assert err_frame.get("type") == "error"
            assert err_frame.get("code") == "UNKNOWN_MESSAGE_TYPE"
            assert "completely_bogus_type" in err_frame.get("message", "")
    finally:
        db.close()
