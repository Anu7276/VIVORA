"""
test_degraded_mode.py
=====================
Tests that when all real LLM providers fail:
  - The router falls back to the mock provider.
  - The evaluator flags the result with _is_mock=True and _provider="mock".
  - The report agent labels the evaluation as not AI-scored.
  - scoring_note contains the degraded warning text.
  - mock_scored_count equals the number of failed evaluations.

No real API keys or network required — all external calls are mocked.
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import asyncio
from unittest.mock import AsyncMock, patch
import pytest

from app.llm.router import LLMRouter, SmartRuleFallbackProvider


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _make_router_all_fail() -> LLMRouter:
    """Build a router where every real provider raises, leaving only mock."""
    with (
        patch("app.llm.router.settings") as s,
        patch("app.llm.router._log_usage"),
    ):
        s.GEMINI_API_KEY = "fake-gemini"
        s.GROQ_API_KEY = "fake-groq"
        s.OPENAI_API_KEY = None
        s.QUESTION_GEN_PROVIDER = "gemini"
        s.LIVE_PROVIDER = "groq"
        s.EVALUATION_PROVIDER = "groq"
        s.REPORT_PROVIDER = "gemini"
        router = LLMRouter()

    # Make both real providers raise
    router._pool["groq"].generate_json = AsyncMock(side_effect=Exception("groq down"))
    router._pool["gemini"].generate_json = AsyncMock(side_effect=Exception("gemini down"))
    router._pool["groq"].generate_text = AsyncMock(side_effect=Exception("groq down"))
    router._pool["gemini"].generate_text = AsyncMock(side_effect=Exception("gemini down"))
    return router


# ─── 1. Router: _is_mock embedded in result dict ──────────────────────────────

class TestRouterMockFlag:
    def test_all_providers_fail_result_has_is_mock_true(self):
        router = _make_router_all_fail()
        result = asyncio.run(router.complete(
            task="evaluation",
            prompt=(
                "Student's Spoken Answer: \"Photosynthesis makes food.\"\n"
                "Reference Answer: \"Photosynthesis converts sunlight to glucose.\""
            ),
            system_prompt="You are an expert Viva Evaluator for school students.",
            as_json=True,
        ))
        assert result.get("_is_mock") is True, "Expected _is_mock=True when all providers fail"
        assert result.get("_provider") == "mock"

    def test_all_providers_fail_last_call_meta_is_mock(self):
        router = _make_router_all_fail()
        asyncio.run(router.complete(
            task="evaluation",
            prompt="Student's Spoken Answer: \"ok\" Reference Answer: \"good\"",
            system_prompt="You are an expert Viva Evaluator",
            as_json=True,
        ))
        assert router.last_call_meta is not None
        assert router.last_call_meta.is_mock is True
        assert router.last_call_meta.provider == "mock"

    def test_successful_real_provider_has_is_mock_false(self):
        with (
            patch("app.llm.router.settings") as s,
            patch("app.llm.router._log_usage"),
        ):
            s.GEMINI_API_KEY = "fake-gemini"
            s.GROQ_API_KEY = "fake-groq"
            s.OPENAI_API_KEY = None
            s.QUESTION_GEN_PROVIDER = "gemini"
            s.LIVE_PROVIDER = "groq"
            s.EVALUATION_PROVIDER = "groq"
            s.REPORT_PROVIDER = "gemini"
            router = LLMRouter()

        router._pool["groq"].generate_json = AsyncMock(return_value={
            "correctness_score": 8.0, "depth_score": 7.5, "clarity_score": 8.0,
            "overall_score": 7.9, "feedback": "good", "missing_concepts": "",
            "model_answer": "answer"
        })

        result = asyncio.run(router.complete(
            task="evaluation", prompt="test", as_json=True
        ))
        assert result.get("_is_mock") is False
        assert result.get("_provider") == "groq"


# ─── 2. Evaluator agent: _is_mock propagated from router result ───────────────

class TestEvaluatorMockFlag:
    def test_evaluator_flags_mock_when_all_providers_fail(self):
        """EvaluatorAgent.evaluate_answer returns _is_mock=True on provider failure."""
        from app.agents.evaluator_agent import EvaluatorAgent

        agent = EvaluatorAgent()
        router = _make_router_all_fail()
        agent.llm = router

        result = asyncio.run(agent.evaluate_answer(
            tenant_id="test-tenant",
            question_text="What is photosynthesis?",
            answer_transcript="Photosynthesis makes food using sunlight.",
            reference_answer="Photosynthesis converts sunlight, CO2 and water to glucose.",
            mode="school",
        ))

        assert result.get("_is_mock") is True, (
            f"Expected _is_mock=True, got: {result.get('_is_mock')}"
        )
        assert result.get("_provider") == "mock"
        assert "overall_score" in result
        assert result["overall_score"] > 0  # mock still produces a score

    def test_evaluator_is_mock_false_on_real_provider(self):
        from app.agents.evaluator_agent import EvaluatorAgent

        agent = EvaluatorAgent()
        with (
            patch("app.llm.router.settings") as s,
            patch("app.llm.router._log_usage"),
        ):
            s.GEMINI_API_KEY = None
            s.GROQ_API_KEY = "fake-groq"
            s.OPENAI_API_KEY = None
            s.EVALUATION_PROVIDER = "groq"
            s.LIVE_PROVIDER = "groq"
            s.QUESTION_GEN_PROVIDER = "groq"
            s.REPORT_PROVIDER = "groq"
            router = LLMRouter()

        router._pool["groq"].generate_json = AsyncMock(return_value={
            "correctness_score": 8.5, "depth_score": 8.0, "clarity_score": 8.0,
            "overall_score": 8.2, "feedback": "Well done!", "missing_concepts": "",
            "model_answer": "A detailed answer"
        })
        agent.llm = router

        result = asyncio.run(agent.evaluate_answer(
            tenant_id="t", question_text="Q?", answer_transcript="A",
            reference_answer="R", mode="school"
        ))
        assert result["_is_mock"] is False
        assert result["_provider"] == "groq"


# ─── 3. Report agent: labels evaluations and adds scoring_note ────────────────

class TestReportMockLabelling:
    def test_all_mock_evaluations_report_has_warning(self):
        from app.agents.report_agent import ReportAgent

        agent = ReportAgent()
        # Inject a mock router so report generation also uses mock
        router = _make_router_all_fail()
        agent.llm = router

        mock_evals = [
            {
                "question_text": "What is photosynthesis?",
                "topic": "Biology",
                "overall_score": 7.5,
                "feedback": "ok",
                "missing_concepts": "none",
                "_is_mock": True,
                "_provider": "mock",
            },
            {
                "question_text": "State Newton's first law.",
                "topic": "Physics",
                "overall_score": 6.5,
                "feedback": "fair",
                "missing_concepts": "example",
                "_is_mock": True,
                "_provider": "mock",
            },
        ]

        report = asyncio.run(agent.generate_report(mode="school", evaluations=mock_evals))

        assert report.get("mock_scored_count") == 2, (
            f"Expected mock_scored_count=2, got {report.get('mock_scored_count')}"
        )
        scoring_note = report.get("scoring_note", "")
        assert "rule-based" in scoring_note.lower() or "unavailable" in scoring_note.lower(), (
            f"Expected degraded warning in scoring_note, got: {scoring_note!r}"
        )

    def test_partial_mock_report_has_partial_warning(self):
        from app.agents.report_agent import ReportAgent

        agent = ReportAgent()
        router = _make_router_all_fail()
        agent.llm = router

        mixed_evals = [
            {
                "question_text": "Q1", "topic": "Bio", "overall_score": 8.0,
                "feedback": "great", "missing_concepts": "",
                "_is_mock": False, "_provider": "groq",
            },
            {
                "question_text": "Q2", "topic": "Phys", "overall_score": 6.0,
                "feedback": "ok", "missing_concepts": "more",
                "_is_mock": True, "_provider": "mock",
            },
        ]

        report = asyncio.run(agent.generate_report(mode="school", evaluations=mixed_evals))

        assert report.get("mock_scored_count") == 1
        scoring_note = report.get("scoring_note", "")
        assert "1 of 2" in scoring_note, (
            f"Expected '1 of 2' in partial warning, got: {scoring_note!r}"
        )

    def test_no_mock_evaluations_report_is_clean(self):
        from app.agents.report_agent import ReportAgent

        agent = ReportAgent()
        with (
            patch("app.llm.router.settings") as s,
            patch("app.llm.router._log_usage"),
        ):
            s.GEMINI_API_KEY = "fake"
            s.GROQ_API_KEY = None
            s.OPENAI_API_KEY = None
            s.REPORT_PROVIDER = "gemini"
            s.EVALUATION_PROVIDER = "gemini"
            s.LIVE_PROVIDER = "gemini"
            s.QUESTION_GEN_PROVIDER = "gemini"
            router = LLMRouter()
        router._pool["gemini"].generate_json = AsyncMock(return_value={
            "overall_score": 8.5, "strengths": ["clear"], "improvements": [],
            "revision_plan": [], "topic_scores": []
        })
        agent.llm = router

        ai_evals = [
            {
                "question_text": "Q1", "topic": "Bio", "overall_score": 8.5,
                "feedback": "great", "missing_concepts": "",
                "_is_mock": False, "_provider": "gemini",
            }
        ]

        report = asyncio.run(agent.generate_report(mode="school", evaluations=ai_evals))
        assert report.get("mock_scored_count") == 0
        assert "All evaluations AI-scored" in report.get("scoring_note", "")


# ─── 4. SmartRuleFallbackProvider: still returns valid rubric/report ──────────

class TestMockProviderOutputValidity:
    def test_mock_evaluation_has_all_required_fields(self):
        mock = SmartRuleFallbackProvider()
        result = asyncio.run(mock.generate_json(
            prompt=(
                "Student's Spoken Answer: \"Photosynthesis makes glucose.\"\n"
                "Reference Answer: \"Photosynthesis converts sunlight and CO2 to glucose.\""
            ),
            system_prompt="You are an expert Viva Evaluator for school students."
        ))
        required = {"correctness_score", "depth_score", "clarity_score",
                    "overall_score", "feedback", "missing_concepts", "model_answer"}
        missing = required - result.keys()
        assert not missing, f"Mock evaluation missing fields: {missing}"
        assert 0 <= result["overall_score"] <= 10

    def test_mock_report_has_scoring_fields(self):
        """Mock itself doesn't add mock_scored_count; that's the ReportAgent's job."""
        mock = SmartRuleFallbackProvider()
        result = asyncio.run(mock.generate_json(
            prompt="{}",
            system_prompt="You are a Report Generator Agent for VIVORA."
        ))
        assert "overall_score" in result
        assert "strengths" in result
        assert isinstance(result["revision_plan"], list)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
