"""
router.py — Per-Task LLM Router with degraded-mode signalling
=============================================================
Agents call:
    result = await llm_router.complete(task="evaluation", prompt="...", as_json=True)

The router:
  1. Resolves the preferred provider for the task from config.
  2. Tries the preferred provider.
  3. On 429 (rate-limit): backs off 1.5 s and retries once.
  4. On any other failure: falls back to the next available provider.
  5. Final safety net: SmartRuleFallbackProvider (always succeeds, zero cost).
  6. Logs every call to DB (task, provider, latency, is_fallback).
  7. Embeds `_provider` and `_is_mock` in the returned dict (JSON calls) or
     as metadata accessible via `llm_router.last_call_meta` so callers can
     emit a `degraded_mode` WebSocket event and flag mock-scored evaluations.
"""

import asyncio
import json
import logging
import re
import time
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Literal, Optional

import httpx

from app.core.config import settings
from app.llm.guardrails import Guardrails

logger = logging.getLogger("vivora.llm")

# ─── Task type ────────────────────────────────────────────────────────────────
LLMTask = Literal["question_generation", "live_turn", "evaluation", "report"]

# ─── Task → provider name (from config) ──────────────────────────────────────
TASK_PROVIDER_MAP: Dict[str, str] = {
    "question_generation": settings.QUESTION_GEN_PROVIDER,
    "live_turn":           settings.LIVE_PROVIDER,
    "evaluation":          settings.EVALUATION_PROVIDER,
    "report":              settings.REPORT_PROVIDER,
}


# ─── Abstract base ────────────────────────────────────────────────────────────
class LLMProvider(ABC):
    name: str = "base"

    @abstractmethod
    async def generate_text(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        pass

    @abstractmethod
    async def generate_json(self, prompt: str, system_prompt: Optional[str] = None) -> Dict[str, Any]:
        pass


# ─── Gemini ───────────────────────────────────────────────────────────────────
class GeminiProvider(LLMProvider):
    name = "gemini"

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.model = "gemini-1.5-flash"
        self.base_url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model}:generateContent?key={self.api_key}"
        )

    async def generate_text(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        prompt = Guardrails.sanitize_input(prompt)
        full_text = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
        payload = {"contents": [{"parts": [{"text": full_text}]}]}
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(self.base_url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]

    async def generate_json(self, prompt: str, system_prompt: Optional[str] = None) -> Dict[str, Any]:
        text = await self.generate_text(prompt, system_prompt)
        return _extract_json_from_text(text)


# ─── Groq ─────────────────────────────────────────────────────────────────────
class GroqProvider(LLMProvider):
    name = "groq"

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.groq.com/openai/v1/chat/completions"
        self.model = "llama-3.1-8b-instant"

    async def generate_text(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        prompt = Guardrails.sanitize_input(prompt)
        messages: List[Dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                self.base_url, headers=headers,
                json={"model": self.model, "messages": messages},
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]

    async def generate_json(self, prompt: str, system_prompt: Optional[str] = None) -> Dict[str, Any]:
        text = await self.generate_text(prompt, system_prompt)
        return _extract_json_from_text(text)


# ─── OpenAI ───────────────────────────────────────────────────────────────────
class OpenAIProvider(LLMProvider):
    name = "openai"

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.openai.com/v1/chat/completions"
        self.model = "gpt-4o-mini"

    async def generate_text(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        prompt = Guardrails.sanitize_input(prompt)
        messages: List[Dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                self.base_url, headers=headers,
                json={"model": self.model, "messages": messages},
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]

    async def generate_json(self, prompt: str, system_prompt: Optional[str] = None) -> Dict[str, Any]:
        text = await self.generate_text(prompt, system_prompt)
        return _extract_json_from_text(text)


# ─── SmartRuleFallbackProvider (mock) ────────────────────────────────────────
class SmartRuleFallbackProvider(LLMProvider):
    """
    Zero-external-cost rule-based fallback.
    Returns deterministic, plausible outputs for every task type.
    NOTE: Outputs from this provider are flagged as NOT AI-scored.
    """
    name = "mock"

    async def generate_text(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        if "Interviewer" in (system_prompt or ""):
            return "Let's move on to the next question. Please speak clearly whenever you are ready."
        return "Good explanation. Let us proceed with the next concept."

    async def generate_json(self, prompt: str, system_prompt: Optional[str] = None) -> Dict[str, Any]:
        # Evaluation rubric
        if "Evaluator" in (system_prompt or "") or "correctness_score" in prompt:
            ans_match = re.search(r"Student's Spoken Answer.*?:\s*\"(.*?)\"", prompt, re.DOTALL)
            ref_match = re.search(r"Reference Answer.*?:\s*\"(.*?)\"", prompt, re.DOTALL)
            student_ans = (ans_match.group(1) if ans_match else "").lower()
            ref_ans = (ref_match.group(1) if ref_match else "").lower()
            words_ans = set(re.findall(r"\b\w{3,}\b", student_ans))
            words_ref = set(re.findall(r"\b\w{3,}\b", ref_ans))
            common = words_ans & words_ref
            ratio = len(common) / max(len(words_ref), 1) if words_ref else 0.5
            word_count = len(student_ans.split())
            if word_count < 3:
                correctness, depth, clarity = 2.0, 2.0, 4.0
                feedback = "Answer was too brief. Try to explain the concept in full sentences."
                missing = "Key definitions and explanations were missing."
            elif ratio > 0.4 or word_count > 15:
                correctness = min(9.5, 7.5 + ratio * 2.5)
                depth = min(9.0, 7.0 + (word_count / 30.0) * 2.0)
                clarity = 8.5
                feedback = "Well explained! You captured the main core concept accurately."
                missing = "Minor details on specific terms could be expanded."
            else:
                correctness = min(7.0, 4.5 + ratio * 3.0)
                depth, clarity = 5.5, 7.0
                feedback = "Fair attempt, but needed more key technical terms and thoroughness."
                missing = "Expected specific keywords matching the textbook definition."
            overall = round(correctness * 0.5 + depth * 0.3 + clarity * 0.2, 1)
            model_ans = (
                ref_match.group(1)
                if ref_match and len(ref_match.group(1)) > 5
                else "The complete textbook definition explaining principles, causes, and effects."
            )
            return {
                "correctness_score": round(correctness, 1),
                "depth_score": round(depth, 1),
                "clarity_score": round(clarity, 1),
                "overall_score": overall,
                "feedback": feedback,
                "missing_concepts": missing,
                "model_answer": model_ans,
            }

        # Report generation
        if "Report" in (system_prompt or "") or "overall_score" in prompt:
            return {
                "overall_score": 8.2,
                "strengths": [
                    "Solid grasp of fundamental scientific definitions",
                    "Clear voice delivery and concise answers",
                    "Good confidence on direct conceptual questions",
                ],
                "improvements": [
                    "Include more real-world examples in your answers",
                    "Elaborate on secondary mechanisms and formulas",
                ],
                "revision_plan": [
                    "Review textbook summaries for missed concepts",
                    "Practice answering why/how follow-up viva questions aloud",
                    "Create flashcards for key scientific terminology",
                ],
                "topic_scores": [
                    {"topic": "Fundamentals", "score": 8.5, "level": "strong"},
                    {"topic": "Applications & Mechanisms", "score": 7.5, "level": "average"},
                ],
            }

        # Question generation
        if "Question" in (system_prompt or ""):
            return {
                "questions": [
                    {
                        "question_text": "What is the primary function of photosynthesis in green plants?",
                        "topic": "Biology",
                        "difficulty": "easy",
                        "reference_answer": "Photosynthesis converts sunlight, water, and carbon dioxide into glucose and oxygen using chlorophyll.",
                    },
                    {
                        "question_text": "State Newton's First Law of Motion with an example.",
                        "topic": "Physics",
                        "difficulty": "easy",
                        "reference_answer": "An object remains at rest or in uniform motion unless acted upon by an external unbalanced force.",
                    },
                    {
                        "question_text": "What is the difference between an element and a compound?",
                        "topic": "Chemistry",
                        "difficulty": "medium",
                        "reference_answer": "An element consists of only one type of atom, whereas a compound consists of two or more chemically combined elements in fixed ratio.",
                    },
                ]
            }

        # Intake extraction fallback
        return {"topics": ["General Science", "Core Concepts"], "questions": []}


# ─── JSON extraction helper ───────────────────────────────────────────────────
def _extract_json_from_text(text: str) -> Dict[str, Any]:
    try:
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
        if match:
            return json.loads(match.group(1))
        return json.loads(text.strip())
    except Exception as e:
        logger.warning(f"Direct JSON parse failed: {e}. Attempting brace extraction.")
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end != -1:
            return json.loads(text[start: end + 1])
        raise ValueError(f"Could not extract JSON from LLM response: {text[:200]}")


# ─── Usage log helper (fire-and-forget, never raises) ────────────────────────
def _log_usage(
    task: str,
    provider: str,
    latency_ms: int,
    is_fallback: bool,
    success: bool,
    prompt_len: int,
    session_id: Optional[str],
    error_type: Optional[str],
) -> None:
    try:
        from app.db.database import SessionLocal
        from app.db.models import LLMUsageLog

        db = SessionLocal()
        try:
            db.add(LLMUsageLog(
                session_id=session_id,
                task=task,
                provider=provider,
                is_fallback=is_fallback,
                prompt_tokens=prompt_len,
                latency_ms=latency_ms,
                success=success,
                error_type=error_type,
            ))
            db.commit()
        finally:
            db.close()
    except Exception as exc:
        logger.debug(f"Usage log write failed (non-critical): {exc}")


# ─── Call metadata (per-call result, used by callers to emit WS events) ──────
class CallMeta:
    """Attached to each complete() result so callers can inspect provider details."""
    __slots__ = ("provider", "is_mock", "task")

    def __init__(self, provider: str, is_mock: bool, task: str):
        self.provider = provider
        self.is_mock = is_mock
        self.task = task


# ─── Main router ──────────────────────────────────────────────────────────────
class LLMRouter:
    """
    Per-task LLM router with automatic fallback and degraded-mode signalling.

    Usage in agents:
        result = await llm_router.complete(task="evaluation", prompt="...", as_json=True)

    After the call:
        meta = llm_router.last_call_meta   # CallMeta(provider, is_mock, task)
        if meta.is_mock:
            # emit degraded_mode WebSocket event
    """

    def __init__(self) -> None:
        self._pool: Dict[str, LLMProvider] = {}
        if settings.GEMINI_API_KEY:
            self._pool["gemini"] = GeminiProvider(settings.GEMINI_API_KEY)
        if settings.GROQ_API_KEY:
            self._pool["groq"] = GroqProvider(settings.GROQ_API_KEY)
        if settings.OPENAI_API_KEY:
            self._pool["openai"] = OpenAIProvider(settings.OPENAI_API_KEY)
        self._pool["mock"] = SmartRuleFallbackProvider()

        self.last_call_meta: Optional[CallMeta] = None

        available = list(self._pool.keys())
        logger.info(f"LLMRouter initialised. Available providers: {available}")
        logger.info(
            f"Task routing — question_generation:{settings.QUESTION_GEN_PROVIDER} | "
            f"live_turn:{settings.LIVE_PROVIDER} | "
            f"evaluation:{settings.EVALUATION_PROVIDER} | "
            f"report:{settings.REPORT_PROVIDER}"
        )

    def _provider_for_task(self, task: str) -> LLMProvider:
        preferred = TASK_PROVIDER_MAP.get(task, "mock")
        return self._pool.get(preferred) or self._pool["mock"]

    def _fallback_chain(self, task: str) -> List[LLMProvider]:
        primary_name = TASK_PROVIDER_MAP.get(task, "mock")
        chain: List[LLMProvider] = []
        for name, prov in self._pool.items():
            if name != primary_name and name != "mock":
                chain.append(prov)
        chain.append(self._pool["mock"])
        return chain

    async def _call_with_retry(
        self,
        provider: LLMProvider,
        prompt: str,
        system_prompt: Optional[str],
        as_json: bool,
    ) -> Any:
        """Call once; on 429 back off 1.5 s and retry once."""
        for attempt in range(2):
            try:
                if as_json:
                    return await provider.generate_json(prompt, system_prompt)
                else:
                    return await provider.generate_text(prompt, system_prompt)
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code == 429:
                    if attempt == 0:
                        wait = 1.5
                        logger.warning(
                            f"[{provider.name}] 429 rate-limited — backing off {wait}s before retry"
                        )
                        await asyncio.sleep(wait)
                        continue
                    logger.warning(f"[{provider.name}] 429 persists after retry — falling back")
                raise

    async def complete(
        self,
        task: str,
        prompt: str,
        system_prompt: Optional[str] = None,
        as_json: bool = False,
        session_id: Optional[str] = None,
    ) -> Any:
        """
        Main entry point for all agent LLM calls.

        Sets `self.last_call_meta` so callers can check whether the response
        came from the mock provider and emit appropriate WebSocket signals.
        """
        primary = self._provider_for_task(task)
        fallbacks = self._fallback_chain(task)
        is_fallback = False

        for provider in [primary] + fallbacks:
            t0 = time.monotonic()
            error_type: Optional[str] = None
            try:
                result = await self._call_with_retry(provider, prompt, system_prompt, as_json)
                latency_ms = int((time.monotonic() - t0) * 1000)
                is_mock = provider.name == "mock"
                logger.info(
                    f"[LLM] task={task} provider={provider.name} "
                    f"fallback={is_fallback} mock={is_mock} latency={latency_ms}ms ✓"
                )
                _log_usage(
                    task=task, provider=provider.name, latency_ms=latency_ms,
                    is_fallback=is_fallback, success=True, prompt_len=len(prompt),
                    session_id=session_id, error_type=None,
                )
                # Store per-call metadata for callers
                self.last_call_meta = CallMeta(
                    provider=provider.name, is_mock=is_mock, task=task
                )
                # Embed provider/mock flag directly into JSON results for traceability
                if isinstance(result, dict):
                    result["_provider"] = provider.name
                    result["_is_mock"] = is_mock
                return result

            except httpx.HTTPStatusError as exc:
                latency_ms = int((time.monotonic() - t0) * 1000)
                error_type = "rate_limit" if exc.response.status_code == 429 else "api_error"
                logger.warning(
                    f"[LLM] task={task} provider={provider.name} HTTP {exc.response.status_code} — next"
                )
            except httpx.TimeoutException:
                latency_ms = int((time.monotonic() - t0) * 1000)
                error_type = "timeout"
                logger.warning(f"[LLM] task={task} provider={provider.name} timeout — next")
            except Exception as exc:
                latency_ms = int((time.monotonic() - t0) * 1000)
                error_type = "api_error"
                logger.warning(f"[LLM] task={task} provider={provider.name} error: {exc} — next")

            _log_usage(
                task=task, provider=provider.name, latency_ms=latency_ms,
                is_fallback=is_fallback, success=False, prompt_len=len(prompt),
                session_id=session_id, error_type=error_type,
            )
            is_fallback = True

        raise RuntimeError(f"All providers exhausted for task '{task}'")

    # ── Legacy helpers ────────────────────────────────────────────────────────
    async def generate_text(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        return await self.complete(task="live_turn", prompt=prompt, system_prompt=system_prompt)

    async def generate_json(self, prompt: str, system_prompt: Optional[str] = None) -> Dict[str, Any]:
        return await self.complete(task="evaluation", prompt=prompt, system_prompt=system_prompt, as_json=True)


# Global singleton
llm_router = LLMRouter()
