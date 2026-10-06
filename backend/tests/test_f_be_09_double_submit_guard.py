import pytest
from starlette.testclient import TestClient
from app.main import app
from app.api.ws.interview_ws import _submitting_sessions
from tests.test_phase2_session_ws import _create_authenticated_user_and_session

@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c

def test_double_submit_guard_prevents_concurrent_evaluations(client):
    _, token, session_id = _create_authenticated_user_and_session(client)
    with client.websocket_connect(f"/ws/session/{session_id}") as ws:
        ws.send_json({"type": "auth", "token": token})
        msg = ws.receive_json()
        if msg.get("type") == "auth_ok":
            msg = ws.receive_json()
        assert msg["type"] == "question_ready"

        # Manually simulate in-flight evaluation by adding session_id to _submitting_sessions
        _submitting_sessions.add(session_id)
        try:
            # Send submit_answer while submission is supposedly in flight
            ws.send_json({"type": "submit_answer", "transcript": "My quick answer"})
            resp = ws.receive_json()
            assert resp["type"] == "info"
            assert "progress" in resp["message"].lower() or "wait" in resp["message"].lower()
        finally:
            _submitting_sessions.discard(session_id)
