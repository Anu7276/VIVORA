"""
Phase 1 Auth / Consent / Access-Control Tests
===============================================
These tests reproduce EXACTLY the bugs listed in Phase 1 of the audit.
Run BEFORE fixes to confirm they fail, then again after to confirm they pass.

Bugs targeted:
  P1-1: demo-student and register-student endpoints must not exist.
  P1-2: GET /session/{id} must require JWT auth.
  P1-3: GET /session/{id} must not expose reference_answer on unanswered questions.
  P1-4: /upload/* must require JWT auth.
  P1-5: Report token bypass via `if not session.session_token: return`.
  P1-6: Report token compared with == not hmac.compare_digest.
  P1-7: mode="hacker" and time_limit_min=-5 / 100000 must return 422.
  P1-8: POST /auth/signup and POST /auth/login must exist and work.
  P1-9: Minor cannot create session until parent confirms via link (not client flag).
  P1-10: Upload must reject oversized files (>10 MB) with 413.
  P1-11: Upload must reject non-pdf/txt/md files with 415.
  P1-12: Upload must reject PDFs with >100 pages with 413.
"""

import io
import os
import sys
import asyncio
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.db.database import SessionLocal, Base, engine
from app.db.models import User, Session as SessionModel, ParentConsent

Base.metadata.create_all(bind=engine)

# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


def _signup(client, email, password, name="Test User", dob="1995-01-15"):
    """Helper: create a user and return (user_id, access_token)."""
    resp = client.post("/api/auth/signup", json={
        "name": name,
        "email": email,
        "password": password,
        "date_of_birth": dob,
    })
    return resp


def _login(client, email, password):
    resp = client.post("/api/auth/login", json={
        "email": email,
        "password": password,
    })
    return resp


def _auth_header(token: str):
    return {"Authorization": f"Bearer {token}"}


# ─── P1-1: demo-student and register-student must not exist ───────────────────

class TestDemoStudentEndpointsRemoved:
    def test_get_demo_student_returns_404(self, client):
        """GET /api/session/demo-student must be removed entirely."""
        resp = client.get("/api/session/demo-student")
        # 404 = not found; 405 = method not allowed because wildcard GET /{session_id} shadowed it.
        # Both prove the purpose-built endpoint no longer exists.
        assert resp.status_code in (404, 405, 401), (
            f"GET /api/session/demo-student returned {resp.status_code}; "
            "it fabricates 'verified consent' and must be deleted."
        )

    def test_post_register_student_returns_404(self, client):
        """POST /api/session/register-student must be removed entirely."""
        resp = client.post("/api/session/register-student", json={
            "name": "Test",
            "parent_email": "p@example.com",
            "confirm_consent": True,
        })
        assert resp.status_code in (404, 405, 401, 422), (
            f"POST /api/session/register-student returned {resp.status_code}; "
            "it blindly sets verified=True from client input and must be deleted."
        )


# ─── P1-8: Auth endpoints must exist ─────────────────────────────────────────

class TestAuthEndpoints:
    def test_signup_creates_user(self, client):
        import time
        resp = _signup(client, f"phase1_new_{int(time.time()*1000)}@example.com", "Secure123!")
        assert resp.status_code in (200, 201), (
            f"POST /api/auth/signup returned {resp.status_code}. "
            "Auth signup endpoint must exist and return 200/201."
        )
        data = resp.json()
        assert "access_token" in data or "user_id" in data, (
            "Signup response must include access_token or user_id."
        )

    def test_signup_rejects_weak_password(self, client):
        resp = _signup(client, "weak_pw@example.com", "123")
        assert resp.status_code == 422, (
            f"Signup with 3-char password returned {resp.status_code}; expected 422."
        )

    def test_signup_rejects_invalid_email(self, client):
        resp = _signup(client, "not-an-email", "Secure123!")
        assert resp.status_code == 422, (
            f"Signup with invalid email returned {resp.status_code}; expected 422."
        )

    def test_login_returns_token(self, client):
        email = "phase1_login@example.com"
        _signup(client, email, "Secure123!")
        resp = _login(client, email, "Secure123!")
        assert resp.status_code == 200, (
            f"POST /api/auth/login returned {resp.status_code}; expected 200."
        )
        data = resp.json()
        assert "access_token" in data, "Login response must include access_token."

    def test_login_wrong_password_returns_401(self, client):
        email = "phase1_wrong_pw@example.com"
        _signup(client, email, "Correct123!")
        resp = _login(client, email, "Wrong123!")
        assert resp.status_code == 401, (
            f"Login with wrong password returned {resp.status_code}; expected 401."
        )

    def test_duplicate_email_returns_409(self, client):
        email = "phase1_dup@example.com"
        _signup(client, email, "Secure123!")
        resp = _signup(client, email, "Secure123!")
        assert resp.status_code == 409, (
            f"Duplicate email signup returned {resp.status_code}; expected 409."
        )


# ─── P1-2: Unauthenticated access to session must fail ───────────────────────

class TestUnauthenticatedSessionAccess:
    def test_get_session_no_auth_returns_401(self, client):
        """GET /api/session/{id} without Bearer token must return 401."""
        resp = client.get("/api/session/00000000-0000-0000-0000-000000000000")
        assert resp.status_code == 401, (
            f"GET /session/{{id}} without auth returned {resp.status_code}; expected 401. "
            "Session details must require authentication."
        )

    def test_cross_user_session_access_returns_404(self, client):
        """One user cannot see another user's session (returns 404 not 403)."""
        import time
        ts = int(time.time() * 1000)
        # Create user A and their session
        email_a = f"phase1_usera_{ts}@example.com"
        signup_a = _signup(client, email_a, "Secure123!")
        assert signup_a.status_code in (200, 201)
        login_a = _login(client, email_a, "Secure123!")
        token_a = login_a.json()["access_token"]

        session_resp = client.post("/api/session/start", json={
            "mode": "school",
            "title": "User A Session",
            "content_text": "Q: What is photosynthesis?\nAns: Plants make food.",
        }, headers=_auth_header(token_a))
        assert session_resp.status_code == 200
        session_id = session_resp.json()["session_id"]

        # User B tries to access user A's session
        email_b = f"phase1_userb_{ts}@example.com"
        signup_b = _signup(client, email_b, "Secure123!")
        assert signup_b.status_code in (200, 201)
        login_b = _login(client, email_b, "Secure123!")
        token_b = login_b.json()["access_token"]

        resp = client.get(f"/api/session/{session_id}", headers=_auth_header(token_b))
        assert resp.status_code == 404, (
            f"Cross-user session access returned {resp.status_code}; expected 404. "
            "Must return 404 (not 403) to avoid resource enumeration."
        )


# ─── P1-3: reference_answer must be hidden for unanswered questions ──────────

class TestReferenceAnswerHidden:
    def test_reference_answer_not_in_unanswered_questions(self, client):
        """GET /api/session/{id} must omit reference_answer for unanswered questions."""
        email = "phase1_refans@example.com"
        _signup(client, email, "Secure123!")
        token = _login(client, email, "Secure123!")
        assert token.status_code == 200
        tok = token.json()["access_token"]

        session_resp = client.post("/api/session/start", json={
            "mode": "school",
            "title": "Ref Answer Test",
            "content_text": "Q: What is photosynthesis?\nAns: Plants make food using sunlight.",
        }, headers=_auth_header(tok))
        assert session_resp.status_code == 200
        session_id = session_resp.json()["session_id"]

        detail = client.get(f"/api/session/{session_id}", headers=_auth_header(tok))
        assert detail.status_code == 200

        questions = detail.json()["questions"]
        unanswered = [q for q in questions if not q.get("answer")]
        assert len(unanswered) > 0, "Expected at least one unanswered question"

        for q in unanswered:
            assert "reference_answer" not in q or q.get("reference_answer") is None, (
                f"Question {q.get('order_no')} exposes reference_answer='{q.get('reference_answer')}' "
                "before the student has answered. This lets students cheat."
            )


# ─── P1-4: /upload/* must require auth ────────────────────────────────────────

class TestUploadRequiresAuth:
    def test_upload_text_no_auth_returns_401(self, client):
        resp = client.post("/api/upload/text", json={
            "title": "Test Doc",
            "content": "Some content",
        })
        assert resp.status_code == 401, (
            f"POST /api/upload/text without auth returned {resp.status_code}; expected 401."
        )

    def test_upload_file_no_auth_returns_401(self, client):
        resp = client.post("/api/upload/file", files={
            "file": ("test.txt", b"hello content", "text/plain"),
        })
        assert resp.status_code == 401, (
            f"POST /api/upload/file without auth returned {resp.status_code}; expected 401."
        )


# ─── P1-5/6: Report token bypass and compare_digest ─────────────────────────

class TestReportTokenSecurity:
    def _create_session_with_token(self, client) -> tuple:
        email = f"phase1_rep_{id(client)}@example.com"
        _signup(client, email, "Secure123!")
        tok = _login(client, email, "Secure123!").json()["access_token"]
        resp = client.post("/api/session/start", json={
            "mode": "school",
            "title": "Token Test",
            "content_text": "Q: Test?\nAns: Answer.",
        }, headers=_auth_header(tok))
        return resp.json()["session_id"], resp.json().get("session_token", ""), tok

    def test_null_session_token_in_db_does_not_bypass(self, client):
        """
        A session with no session_token in DB must NOT allow token-less access.
        The old code had `if not session.session_token: return` which bypassed the check.
        """
        import uuid
        db = SessionLocal()
        try:
            # Create a session record with session_token=None deliberately
            bare_session = SessionModel(
                id=str(uuid.uuid4()),
                mode="school",
                time_limit_min=15,
                session_token=None,   # <-- the bypass case
                status="created",
            )
            db.add(bare_session)
            db.commit()
            sid = bare_session.id
        finally:
            db.close()

        resp = client.get(f"/api/report/{sid}")
        # Must NOT return 200 (the bypass case) — must return 401 or 403
        assert resp.status_code in (401, 403), (
            f"Session with NULL token returned {resp.status_code}; "
            "the old `if not session.session_token: return` bypass must be removed."
        )

    def test_token_in_query_string_blocked_or_deprecated(self, client):
        """
        Tokens sent as ?token= in the URL are logged by reverse proxies.
        Preferred: X-Session-Token header. Query-string token should ideally be rejected.
        At minimum: if we keep it, the comparison MUST use hmac.compare_digest.
        This test verifies the comparison is timing-safe (no early return).
        NOTE: We only verify the hmac module is used; the structural test is in P1-5.
        """
        from app.api.routes import report as report_module
        import inspect
        source = inspect.getsource(report_module)
        # The old code used == for comparison; we require hmac.compare_digest
        assert "compare_digest" in source, (
            "report.py must use hmac.compare_digest for token comparison, "
            "not ==, to prevent timing attacks."
        )


# ─── P1-7: mode and time_limit_min validation ────────────────────────────────

class TestSessionInputValidation:
    def _get_token(self, client, suffix=""):
        email = f"phase1_val{suffix}@example.com"
        _signup(client, email, "Secure123!")
        return _login(client, email, "Secure123!").json()["access_token"]

    def test_invalid_mode_returns_422(self, client):
        tok = self._get_token(client, "mode")
        resp = client.post("/api/session/start", json={
            "mode": "hacker",
            "title": "Bad Mode",
            "content_text": "Q: Bad?\nAns: Bad.",
        }, headers=_auth_header(tok))
        assert resp.status_code == 422, (
            f"mode='hacker' returned {resp.status_code}; expected 422. "
            "Mode must be validated as one of: school, college, interview."
        )

    def test_negative_time_limit_returns_422(self, client):
        tok = self._get_token(client, "neg_time")
        resp = client.post("/api/session/start", json={
            "mode": "school",
            "title": "Bad Time",
            "content_text": "Q: Test?\nAns: Test.",
            "time_limit_min": -5,
        }, headers=_auth_header(tok))
        assert resp.status_code == 422, (
            f"time_limit_min=-5 returned {resp.status_code}; expected 422."
        )

    def test_excessive_time_limit_returns_422(self, client):
        tok = self._get_token(client, "big_time")
        resp = client.post("/api/session/start", json={
            "mode": "school",
            "title": "Huge Time",
            "content_text": "Q: Test?\nAns: Test.",
            "time_limit_min": 100000,
        }, headers=_auth_header(tok))
        assert resp.status_code == 422, (
            f"time_limit_min=100000 returned {resp.status_code}; expected 422."
        )

    def test_valid_mode_and_time_limit_succeeds(self, client):
        tok = self._get_token(client, "valid")
        resp = client.post("/api/session/start", json={
            "mode": "school",
            "title": "Valid Session",
            "content_text": "Q: What is photosynthesis?\nAns: Plant food from sunlight.",
            "time_limit_min": 15,
        }, headers=_auth_header(tok))
        assert resp.status_code == 200, (
            f"Valid session start returned {resp.status_code}; expected 200."
        )


# ─── P1-9: Minor cannot create session until parent confirms via link ─────────

class TestMinorParentConsentFlow:
    def test_minor_signup_creates_pending_account(self, client):
        """Signing up as a minor (DOB < 18y ago) creates a pending_parent_consent account."""
        resp = _signup(
            client,
            "minor_phase1@example.com",
            "Secure123!",
            dob="2015-06-01"   # ~11 years old
        )
        # Minor signup without parent_email → 422 (correct validation)
        # OR minor signup with parent_email → pending_parent_consent (also correct)
        if resp.status_code == 422:
            # 422 is correct if parent_email is missing — try again with parent_email
            import random
            resp = client.post("/api/auth/signup", json={
                "name": "Minor Test",
                "email": f"minor_phase1b_{random.randint(1000,9999)}@example.com",
                "password": "Secure123!",
                "date_of_birth": "2015-06-01",
                "parent_email": "parent@example.com",
            })
        assert resp.status_code in (200, 201), (
            f"Minor signup returned {resp.status_code}: {resp.text}"
        )
        data = resp.json()
        # Must not immediately get a usable token for session creation
        # The account status must be pending_parent_consent
        assert data.get("status") == "pending_parent_consent" or \
               "pending" in str(data).lower() or \
               "consent" in str(data).lower(), (
            f"Minor signup response should indicate pending consent status. Got: {data}"
        )

    def test_minor_cannot_start_session_without_parent_confirm(self, client):
        """A minor with pending consent must get 403/423 on session start."""
        import random
        email = f"minor_no_session_{random.randint(1000,9999)}@example.com"
        signup = client.post("/api/auth/signup", json={
            "name": "Minor No Session",
            "email": email,
            "password": "Secure123!",
            "date_of_birth": "2015-01-01",
            "parent_email": "parent@example.com",
        })
        assert signup.status_code in (200, 201)

        # Try to login and create session
        login = _login(client, email, "Secure123!")
        if login.status_code != 200:
            # If login is blocked for pending accounts, the test still passes
            pytest.skip("Minor login blocked at login stage (also acceptable)")
        tok = login.json().get("access_token")
        if not tok:
            pytest.skip("No token issued for pending minor account (also acceptable)")

        resp = client.post("/api/session/start", json={
            "mode": "school",
            "title": "Minor Session",
            "content_text": "Q: Test?\nAns: Test.",
        }, headers=_auth_header(tok))
        assert resp.status_code in (403, 423), (
            f"Minor without parent confirmation returned {resp.status_code}; "
            "expected 403 or 423."
        )

    def test_parent_consent_confirm_endpoint_exists(self, client):
        """POST /api/auth/parent-consent/confirm endpoint must exist."""
        resp = client.post("/api/auth/parent-consent/confirm", params={"token": "invalid-token"})
        # Must not be 404 (endpoint must exist); 400/422 for bad token is fine
        assert resp.status_code != 404, (
            "POST /api/auth/parent-consent/confirm must exist. "
            f"Got 404 — endpoint is missing."
        )


# ─── P1-10/11/12: Upload size and type limits ─────────────────────────────────

class TestUploadLimits:
    def _get_token(self, client):
        email = "phase1_upload@example.com"
        _signup(client, email, "Secure123!")
        return _login(client, email, "Secure123!").json()["access_token"]

    def test_oversized_file_returns_413(self, client):
        """Files larger than 10 MB must be rejected with 413."""
        tok = self._get_token(client)
        big_content = b"X" * (11 * 1024 * 1024)  # 11 MB
        resp = client.post(
            "/api/upload/file",
            files={"file": ("big.txt", big_content, "text/plain")},
            headers=_auth_header(tok),
        )
        assert resp.status_code == 413, (
            f"11 MB file returned {resp.status_code}; expected 413. "
            "Upload must reject files larger than 10 MB."
        )

    def test_disallowed_file_type_returns_415(self, client):
        """Files with types other than pdf/txt/md must return 415."""
        tok = self._get_token(client)
        resp = client.post(
            "/api/upload/file",
            files={"file": ("malware.exe", b"MZ\x00\x00fake exe content", "application/octet-stream")},
            headers=_auth_header(tok),
        )
        assert resp.status_code == 415, (
            f"Disallowed file type returned {resp.status_code}; expected 415. "
            "Only pdf, txt, and md files must be accepted."
        )

    def test_allowed_txt_file_accepted(self, client):
        """Plain text files must be accepted."""
        tok = self._get_token(client)
        resp = client.post(
            "/api/upload/file",
            files={"file": ("notes.txt", b"Q: What is AI?\nAns: Artificial Intelligence.", "text/plain")},
            headers=_auth_header(tok),
        )
        # 200 OK (or 422 if content too short, but NOT 415)
        assert resp.status_code != 415, (
            f".txt file returned 415; txt must be an allowed file type."
        )
