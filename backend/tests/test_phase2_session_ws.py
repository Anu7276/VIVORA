"""
Phase 2 Session State Machine and WebSocket Hardening Tests
===========================================================
Reproduces bugs targeted in Phase 2:
1. WebSocket requires authentication with `{type: "auth", "token": "..."}` within 5 seconds; closes otherwise.
2. Follow-up state machine: main question gets at most one follow-up; answer to follow-up evaluates against the follow-up; cursor advances; no infinite loop.
3. Mid-session reconnect: evaluations/answers from previous connections are loaded from DB; final report includes ALL answers across connections.
4. Idempotent completion: reconnecting after completion returns the existing report without creating a duplicate Report row.
5. Malformed frames (invalid JSON, unknown type, or invalid payloads like transcript=null): return error frame without killing the socket connection loop.
6. Server-authoritative timer: remaining time is derived from Session.started_at; reconnecting does not reset the timer; time_used_sec is updated.
7. Server-side duration and filler word calculation: client duration_sec and filler_count are ignored and computed honestly on the server.
8. Empty or whitespace transcript is recorded as 'no answer' and scored 0.0.
"""

import time
import pytest
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.main import app
from app.db.database import SessionLocal
from app.db.models import Session as SessionModel, Question, Answer, Evaluation, Report
from app.core.auth import create_access_token


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


def _create_authenticated_user_and_session(client, mode="school", time_limit_min=15, questions_data=None):
    db = SessionLocal()
    try:
        ts = int(time.time() * 1000)
        email = f"ws_user_{ts}@example.com"
        signup_resp = client.post("/api/auth/signup", json={
            "name": "WS Test User",
            "email": email,
            "password": "Password123!",
            "date_of_birth": "2000-01-01"
        })
        assert signup_resp.status_code in (200, 201), signup_resp.text
        user_id = signup_resp.json()["user_id"]
        token = signup_resp.json()["access_token"]

        headers = {"Authorization": f"Bearer {token}"}
        session_resp = client.post("/api/session/start", json={
            "mode": mode,
            "title": "State Machine Test",
            "time_limit_min": time_limit_min
        }, headers=headers)
        assert session_resp.status_code == 200, session_resp.text
        session_id = session_resp.json()["session_id"]

        if questions_data:
            # Override/insert specific questions
            db.query(Question).filter(Question.session_id == session_id).delete()
            for idx, qd in enumerate(questions_data):
                q = Question(
                    session_id=session_id,
                    order_no=idx + 1,
                    question_text=qd["question_text"],
                    topic=qd.get("topic", "General"),
                    difficulty=qd.get("difficulty", "medium"),
                    origin=qd.get("origin", "uploaded"),
                    reference_answer=qd.get("reference_answer", ""),
                    followup_question=qd.get("followup_question", ""),
                    followup_answer=qd.get("followup_answer", "")
                )
                db.add(q)
            db.commit()

        return user_id, token, session_id
    finally:
        db.close()


class TestPhase2WebSocketAuth:
    def test_ws_unauthenticated_closes_or_rejects(self, client):
        _, _, session_id = _create_authenticated_user_and_session(client)
        with client.websocket_connect(f"/ws/session/{session_id}") as ws:
            # Send an invalid message instead of auth
            ws.send_json({"type": "submit_answer", "transcript": "Hello"})
            # Should receive error or close
            msg = ws.receive_json()
            assert msg.get("type") in ("error", "auth_required")
            # Should require auth

    def test_ws_authenticated_succeeds(self, client):
        _, token, session_id = _create_authenticated_user_and_session(client)
        with client.websocket_connect(f"/ws/session/{session_id}") as ws:
            ws.send_json({"type": "auth", "token": token})
            # First message received should be question_ready (or auth_ok then question_ready)
            msg = ws.receive_json()
            if msg.get("type") == "auth_ok":
                msg = ws.receive_json()
            assert msg.get("type") == "question_ready"
            assert msg.get("question_index") == 0


class TestPhase2MalformedFrames:
    def test_malformed_json_and_invalid_type_does_not_crash_socket(self, client):
        _, token, session_id = _create_authenticated_user_and_session(client)
        with client.websocket_connect(f"/ws/session/{session_id}") as ws:
            ws.send_json({"type": "auth", "token": token})
            msg = ws.receive_json()
            if msg.get("type") == "auth_ok":
                msg = ws.receive_json()
            assert msg["type"] == "question_ready"

            # 1. Send malformed raw string
            ws.send_text("THIS IS NOT JSON {}}")
            err_msg = ws.receive_json()
            assert err_msg["type"] == "error"
            assert err_msg.get("code") == "MALFORMED_JSON"

            # 2. Send unknown type
            ws.send_json({"type": "alien_message", "payload": 123})
            err_msg2 = ws.receive_json()
            assert err_msg2["type"] == "error"

            # 3. Send submit_answer with transcript = None / null
            ws.send_json({"type": "submit_answer", "transcript": None})
            err_msg3 = ws.receive_json()
            assert err_msg3["type"] == "error"

            # Socket is STILL alive! Now send valid repeat_question
            ws.send_json({"type": "repeat_question"})
            rep_msg = ws.receive_json()
            assert rep_msg["type"] == "question_repeated"


class TestPhase2FollowupStateMachine:
    def test_followup_evaluated_against_followup_and_advances(self, client):
        """
        Main question with planned followup. First answer gets follow-up question.
        Second answer must be evaluated against the follow-up, then cursor must advance to Q2.
        Must NOT loop on Q1 forever.
        """
        q_data = [
            {
                "question_text": "Explain photosynthesis.",
                "reference_answer": "Plants convert sunlight into chemical energy.",
                "followup_question": "Which organelle does photosynthesis occur in?",
                "followup_answer": "Chloroplasts."
            },
            {
                "question_text": "What is mitochondria?",
                "reference_answer": "The powerhouse of the cell.",
                "followup_question": "",
                "followup_answer": ""
            }
        ]
        _, token, session_id = _create_authenticated_user_and_session(
            client, mode="college", questions_data=q_data
        )

        with client.websocket_connect(f"/ws/session/{session_id}") as ws:
            ws.send_json({"type": "auth", "token": token})
            msg = ws.receive_json()
            if msg.get("type") == "auth_ok":
                msg = ws.receive_json()
            assert msg["type"] == "question_ready"
            assert msg["question_index"] == 0
            assert "photosynthesis" in msg["question"]["question_text"].lower()

            # Answer 1 to Q1 (weak answer triggers follow-up)
            ws.send_json({"type": "submit_answer", "transcript": "Plants make food."})
            evaluating_msg = ws.receive_json()
            assert evaluating_msg["type"] == "evaluating"

            eval_res = ws.receive_json()
            assert eval_res["type"] == "evaluation_result"

            fu_msg = ws.receive_json()
            assert fu_msg["type"] == "followup_question"
            assert "organelle" in fu_msg["question"]["question_text"].lower()

            # Now answer the follow-up!
            ws.send_json({"type": "submit_answer", "transcript": "It occurs in chloroplasts."})
            evaluating_msg2 = ws.receive_json()
            assert evaluating_msg2["type"] == "evaluating"

            eval_res2 = ws.receive_json()
            assert eval_res2["type"] == "evaluation_result"

            # Next message must be question_ready for Q2 (question_index == 1)!
            # NOT another follow-up, NOT repeating Q1!
            next_q_msg = ws.receive_json()
            assert next_q_msg["type"] == "question_ready"
            assert next_q_msg["question_index"] == 1
            assert "mitochondria" in next_q_msg["question"]["question_text"].lower()


class TestPhase2MidSessionReconnectAndReports:
    def test_reconnect_mid_session_preserves_all_answers_in_report(self, client):
        q_data = [
            {"question_text": "Q1 text", "reference_answer": "Ref 1"},
            {"question_text": "Q2 text", "reference_answer": "Ref 2"}
        ]
        _, token, session_id = _create_authenticated_user_and_session(
            client, mode="school", questions_data=q_data
        )

        # Connection 1: Answer Q1
        with client.websocket_connect(f"/ws/session/{session_id}") as ws1:
            ws1.send_json({"type": "auth", "token": token})
            m = ws1.receive_json()
            if m.get("type") == "auth_ok":
                m = ws1.receive_json()
            assert m["type"] == "question_ready"
            assert m["question_index"] == 0

            ws1.send_json({"type": "submit_answer", "transcript": "My answer to question 1."})
            assert ws1.receive_json()["type"] == "evaluating"
            assert ws1.receive_json()["type"] == "evaluation_result"

            q2_msg = ws1.receive_json()
            assert q2_msg["type"] == "question_ready"
            assert q2_msg["question_index"] == 1

        # Simulate disconnect and Reconnect (Connection 2)
        with client.websocket_connect(f"/ws/session/{session_id}") as ws2:
            ws2.send_json({"type": "auth", "token": token})
            m2 = ws2.receive_json()
            if m2.get("type") == "auth_ok":
                m2 = ws2.receive_json()
            # Must resume at Q2
            assert m2["type"] == "question_ready"
            assert m2["question_index"] == 1

            # Answer Q2
            ws2.send_json({"type": "submit_answer", "transcript": "My answer to question 2."})
            assert ws2.receive_json()["type"] == "evaluating"
            assert ws2.receive_json()["type"] == "evaluation_result"

            comp_msg = ws2.receive_json()
            assert comp_msg["type"] == "session_completing"

            done_msg = ws2.receive_json()
            assert done_msg["type"] == "session_completed"

            # Verify that the report covers BOTH questions, built from DB
            db = SessionLocal()
            try:
                report = db.query(Report).filter(Report.session_id == session_id).first()
                assert report is not None
                # Answers in DB should be 2
                answers = db.query(Answer).join(Question).filter(Question.session_id == session_id).all()
                assert len(answers) == 2
            finally:
                db.close()

    def test_reconnect_after_completion_is_idempotent(self, client):
        q_data = [
            {"question_text": "Single Q", "reference_answer": "Ref single"}
        ]
        _, token, session_id = _create_authenticated_user_and_session(
            client, mode="school", questions_data=q_data
        )

        with client.websocket_connect(f"/ws/session/{session_id}") as ws1:
            ws1.send_json({"type": "auth", "token": token})
            m = ws1.receive_json()
            if m.get("type") == "auth_ok":
                m = ws1.receive_json()
            ws1.send_json({"type": "submit_answer", "transcript": "Single answer."})
            ws1.receive_json()  # evaluating
            ws1.receive_json()  # evaluation_result
            ws1.receive_json()  # session_completing
            completed_1 = ws1.receive_json()
            assert completed_1["type"] == "session_completed"
            report_id_1 = completed_1["report_id"]

        # Reconnect on completed session
        with client.websocket_connect(f"/ws/session/{session_id}") as ws2:
            ws2.send_json({"type": "auth", "token": token})
            m2 = ws2.receive_json()
            if m2.get("type") == "auth_ok":
                m2 = ws2.receive_json()
            assert m2["type"] == "session_completed"
            assert m2["report_id"] == report_id_1

        # Check DB has exactly 1 report record
        db = SessionLocal()
        try:
            reports = db.query(Report).filter(Report.session_id == session_id).all()
            assert len(reports) == 1
        finally:
            db.close()


class TestPhase2TimerAndHonestMetrics:
    def test_timer_cannot_be_reset_by_reconnecting(self, client):
        _, token, session_id = _create_authenticated_user_and_session(client, time_limit_min=1)
        db = SessionLocal()
        try:
            session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
            assert session.started_at is None
        finally:
            db.close()

        # Connect 1: started_at should be set
        with client.websocket_connect(f"/ws/session/{session_id}") as ws1:
            ws1.send_json({"type": "auth", "token": token})
            m = ws1.receive_json()
            if m.get("type") == "auth_ok":
                m = ws1.receive_json()
            assert m["type"] == "question_ready"

        db = SessionLocal()
        try:
            session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
            first_started_at = session.started_at
            assert first_started_at is not None
        finally:
            db.close()

        # Reconnect: started_at must NOT change
        with client.websocket_connect(f"/ws/session/{session_id}") as ws2:
            ws2.send_json({"type": "auth", "token": token})
            m2 = ws2.receive_json()
            if m2.get("type") == "auth_ok":
                m2 = ws2.receive_json()
            assert m2["type"] == "question_ready"

        db = SessionLocal()
        try:
            session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
            assert session.started_at == first_started_at
        finally:
            db.close()

    def test_filler_words_computed_honestly_server_side(self, client):
        q_data = [{"question_text": "Tell me about yourself.", "reference_answer": "Summary"}]
        _, token, session_id = _create_authenticated_user_and_session(
            client, mode="school", questions_data=q_data
        )

        with client.websocket_connect(f"/ws/session/{session_id}") as ws:
            ws.send_json({"type": "auth", "token": token})
            m = ws.receive_json()
            if m.get("type") == "auth_ok":
                m = ws.receive_json()

            # Client claims filler_count=999, but transcript actually has "um", "uh", "actually", "basically" (4 fillers)
            ws.send_json({
                "type": "submit_answer",
                "transcript": "Um, so basically, uh, I actually love coding.",
                "duration_sec": 1,
                "filler_count": 999
            })
            ws.receive_json()  # evaluating
            ws.receive_json()  # evaluation_result

            db = SessionLocal()
            try:
                ans = db.query(Answer).join(Question).filter(Question.session_id == session_id).first()
                assert ans is not None
                # Server must ignore 999 and count server-side
                assert ans.filler_word_count != 999
                assert ans.filler_word_count >= 4
            finally:
                db.close()

    def test_empty_transcript_stored_as_no_answer_scored_zero(self, client):
        q_data = [{"question_text": "Hard physics question.", "reference_answer": "E=mc^2"}]
        _, token, session_id = _create_authenticated_user_and_session(
            client, mode="school", questions_data=q_data
        )

        with client.websocket_connect(f"/ws/session/{session_id}") as ws:
            ws.send_json({"type": "auth", "token": token})
            m = ws.receive_json()
            if m.get("type") == "auth_ok":
                m = ws.receive_json()

            # Send empty/whitespace transcript
            ws.send_json({
                "type": "submit_answer",
                "transcript": "   \n  "
            })
            ws.receive_json()  # evaluating
            eval_res = ws.receive_json()
            assert eval_res["type"] == "evaluation_result"
            ev = eval_res["evaluation"]
            assert ev["overall_score"] == 0.0

            db = SessionLocal()
            try:
                ans = db.query(Answer).join(Question).filter(Question.session_id == session_id).first()
                assert ans is not None
                assert ans.transcript == "no answer"
                assert ans.evaluation.overall_score == 0.0
            finally:
                db.close()
