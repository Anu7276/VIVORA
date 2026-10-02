"""
Phase 3 Grading Integrity Tests
===============================
Reproduces bugs targeted in Phase 3:
1. Nonsense answer (e.g. 'banana banana ... 12 words') must NEVER receive a high score (must be < 4.0 or unscored).
2. Answer overall_score must be computed in code as a weighted mean of correctness, depth, and clarity, ignoring any LLM-provided overall_score.
3. Report overall_score must equal the exact arithmetic mean of stored answer scores computed in code, never from the LLM.
4. Provider failure in evaluation must result in scored=False and overall_score=None (unscored state), never default to numbers like 7.0/7.2 or canned strings.
5. In College/Interview mode, if question generation LLM fails, return HTTP 503 instead of silently returning canned templates with invented reference answers.
"""

import pytest
from unittest.mock import AsyncMock, patch
from starlette.testclient import TestClient

from app.main import app
from app.db.database import SessionLocal
from app.db.models import Session as SessionModel, Question, Answer, Evaluation, Report
from app.agents.evaluator_agent import EvaluatorAgent
from app.agents.report_agent import ReportAgent


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


class TestPhase3GradingIntegrity:
    @pytest.mark.anyio
    async def test_nonsense_answer_never_receives_high_score(self):
        """
        In the old SmartRuleFallbackProvider, 'word_count >= 12' gave 'banana banana ...'
        an 8.6 'Full Match'. In Phase 3, nonsense answers must never get a high score.
        """
        evaluator = EvaluatorAgent()
        # 12 repeated nonsense words
        nonsense_ans = "banana banana banana banana banana banana banana banana banana banana banana banana"
        result = await evaluator.evaluate_answer(
            tenant_id="test",
            question_text="Explain Newton's third law of motion.",
            answer_transcript=nonsense_ans,
            reference_answer="For every action, there is an equal and opposite reaction.",
            mode="school"
        )

        overall = result.get("overall_score")
        if overall is not None:
            assert overall < 4.0, f"Nonsense answer received high score: {overall}"
            assert result.get("concept_match") != "Full Match"

    @pytest.mark.anyio
    async def test_answer_overall_score_computed_in_code_weighted_mean(self):
        """
        Verify that overall_score is computed in code from correctness, depth, clarity
        and ignores any fabricated overall_score from the LLM.
        """
        evaluator = EvaluatorAgent()
        fake_llm_output = {
            "correctness_score": 8.0,
            "depth_score": 6.0,
            "clarity_score": 9.0,
            "overall_score": 2.0,  # Deliberately mismatched LLM value
            "feedback": "Detailed feedback",
            "missing_concepts": "None",
            "model_answer": "Model answer",
            "_provider": "mock",
            "_is_mock": False
        }

        with patch.object(evaluator.llm, "complete", new_callable=AsyncMock) as mock_complete:
            mock_complete.return_value = fake_llm_output
            result = await evaluator.evaluate_answer(
                tenant_id="test",
                question_text="What is Ohm's law?",
                answer_transcript="V equals I times R.",
                reference_answer="V = IR",
                mode="college"
            )

        # Expected weighted mean: 8.0*0.5 + 6.0*0.3 + 9.0*0.2 = 4.0 + 1.8 + 1.8 = 7.6
        expected_score = round(8.0 * 0.5 + 6.0 * 0.3 + 9.0 * 0.2, 1)
        assert result["overall_score"] == expected_score
        assert result["overall_score"] != 2.0  # Must NOT trust LLM overall_score

    @pytest.mark.anyio
    async def test_report_overall_score_is_exact_mean_of_scored_answers(self):
        """
        Report overall_score must be computed in code as the mean of scored answers,
        never taken from the LLM or hard-coded 8.2.
        """
        report_agent = ReportAgent()
        evaluations = [
            {"overall_score": 6.0, "scored": True, "_is_mock": False, "question_text": "Q1"},
            {"overall_score": 8.0, "scored": True, "_is_mock": False, "question_text": "Q2"},
            {"overall_score": 4.0, "scored": True, "_is_mock": False, "question_text": "Q3"}
        ]

        # LLM returns a completely different overall_score (e.g. 9.5 or 8.2)
        fake_llm_report = {
            "overall_score": 9.5,
            "strengths": ["Good communication"],
            "improvements": ["Work on formulas"],
            "revision_plan": ["Read chapter 3"]
        }

        with patch.object(report_agent.llm, "complete", new_callable=AsyncMock) as mock_complete:
            mock_complete.return_value = fake_llm_report
            report = await report_agent.generate_report(mode="school", evaluations=evaluations)

        # Arithmetic mean: (6.0 + 8.0 + 4.0) / 3 = 6.0
        assert report["overall_score"] == 6.0
        assert report["overall_score"] != 9.5

    @pytest.mark.anyio
    async def test_provider_failure_produces_unscored_state_not_numbers(self):
        """
        If all providers fail, evaluation must return scored=False and overall_score=None,
        never default to 7.0/7.2 or invented scores.
        """
        evaluator = EvaluatorAgent()
        with patch.object(evaluator.llm, "complete", side_effect=RuntimeError("All LLM providers unavailable")):
            result = await evaluator.evaluate_answer(
                tenant_id="test",
                question_text="What is cell division?",
                answer_transcript="Mitosis and meiosis.",
                reference_answer="Mitosis produces 2 cells.",
                mode="school"
            )

        assert result.get("scored") is False
        assert result.get("overall_score") is None
        assert "unavailable" in result.get("feedback", "").lower()

    @pytest.mark.anyio
    async def test_question_generation_failure_returns_503(self, client):
        """
        When question generation fails for College/Interview mode,
        must return HTTP 503 instead of falling back to fake template questions.
        """
        import time
        signup_resp = client.post("/api/auth/signup", json={
            "name": "Phase3 User",
            "email": f"phase3_qgen_{int(time.time()*1000)}@example.com",
            "password": "Password123!",
            "date_of_birth": "1999-01-01"
        })
        token = signup_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        with patch("app.agents.orchestrator.orchestrator.initialize_questions", side_effect=RuntimeError("LLM failure")):
            resp = client.post("/api/session/start", json={
                "mode": "college",
                "title": "Quantum Physics Viva",
                "time_limit_min": 15
            }, headers=headers)

            assert resp.status_code == 503
            assert "failed" in resp.json()["detail"].lower()
