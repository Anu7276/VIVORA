import pytest
from starlette.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from app.db.models import Session, Question, Answer, Evaluation, Report
from app.agents.report_agent import ReportAgent


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def adult_user(client):
    import datetime
    email = f"p5_user_{datetime.datetime.now(datetime.UTC).timestamp()}@example.com"
    resp = client.post("/api/auth/signup", json={
        "name": "Phase5 User",
        "email": email,
        "password": "Password123!",
        "date_of_birth": "1995-01-01"
    })
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    user_id = resp.json()["user_id"]
    return user_id, token


class TestPhase5ModesAndFeatures:

    def test_session_has_language_field_defaulting_to_en_in(self, client, adult_user):
        """
        Session model must store language (default 'en-IN'), configurable at session creation.
        """
        user_id, token = adult_user
        resp = client.post("/api/session/start", json={
            "mode": "school",
            "title": "Language Test",
            "content_text": "Q: What is force?\nAns: Mass times acceleration.",
            "language": "en-US"
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        sid = resp.json()["session_id"]

        db = SessionLocal()
        try:
            sess = db.query(Session).filter(Session.id == sid).first()
            assert sess is not None
            assert sess.language == "en-US"
        finally:
            db.close()

    def test_interview_communication_score_computed_server_side(self):
        """
        Interview mode report must compute a server-side communication score
        with breakdown metrics (filler words per 100 words, pace, length, structure).
        """
        agent = ReportAgent()
        evaluations = [
            {
                "order_no": 1,
                "question_text": "Describe your architectural approach to distributed caching.",
                "student_transcript": (
                    "Firstly, we isolate cache layers using Redis clusters with consistent hashing. "
                    "Secondly, because network latency is critical, we implement near-cache in memory. "
                    "For example, when read throughput exceeds 50,000 queries per second, cache stamps "
                    "are mitigated using mutex probabilistic early expiration."
                ),
                "duration_sec": 30,
                "filler_count": 1,
                "overall_score": 8.5,
                "topic": "Architecture",
                "scored": True
            },
            {
                "order_no": 2,
                "question_text": "How do you handle split-brain in distributed databases?",
                "student_transcript": (
                    "Um like basically we use Raft consensus. However, network partitions require quorum "
                    "so the minority partition refuses writes to prevent split-brain anomalies."
                ),
                "duration_sec": 20,
                "filler_count": 3,
                "overall_score": 7.5,
                "topic": "Databases",
                "scored": True
            }
        ]

        import asyncio
        report = asyncio.run(agent.generate_report(mode="interview", evaluations=evaluations))
        assert "communication_score" in report
        comm_score = report["communication_score"]
        assert isinstance(comm_score, (int, float))
        assert 0.0 <= comm_score <= 10.0
        assert "communication_breakdown" in report
        breakdown = report["communication_breakdown"]
        assert "filler_rate_per_100_words" in breakdown
        assert "speaking_pace_wpm" in breakdown
        assert "explanation" in breakdown

    def test_adaptive_difficulty_progression_logic(self):
        """
        Interview mode adapts question difficulty dynamically based on candidate scores:
        Score >= 8.0 promotes difficulty (easy -> medium -> hard).
        Score < 5.0 demotes difficulty (hard -> medium -> easy).
        """
        from app.services.adaptive_difficulty import get_next_difficulty

        # Promotion
        assert get_next_difficulty(current_difficulty="easy", score=8.5) == "medium"
        assert get_next_difficulty(current_difficulty="medium", score=9.0) == "hard"
        assert get_next_difficulty(current_difficulty="hard", score=9.5) == "hard"

        # Demotion
        assert get_next_difficulty(current_difficulty="hard", score=3.0) == "medium"
        assert get_next_difficulty(current_difficulty="medium", score=4.0) == "easy"
        assert get_next_difficulty(current_difficulty="easy", score=2.0) == "easy"

        # Maintain
        assert get_next_difficulty(current_difficulty="medium", score=6.5) == "medium"
