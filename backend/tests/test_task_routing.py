"""
test_task_routing.py
====================
Tests that:
  1. Each task is dispatched to the correct provider (routing table respected).
  2. On provider failure the router falls back to the next provider.
  3. On 429 rate-limit the router retries once with back-off, then falls back.
  4. The mock (SmartRuleFallbackProvider) is the final safety net and always succeeds.
  5. Usage logs record the correct provider and fallback flag.

All external HTTP calls are mocked — no real API keys required.
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from app.llm.router import (
    LLMRouter,
    GeminiProvider,
    GroqProvider,
    OpenAIProvider,
    SmartRuleFallbackProvider,
    TASK_PROVIDER_MAP,
)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _make_router(gemini_key="test-gemini", groq_key="test-groq") -> LLMRouter:
    """Build a fresh LLMRouter with fake API keys so all provider slots are filled."""
    with (
        patch("app.llm.router.settings") as mock_settings,
        patch("app.llm.router.TASK_PROVIDER_MAP", {
            "question_generation": "gemini",
            "live_turn": "groq",
            "evaluation": "groq",
            "report": "gemini",
        }),
        patch("app.llm.router._log_usage"),   # silence DB writes
    ):
        mock_settings.GEMINI_API_KEY = gemini_key
        mock_settings.GROQ_API_KEY = groq_key
        mock_settings.OPENAI_API_KEY = None
        mock_settings.QUESTION_GEN_PROVIDER = "gemini"
        mock_settings.LIVE_PROVIDER = "groq"
        mock_settings.EVALUATION_PROVIDER = "groq"
        mock_settings.REPORT_PROVIDER = "gemini"
        # Model name fields required by the updated providers
        mock_settings.GEMINI_MODEL = "gemini-2.5-flash"
        mock_settings.GROQ_MODEL = "llama-3.1-8b-instant"
        mock_settings.OPENAI_MODEL = "gpt-4o-mini"
        router = LLMRouter()
    return router


# ─── 1. Routing table: each task hits the right provider ──────────────────────

class TestTaskRouting:
    """Each task must resolve to the configured provider."""

    def test_question_generation_routes_to_gemini(self):
        router = _make_router()
        provider = router._provider_for_task("question_generation")
        assert provider.name == "gemini", (
            f"question_generation should route to gemini, got {provider.name}"
        )

    def test_live_turn_routes_to_groq(self):
        router = _make_router()
        provider = router._provider_for_task("live_turn")
        assert provider.name == "groq"

    def test_evaluation_routes_to_groq(self):
        router = _make_router()
        provider = router._provider_for_task("evaluation")
        assert provider.name == "groq"

    def test_report_routes_to_gemini(self):
        router = _make_router()
        provider = router._provider_for_task("report")
        assert provider.name == "gemini"

    def test_unknown_task_falls_back_to_mock(self):
        router = _make_router()
        provider = router._provider_for_task("nonexistent_task")
        assert provider.name == "mock"


# ─── 2. Provider execute: task calls the right provider's method ──────────────

class TestProviderDispatch:
    """The complete() call must invoke the primary provider's generate method."""

    def test_evaluation_calls_groq(self):
        router = _make_router()

        groq_mock = AsyncMock(return_value={"correctness_score": 8.5, "depth_score": 7.0,
                                            "clarity_score": 8.0, "overall_score": 8.0,
                                            "feedback": "Good", "missing_concepts": "",
                                            "model_answer": "ok"})
        router._pool["groq"].generate_json = groq_mock

        result = asyncio.run(router.complete(
            task="evaluation",
            prompt="test prompt",
            system_prompt="You are an evaluator.",
            as_json=True,
        ))

        groq_mock.assert_called_once()
        assert result["overall_score"] == 8.0

    def test_question_generation_calls_gemini(self):
        router = _make_router()

        gemini_mock = AsyncMock(return_value={"questions": [
            {"question_text": "What is gravity?", "topic": "Physics",
             "difficulty": "easy", "reference_answer": "A force."}
        ]})
        router._pool["gemini"].generate_json = gemini_mock

        result = asyncio.run(router.complete(
            task="question_generation",
            prompt="generate questions",
            as_json=True,
        ))

        gemini_mock.assert_called_once()
        assert len(result["questions"]) == 1

    def test_report_calls_gemini(self):
        router = _make_router()
        gemini_mock = AsyncMock(return_value={"overall_score": 7.5, "strengths": [],
                                              "improvements": [], "revision_plan": [],
                                              "topic_scores": []})
        router._pool["gemini"].generate_json = gemini_mock

        asyncio.run(router.complete(
            task="report",
            prompt="generate report",
            as_json=True,
        ))
        gemini_mock.assert_called_once()

    def test_live_turn_calls_groq(self):
        router = _make_router()
        groq_mock = AsyncMock(return_value="Why does osmosis work?")
        router._pool["groq"].generate_text = groq_mock

        asyncio.run(router.complete(
            task="live_turn",
            prompt="generate followup",
            as_json=False,
        ))
        groq_mock.assert_called_once()


# ─── 3. Fallback: primary fails → next provider used ─────────────────────────

class TestFallback:
    """When the primary provider raises, the router must transparently fall back."""

    def test_primary_failure_falls_back_to_other_provider(self):
        router = _make_router()

        # Groq (primary for evaluation) raises an error
        router._pool["groq"].generate_json = AsyncMock(
            side_effect=Exception("connection error")
        )
        # Gemini is in the fallback chain and should succeed
        router._pool["gemini"].generate_json = AsyncMock(return_value={
            "correctness_score": 6.0, "depth_score": 6.0, "clarity_score": 6.0,
            "overall_score": 6.0, "feedback": "fallback ok", "missing_concepts": "",
            "model_answer": "fallback answer"
        })

        result = asyncio.run(router.complete(
            task="evaluation",
            prompt="test fallback",
            as_json=True,
        ))

        assert result["overall_score"] == 6.0
        router._pool["groq"].generate_json.assert_called_once()
        router._pool["gemini"].generate_json.assert_called_once()

    def test_all_real_providers_fail_falls_back_to_mock(self):
        router = _make_router()

        # Both real providers fail
        router._pool["groq"].generate_json = AsyncMock(
            side_effect=Exception("groq down")
        )
        router._pool["gemini"].generate_json = AsyncMock(
            side_effect=Exception("gemini down")
        )

        # Mock should still work
        result = asyncio.run(router.complete(
            task="evaluation",
            prompt='Student\'s Spoken Answer: "Photosynthesis converts sunlight to glucose." '
                   'Reference Answer: "Photosynthesis is the conversion of sunlight to glucose."',
            system_prompt="You are an expert Viva Evaluator",
            as_json=True,
        ))

        # SmartRuleFallbackProvider returns sensible scores
        assert "overall_score" in result
        assert result["overall_score"] > 0


# ─── 4. Rate-limit (429): retry once then fall back ──────────────────────────

class TestRateLimitHandling:
    """429 errors should trigger a back-off retry, and on second 429 fall back."""

    def test_429_retries_then_falls_back(self):
        import httpx

        router = _make_router()

        # Build a fake 429 response
        fake_429 = httpx.Response(status_code=429, request=MagicMock())

        call_count = {"n": 0}

        async def always_429(prompt, system_prompt=None):
            call_count["n"] += 1
            raise httpx.HTTPStatusError("rate limited", request=MagicMock(), response=fake_429)

        router._pool["groq"].generate_json = always_429
        # Gemini fallback succeeds
        router._pool["gemini"].generate_json = AsyncMock(return_value={
            "correctness_score": 5.0, "depth_score": 5.0, "clarity_score": 5.0,
            "overall_score": 5.0, "feedback": "after 429 fallback", "missing_concepts": "",
            "model_answer": "ok"
        })

        # Speed up the backoff sleep
        with patch("app.llm.router.asyncio.sleep", new_callable=AsyncMock):
            result = asyncio.run(router.complete(
                task="evaluation",
                prompt="test 429",
                as_json=True,
            ))

        # Groq was called twice (initial + 1 retry on 429)
        assert call_count["n"] == 2
        # Gemini took over
        assert result["overall_score"] == 5.0

    def test_transient_429_then_success_stays_on_primary(self):
        import httpx

        router = _make_router()
        fake_429 = httpx.Response(status_code=429, request=MagicMock())
        attempt = {"n": 0}

        async def fail_once_then_succeed(prompt, system_prompt=None):
            attempt["n"] += 1
            if attempt["n"] == 1:
                raise httpx.HTTPStatusError("rate limited", request=MagicMock(), response=fake_429)
            return {"overall_score": 9.0, "correctness_score": 9.0, "depth_score": 9.0,
                    "clarity_score": 9.0, "feedback": "great", "missing_concepts": "",
                    "model_answer": "perfect"}

        router._pool["groq"].generate_json = fail_once_then_succeed

        with patch("app.llm.router.asyncio.sleep", new_callable=AsyncMock):
            result = asyncio.run(router.complete(
                task="evaluation",
                prompt="test transient 429",
                as_json=True,
            ))

        # Should have retried once and succeeded — stayed on Groq
        assert attempt["n"] == 2
        assert result["overall_score"] == 9.0


# ─── 5. Mock is the final safety net ─────────────────────────────────────────

class TestMockSafetyNet:
    """SmartRuleFallbackProvider should always return valid structured output."""

    def test_mock_evaluation_returns_valid_rubric(self):
        mock = SmartRuleFallbackProvider()
        result = asyncio.run(mock.generate_json(
            prompt='Student\'s Spoken Answer: "Photosynthesis makes food." '
                   'Reference Answer: "Photosynthesis converts sunlight to glucose."',
            system_prompt="You are an expert Viva Evaluator for school students."
        ))
        assert "overall_score" in result
        assert 0 <= result["overall_score"] <= 10

    def test_mock_report_returns_valid_structure(self):
        mock = SmartRuleFallbackProvider()
        result = asyncio.run(mock.generate_json(
            prompt='{"overall_score": 0}',
            system_prompt="You are a Report Generator Agent for VIVORA."
        ))
        assert "strengths" in result
        assert "revision_plan" in result
        assert isinstance(result["strengths"], list)

    def test_mock_question_generation_returns_questions(self):
        mock = SmartRuleFallbackProvider()
        result = asyncio.run(mock.generate_json(
            prompt="generate questions for topic",
            system_prompt="You are a Question generation agent."
        ))
        assert "questions" in result
        assert len(result["questions"]) >= 1


# ─── 6. Integration: full pipeline still passes with mock routing ─────────────

class TestLegacyCompatibility:
    """generate_text / generate_json legacy helpers must still work."""

    def test_generate_text_legacy_helper(self):
        router = _make_router()
        router._pool["groq"].generate_text = AsyncMock(return_value="Hello, student!")

        result = asyncio.run(router.generate_text("say hello"))
        assert result == "Hello, student!"

    def test_generate_json_legacy_helper(self):
        router = _make_router()
        router._pool["groq"].generate_json = AsyncMock(
            return_value={"overall_score": 7.0}
        )
        result = asyncio.run(router.generate_json("score this"))
        assert result["overall_score"] == 7.0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
