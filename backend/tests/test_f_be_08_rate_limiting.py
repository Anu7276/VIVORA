import time
import pytest
from starlette.testclient import TestClient
from app.main import app
from app.core.rate_limiter import SimpleRateLimiter, doubt_limiter
from tests.test_phase2_session_ws import _create_authenticated_user_and_session

@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c

def test_simple_rate_limiter_evicts_stale_keys():
    """F-BE-06: Verifies that SimpleRateLimiter evicts expired keys to prevent memory leak."""
    limiter = SimpleRateLimiter(max_requests=2, window_sec=1, max_keys=5)
    limiter.check_and_record("user_1")
    limiter.check_and_record("user_2")
    assert "user_1" in limiter._records
    assert "user_2" in limiter._records

    # Fast forward past window_sec
    future_time = time.monotonic() + 10.0
    limiter.cleanup(now=future_time)
    assert "user_1" not in limiter._records
    assert "user_2" not in limiter._records
    assert len(limiter._records) == 0

def test_daily_session_limit_enforced(client):
    """F-PROD-01 / F-BE-08: Daily session cap per user."""
    from app.core.config import settings
    _, token, _ = _create_authenticated_user_and_session(client)
    headers = {"Authorization": f"Bearer {token}", "X-Test-Rate-Limit": "true"}

    # We already have 1 session created by fixture. Let's create until limit
    limit = settings.DAILY_SESSION_LIMIT
    for _ in range(limit - 1):
        resp = client.post("/api/session/start", json={"mode": "school", "title": "Viva"}, headers=headers)
        assert resp.status_code == 200, resp.text

    # One more should hit daily limit
    blocked = client.post("/api/session/start", json={"mode": "school", "title": "Viva"}, headers=headers)
    assert blocked.status_code == 429
    assert "daily session limit" in blocked.json()["detail"].lower()

def test_upload_rate_limit_enforced(client):
    """F-BE-08: Upload rate limit."""
    _, token, _ = _create_authenticated_user_and_session(client)
    headers = {"Authorization": f"Bearer {token}", "X-Test-Rate-Limit": "true"}

    for _ in range(10):
        resp = client.post("/api/upload/text", json={"title": "Doc", "content": "Sample content"}, headers=headers)
        assert resp.status_code == 200

    blocked = client.post("/api/upload/text", json={"title": "Doc", "content": "Sample content"}, headers=headers)
    assert blocked.status_code == 429
    assert "too many upload requests" in blocked.json()["detail"].lower()
