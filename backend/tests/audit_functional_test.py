import asyncio
import json
import httpx
import websockets
import uuid
import sys
import os

BASE_URL = "http://127.0.0.1:8000/api"
WS_BASE = "ws://127.0.0.1:8000"

results = []

def record(test_id, name, status, details, severity=None, bug=None):
    results.append({
        "id": test_id,
        "name": name,
        "status": status,
        "details": details,
        "severity": severity,
        "bug": bug
    })
    print(f"[{status}] {test_id}: {name} - {details}")

async def run_audit():
    async with httpx.AsyncClient(timeout=15.0) as client:
        # ── 1. HEALTH CHECKS ──
        try:
            r = await client.get("http://127.0.0.1:8000/health")
            if r.status_code == 200 and r.json().get("status") == "healthy":
                record("TC-HLTH-01", "Health endpoint /health", "PASS", "Returned 200 healthy")
            else:
                record("TC-HLTH-01", "Health endpoint /health", "FAIL", f"Status {r.status_code}: {r.text}", "High")
        except Exception as e:
            record("TC-HLTH-01", "Health endpoint /health", "FAIL", str(e), "Critical")

        # ── 2. AUTHENTICATION & EDGE CASES ──
        # Edge case: Weak password (< 8 chars)
        r = await client.post(f"{BASE_URL}/auth/signup", json={
            "name": "Weak Pass User",
            "email": f"weak_{uuid.uuid4().hex[:6]}@example.com",
            "password": "pass",
            "date_of_birth": "2000-01-01"
        })
        if r.status_code in (422, 400):
            record("TC-AUTH-01", "Signup rejects weak password (<8 chars)", "PASS", f"Rejected with {r.status_code}")
        else:
            record("TC-AUTH-01", "Signup rejects weak password (<8 chars)", "FAIL", f"Accepted with {r.status_code}", "High", "Weak password accepted")

        # Edge case: Password without numbers/special chars
        r = await client.post(f"{BASE_URL}/auth/signup", json={
            "name": "No Number User",
            "email": f"nonum_{uuid.uuid4().hex[:6]}@example.com",
            "password": "justlettersonly",
            "date_of_birth": "2000-01-01"
        })
        if r.status_code in (422, 400):
            record("TC-AUTH-02", "Signup rejects password with no digit/symbol", "PASS", f"Rejected with {r.status_code}")
        else:
            record("TC-AUTH-02", "Signup rejects password with no digit/symbol", "FAIL", f"Accepted with {r.status_code}", "Medium")

        # Edge case: SQL injection in email
        r = await client.post(f"{BASE_URL}/auth/signup", json={
            "name": "SQLi Test",
            "email": "' OR 1=1; --@example.com",
            "password": "ValidPassword123!",
            "date_of_birth": "2000-01-01"
        })
        if r.status_code in (422, 400):
            record("TC-AUTH-03", "Signup rejects malformed/SQLi email", "PASS", f"Rejected with {r.status_code}")
        else:
            record("TC-AUTH-03", "Signup rejects malformed/SQLi email", "FAIL", f"Unexpected status {r.status_code}", "High")

        # Edge case: Child email == Parent email
        r = await client.post(f"{BASE_URL}/auth/signup", json={
            "name": "Minor Fraud",
            "email": "same_email@example.com",
            "password": "ValidPassword123!",
            "date_of_birth": "2012-05-15",
            "parent_email": "same_email@example.com"
        })
        if r.status_code in (422, 400):
            record("TC-AUTH-04", "Minor signup rejects identical parent email", "PASS", f"Rejected with {r.status_code}")
        else:
            record("TC-AUTH-04", "Minor signup rejects identical parent email", "FAIL", f"Accepted with {r.status_code}", "High")

        # Edge case: Minor signup without parent email
        r = await client.post(f"{BASE_URL}/auth/signup", json={
            "name": "Minor No Parent",
            "email": f"noparent_{uuid.uuid4().hex[:6]}@example.com",
            "password": "ValidPassword123!",
            "date_of_birth": "2012-05-15"
        })
        if r.status_code in (422, 400):
            record("TC-AUTH-05", "Minor signup requires parent email", "PASS", f"Rejected with {r.status_code}")
        else:
            record("TC-AUTH-05", "Minor signup requires parent email", "FAIL", f"Accepted with {r.status_code}", "High")

        # Happy path: Adult signup
        adult_email = f"adult_{uuid.uuid4().hex[:6]}@testvivora.com"
        adult_pass = "SecurePass123!"
        r = await client.post(f"{BASE_URL}/auth/signup", json={
            "name": "Alice Tester",
            "email": adult_email,
            "password": adult_pass,
            "date_of_birth": "1998-04-12"
        })
        adult_token = None
        adult_user_id = None
        if r.status_code == 200 and r.json().get("access_token"):
            adult_token = r.json()["access_token"]
            adult_user_id = r.json()["user_id"]
            record("TC-AUTH-06", "Adult signup succeeds with immediate JWT", "PASS", f"User {adult_user_id} created")
        else:
            record("TC-AUTH-06", "Adult signup succeeds with immediate JWT", "FAIL", f"Status {r.status_code}: {r.text}", "Critical")

        # Happy path: Adult Login
        r = await client.post(f"{BASE_URL}/auth/login", json={
            "email": adult_email,
            "password": adult_pass
        })
        if r.status_code == 200 and r.json().get("access_token"):
            record("TC-AUTH-07", "Adult login succeeds and issues JWT", "PASS", "Token received")
        else:
            record("TC-AUTH-07", "Adult login succeeds and issues JWT", "FAIL", f"Status {r.status_code}: {r.text}", "Critical")

        # Edge case: Login with wrong password (no user enumeration timing leak)
        r = await client.post(f"{BASE_URL}/auth/login", json={
            "email": adult_email,
            "password": "WrongPassword999!"
        })
        if r.status_code == 401:
            record("TC-AUTH-08", "Login with wrong password returns 401", "PASS", "401 Unauthorized")
        else:
            record("TC-AUTH-08", "Login with wrong password returns 401", "FAIL", f"Status {r.status_code}", "High")

        # Edge case: Protected endpoint /api/auth/me without token
        r = await client.get(f"{BASE_URL}/auth/me")
        if r.status_code == 401:
            record("TC-AUTH-09", "/api/auth/me rejects unauthenticated request", "PASS", "401 Unauthorized")
        else:
            record("TC-AUTH-09", "/api/auth/me rejects unauthenticated request", "FAIL", f"Status {r.status_code}", "Critical")

        # Happy path: Protected endpoint /api/auth/me with valid token
        auth_headers = {"Authorization": f"Bearer {adult_token}"}
        r = await client.get(f"{BASE_URL}/auth/me", headers=auth_headers)
        if r.status_code == 200 and r.json().get("email") == adult_email:
            record("TC-AUTH-10", "/api/auth/me returns authenticated profile", "PASS", f"Profile matches {adult_email}")
        else:
            record("TC-AUTH-10", "/api/auth/me returns authenticated profile", "FAIL", f"Status {r.status_code}: {r.text}", "High")

        # ── 3. UPLOAD & INGESTION TESTING ──
        # Edge case: Text upload without auth
        r = await client.post(f"{BASE_URL}/upload/text", json={
            "title": "Unauthenticated Syllabus",
            "doc_type": "syllabus",
            "content": "Some syllabus text"
        })
        if r.status_code == 401:
            record("TC-UPLD-01", "Text upload requires authentication", "PASS", "401 Unauthorized")
        else:
            record("TC-UPLD-01", "Text upload requires authentication", "FAIL", f"Status {r.status_code}", "High")

        # Happy path: Text upload with auth
        sample_syllabus = """
        Chapter 1: Operating Systems and Concurrency.
        Processes, Threads, Semaphores, Mutexes, Deadlocks, Banker's Algorithm.
        Q: What is a deadlock and what are the four Coffman conditions?
        A: A deadlock occurs when processes are blocked waiting for resources held by each other. Conditions: Mutual Exclusion, Hold and Wait, No Preemption, Circular Wait.
        """
        r = await client.post(f"{BASE_URL}/upload/text", headers=auth_headers, json={
            "title": "Operating Systems Syllabus",
            "doc_type": "syllabus",
            "content": sample_syllabus
        })
        doc_id = None
        if r.status_code == 200 and r.json().get("document_id"):
            doc_id = r.json()["document_id"]
            record("TC-UPLD-02", "Text upload parses and indexes material", "PASS", f"Doc {doc_id} created with {r.json().get('questions_detected', 0)} questions")
        else:
            record("TC-UPLD-02", "Text upload parses and indexes material", "FAIL", f"Status {r.status_code}: {r.text}", "Critical")

        # Edge case: Disallowed file extension (.exe)
        r = await client.post(f"{BASE_URL}/upload/file", headers=auth_headers, files={
            "file": ("malicious.exe", b"MZ\x90\x00\x03\x00\x00\x00", "application/x-dosexec")
        })
        if r.status_code == 415:
            record("TC-UPLD-03", "File upload rejects unsupported file type (.exe) with 415", "PASS", "415 Unsupported Media Type")
        else:
            record("TC-UPLD-03", "File upload rejects unsupported file type (.exe) with 415", "FAIL", f"Status {r.status_code}", "High")

        # Edge case: Oversize file simulation (>10 MB)
        oversize_bytes = b"0" * (10 * 1024 * 1024 + 1024)
        try:
            r = await client.post(f"{BASE_URL}/upload/file", headers=auth_headers, files={
                "file": ("huge.txt", oversize_bytes, "text/plain")
            })
            if r.status_code in (413, 400):
                record("TC-UPLD-04", "File upload rejects payload > 10MB with 413", "PASS", f"Rejected with {r.status_code}")
            else:
                record("TC-UPLD-04", "File upload rejects payload > 10MB with 413", "FAIL", f"Status {r.status_code}", "High")
        except httpx.RequestError as e:
            record("TC-UPLD-04", "File upload rejects payload > 10MB with 413", "PASS", f"Connection terminated / rejected: {e}")

        # ── 4. SESSION CREATION & USER ISOLATION ──
        # Edge case: Invalid mode
        r = await client.post(f"{BASE_URL}/session/start", headers=auth_headers, json={
            "mode": "invalid_super_mode",
            "title": "Invalid Mode Session"
        })
        if r.status_code in (422, 400):
            record("TC-SESS-01", "Session start rejects invalid mode", "PASS", f"Rejected with {r.status_code}")
        else:
            record("TC-SESS-01", "Session start rejects invalid mode", "FAIL", f"Accepted with {r.status_code}", "Medium")

        # Edge case: Excessive time limit (> MAX_TIME_LIMIT_MIN=30)
        r = await client.post(f"{BASE_URL}/session/start", headers=auth_headers, json={
            "mode": "college",
            "title": "Too Long Session",
            "time_limit_min": 120
        })
        if r.status_code in (422, 400):
            record("TC-SESS-02", "Session start enforces max time limit (<=30m)", "PASS", f"Rejected with {r.status_code}")
        else:
            record("TC-SESS-02", "Session start enforces max time limit (<=30m)", "FAIL", f"Accepted with {r.status_code}", "Medium")

        # Happy path: Create College Viva Session
        r = await client.post(f"{BASE_URL}/session/start", headers=auth_headers, json={
            "mode": "college",
            "title": "OS College Viva",
            "document_id": doc_id,
            "time_limit_min": 15
        })
        session_id = None
        session_token = None
        if r.status_code == 200 and r.json().get("session_id"):
            session_id = r.json()["session_id"]
            session_token = r.json()["session_token"]
            record("TC-SESS-03", "College session created with questions", "PASS", f"Session {session_id} created with {r.json().get('total_questions', 0)} questions")
        else:
            record("TC-SESS-03", "College session created with questions", "FAIL", f"Status {r.status_code}: {r.text}", "Critical")

        # IDOR Test: Create a second user and attempt to fetch first user's session
        second_email = f"second_{uuid.uuid4().hex[:6]}@testvivora.com"
        r = await client.post(f"{BASE_URL}/auth/signup", json={
            "name": "Bob Hacker",
            "email": second_email,
            "password": "SecurePassword999!",
            "date_of_birth": "1995-08-20"
        })
        second_token = r.json().get("access_token")
        second_headers = {"Authorization": f"Bearer {second_token}"}

        r = await client.get(f"{BASE_URL}/session/{session_id}", headers=second_headers)
        if r.status_code == 404:
            record("TC-SESS-04", "IDOR Protection: Cross-user session query returns 404", "PASS", "404 Not Found (zero resource enumeration)")
        else:
            record("TC-SESS-04", "IDOR Protection: Cross-user session query returns 404", "FAIL", f"Status {r.status_code} - Leak!", "Critical", "Cross-user IDOR access permitted")

        # Cheating prevention check: GET session details must omit reference_answer for unanswered questions
        r = await client.get(f"{BASE_URL}/session/{session_id}", headers=auth_headers)
        if r.status_code == 200:
            qs = r.json().get("questions", [])
            has_leaked_answer = any("reference_answer" in q and q["reference_answer"] for q in qs if not q.get("answer"))
            if not has_leaked_answer:
                record("TC-SESS-05", "Cheating Prevention: Unanswered questions omit reference_answer", "PASS", f"{len(qs)} questions checked; answers omitted")
            else:
                record("TC-SESS-05", "Cheating Prevention: Unanswered questions omit reference_answer", "FAIL", "reference_answer exposed before answer submission!", "High", "Cheating vulnerability")
        else:
            record("TC-SESS-05", "Cheating Prevention check", "FAIL", f"Status {r.status_code}", "High")

        # ── 5. WEBSOCKET REALTIME INTERACTION TESTING ──
        # Test WS connection without auth within 5 seconds -> should time out and close
        ws_url = f"{WS_BASE}/ws/session/{session_id}"
        try:
            async with websockets.connect(ws_url) as ws:
                # Do not send auth token, wait 6 seconds
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=6.5)
                    data = json.loads(msg)
                    if data.get("code") == "AUTH_TIMEOUT":
                        record("TC-WS-01", "WS terminates if auth message not sent in 5s", "PASS", "Closed with AUTH_TIMEOUT")
                    else:
                        record("TC-WS-01", "WS terminates if auth message not sent in 5s", "FAIL", f"Unexpected msg: {msg}", "High")
                except asyncio.TimeoutError:
                    record("TC-WS-01", "WS terminates if auth message not sent in 5s", "FAIL", "Socket kept open without auth!", "Critical")
        except websockets.exceptions.ConnectionClosed as e:
            record("TC-WS-01", "WS terminates if auth message not sent in 5s", "PASS", f"Closed cleanly code={e.code}")
        except Exception as e:
            record("TC-WS-01", "WS auth timeout test", "FAIL", str(e), "Medium")

        # Test WS connection with second user's token (Cross-user WS access)
        try:
            async with websockets.connect(ws_url) as ws:
                await ws.send(json.dumps({"type": "auth", "token": second_token}))
                msg = await ws.recv()
                data = json.loads(msg)
                if data.get("code") == "FORBIDDEN":
                    record("TC-WS-02", "WS forbids cross-user session connection", "PASS", "Rejected with FORBIDDEN")
                else:
                    record("TC-WS-02", "WS forbids cross-user session connection", "FAIL", f"Unexpected message: {msg}", "Critical")
        except websockets.exceptions.ConnectionClosed:
            record("TC-WS-02", "WS forbids cross-user session connection", "PASS", "Connection closed by server")
        except Exception as e:
            record("TC-WS-02", "WS cross-user connection test", "FAIL", str(e), "High")

        # Happy path WS viva flow: Authenticate, receive question, ask doubt, submit answer
        try:
            async with websockets.connect(ws_url) as ws:
                # 1. Send auth
                await ws.send(json.dumps({"type": "auth", "token": adult_token}))
                auth_resp = await asyncio.wait_for(ws.recv(), timeout=5.0)
                assert json.loads(auth_resp).get("type") == "auth_ok"
                record("TC-WS-03", "WS auth handshake succeeds with valid JWT", "PASS", "auth_ok received")

                # 2. Receive first question
                first_q_msg = await asyncio.wait_for(ws.recv(), timeout=10.0)
                first_q = json.loads(first_q_msg)
                if first_q.get("type") == "question":
                    q_text = first_q.get("question", {}).get("question_text")
                    q_id = first_q.get("question", {}).get("id")
                    record("TC-WS-04", "WS receives first viva question", "PASS", f"Received Q1: '{q_text[:40]}...'")
                    
                    # 3. Test Ask Doubt mid-session
                    await ws.send(json.dumps({
                        "type": "ask_doubt",
                        "doubt_query": "Can you explain what Coffman conditions mean in simple terms?"
                    }))
                    doubt_resp = await asyncio.wait_for(ws.recv(), timeout=20.0)
                    doubt_data = json.loads(doubt_resp)
                    if doubt_data.get("type") == "doubt_answer":
                        record("TC-WS-05", "WS handles mid-session doubt clarification", "PASS", f"Doubt explained: '{doubt_data.get('explanation', '')[:40]}...'")
                    else:
                        record("TC-WS-05", "WS handles mid-session doubt clarification", "FAIL", f"Got: {doubt_resp}", "Medium")

                    # 4. Test Repeat Question
                    await ws.send(json.dumps({"type": "repeat_question"}))
                    repeat_resp = await asyncio.wait_for(ws.recv(), timeout=5.0)
                    if json.loads(repeat_resp).get("type") == "question":
                        record("TC-WS-06", "WS handles repeat question request", "PASS", "Question re-emitted")
                    else:
                        record("TC-WS-06", "WS handles repeat question request", "FAIL", f"Got: {repeat_resp}", "Low")

                    # 5. Submit valid spoken answer
                    await ws.send(json.dumps({
                        "type": "submit_answer",
                        "transcript": "A deadlock occurs when multiple processes each hold a resource and wait for another resource held by another process. The four conditions are mutual exclusion, hold and wait, no preemption, and circular wait.",
                        "duration_sec": 14,
                        "audio_level": 0.82
                    }))
                    
                    # Receive evaluation
                    eval_msg = await asyncio.wait_for(ws.recv(), timeout=25.0)
                    eval_data = json.loads(eval_msg)
                    if eval_data.get("type") == "evaluation_result":
                        score = eval_data.get("evaluation", {}).get("overall_score")
                        record("TC-WS-07", "WS evaluates answer with rubric scoring", "PASS", f"Overall score: {score}/10, Provider: {eval_data.get('evaluation', {}).get('provider')}")
                    else:
                        record("TC-WS-07", "WS evaluates answer with rubric scoring", "FAIL", f"Unexpected msg: {eval_msg}", "High")

                    # Next question or follow-up
                    next_msg = await asyncio.wait_for(ws.recv(), timeout=15.0)
                    next_data = json.loads(next_msg)
                    if next_data.get("type") in ("question", "followup_question"):
                        record("TC-WS-08", "WS progresses to next question / follow-up turn", "PASS", f"Type: {next_data.get('type')}")
                    else:
                        record("TC-WS-08", "WS progresses to next turn", "FAIL", f"Got: {next_msg}", "Medium")

                    # 6. End session early
                    await ws.send(json.dumps({"type": "end_session"}))
                    end_msg = await asyncio.wait_for(ws.recv(), timeout=25.0)
                    end_data = json.loads(end_msg)
                    if end_data.get("type") == "session_completed":
                        record("TC-WS-09", "WS ends session and triggers report generation", "PASS", f"Report generated with score: {end_data.get('overall_score')}")
                    else:
                        record("TC-WS-09", "WS ends session and triggers report generation", "FAIL", f"Got: {end_msg}", "High")
                else:
                    record("TC-WS-04", "WS receives first question", "FAIL", f"Unexpected: {first_q_msg}", "High")
        except Exception as e:
            record("TC-WS-03", "WS viva conversation flow", "FAIL", str(e), "High")

        # ── 6. REPORT & GDPR PURGE TESTING ──
        # GET report without session token
        r = await client.get(f"{BASE_URL}/report/{session_id}")
        if r.status_code == 403:
            record("TC-RPT-01", "Report access strictly blocked without session token", "PASS", "403 Forbidden")
        else:
            record("TC-RPT-01", "Report access strictly blocked without session token", "FAIL", f"Status {r.status_code}", "High", "Unauthenticated report access")

        # GET report with valid session token in header
        r = await client.get(f"{BASE_URL}/report/{session_id}", headers={"X-Session-Token": session_token})
        if r.status_code == 200 and "overall_score" in r.json():
            record("TC-RPT-02", "Report retrieved with valid session token", "PASS", f"Overall score: {r.json().get('overall_score')}, Topics: {len(r.json().get('topic_scores', []))}")
        else:
            record("TC-RPT-02", "Report retrieved with valid session token", "FAIL", f"Status {r.status_code}: {r.text}", "High")

        # DELETE session data (GDPR Right-to-be-forgotten)
        r = await client.delete(f"{BASE_URL}/report/{session_id}/data", headers={"X-Session-Token": session_token})
        if r.status_code == 200:
            record("TC-GDPR-01", "GDPR purge endpoint deletes session data", "PASS", "200 Data deleted")
            # Verify subsequent GET returns 404
            check = await client.get(f"{BASE_URL}/report/{session_id}", headers={"X-Session-Token": session_token})
            if check.status_code == 404:
                record("TC-GDPR-02", "Purged session report is permanently removed (404)", "PASS", "Confirmed 404")
            else:
                record("TC-GDPR-02", "Purged session report is permanently removed", "FAIL", f"Still accessible with {check.status_code}!", "Critical", "Data deletion failed")
        else:
            record("TC-GDPR-01", "GDPR purge endpoint deletes session data", "FAIL", f"Status {r.status_code}: {r.text}", "High")

    print("\n" + "="*50)
    print(f"AUDIT FUNCTIONAL TESTING COMPLETE: {len(results)} TESTS RUN")
    passed = [r for r in results if r['status'] == 'PASS']
    failed = [r for r in results if r['status'] == 'FAIL']
    print(f"PASSED: {len(passed)} / {len(results)}")
    print(f"FAILED: {len(failed)} / {len(results)}")
    if failed:
        print("\nFAILURES IDENTIFIED:")
        for f in failed:
            print(f"- {f['id']} [{f['severity']}]: {f['name']} -> {f['details']}")
    print("="*50)

if __name__ == "__main__":
    asyncio.run(run_audit())
