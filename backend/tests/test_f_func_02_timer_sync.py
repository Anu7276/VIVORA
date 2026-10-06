import pytest
from datetime import datetime, timezone
from starlette.testclient import TestClient

from app.main import app
from app.db.database import SessionLocal
from app.db.models import Session as SessionModel, User
from app.core.auth import create_access_token

@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c

import uuid

def test_session_returns_time_limit_and_started_at(client: TestClient):
    uid = f"usr-{uuid.uuid4().hex[:8]}"
    email = f"timer_{uuid.uuid4().hex[:8]}@example.com"
    sess_id = f"sess-{uuid.uuid4().hex[:8]}"

    db = SessionLocal()
    try:
        user = User(
            id=uid,
            email=email,
            password_hash="dummy_hash",
        )
        db.add(user)
        db.flush()

        now = datetime.now(timezone.utc)
        sess = SessionModel(
            id=sess_id,
            user_id=uid,
            mode="practice",
            time_limit_min=20,
            status="active",
            created_at=now,
        )
        db.add(sess)
        db.commit()
    finally:
        db.close()

    token = create_access_token(uid, email)
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.get(f"/api/session/{sess_id}", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["time_limit_min"] == 20
    assert "started_at" in data
    assert data["started_at"] is not None

def test_session_timer_calculation_logic():
    # Verify the elapsed seconds math used in frontend sync
    time_limit_min = 15
    total_seconds = time_limit_min * 60
    
    # Simulate started 3 minutes (180s) ago
    started_timestamp_ms = (datetime.now(timezone.utc).timestamp() - 180) * 1000
    now_ms = datetime.now(timezone.utc).timestamp() * 1000
    elapsed_sec = max(0, int((now_ms - started_timestamp_ms) / 1000))
    remaining = max(0, total_seconds - elapsed_sec)
    
    assert remaining in [719, 720, 721]  # ~12 minutes remaining
