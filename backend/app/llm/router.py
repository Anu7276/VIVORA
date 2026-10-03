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
import sys
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
        self.model = settings.GEMINI_MODEL
        # Key goes in the request header, NEVER in the URL query string.
        self.base_url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model}:generateContent"
        )

    async def generate_text(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        prompt = Guardrails.sanitize_input(prompt)
        full_text = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
        payload = {"contents": [{"parts": [{"text": full_text}]}]}
        headers = {"x-goog-api-key": self.api_key, "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(self.base_url, headers=headers, json=payload)
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
        self.model = settings.GROQ_MODEL

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
        prompt = Guardrails.sanitize_input(prompt)
        messages: List[Dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                self.base_url, headers=headers,
                json={
                    "model": self.model,
                    "messages": messages,
                    "response_format": {"type": "json_object"}
                },
            )
            resp.raise_for_status()
            text = resp.json()["choices"][0]["message"]["content"]
            return _extract_json_from_text(text)


# ─── OpenAI ───────────────────────────────────────────────────────────────────
class OpenAIProvider(LLMProvider):
    name = "openai"

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.openai.com/v1/chat/completions"
        self.model = settings.OPENAI_MODEL

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
            if "<student_answer>" in prompt:
                tag_ans = re.search(r"<student_answer>\s*(.*?)\s*</student_answer>", prompt, re.DOTALL)
                student_ans = (tag_ans.group(1) if tag_ans else "").lower()
            else:
                ans_match = re.search(r"Student's Spoken Answer.*?:\s*\"(.*?)\"", prompt, re.DOTALL)
                student_ans = (ans_match.group(1) if ans_match else "").lower()

            if "<reference_answer>" in prompt:
                tag_ref = re.search(r"<reference_answer>\s*(.*?)\s*</reference_answer>", prompt, re.DOTALL)
                ref_ans = (tag_ref.group(1) if tag_ref else "").lower()
                clean_ref = (tag_ref.group(1) if tag_ref else "").strip()
            else:
                ref_match = re.search(r"Reference Answer.*?:\s*\"(.*?)\"", prompt, re.DOTALL)
                ref_ans = (ref_match.group(1) if ref_match else "").lower()
                clean_ref = (ref_match.group(1) if ref_match else "").strip()

            stop_words = {
                "the", "is", "a", "an", "and", "or", "in", "on", "at", "to", "for", "with",
                "by", "from", "of", "it", "that", "this", "these", "those", "are", "was",
                "were", "be", "been", "being", "have", "has", "had", "do", "does", "did",
                "can", "could", "will", "would", "should", "you", "your", "they", "their",
                "we", "our", "as", "into"
            }
            synonyms = {
                "make": "produce", "makes": "produce", "making": "produce", "prepare": "produce", "prepares": "produce",
                "synthesize": "produce", "synthesizes": "produce", "create": "produce", "creates": "produce",
                "sun": "sunlight", "solar": "sunlight",
                "co2": "carbon", "dioxide": "carbon",
                "water": "water", "h2o": "water",
                "food": "glucose", "sugar": "glucose",
                "chlorophyll": "chloroplast", "chloroplasts": "chloroplast",
                "speed": "velocity", "rate": "velocity",
                "reaction": "action", "force": "action", "push": "action", "pull": "action",
                "opposite": "reverse", "equal": "same", "identical": "same",
                "acid": "acidic", "acids": "acidic", "base": "basic", "bases": "basic", "alkali": "basic",
                "plant": "plants", "cell": "cells",
            }

            def canonicalize(text: str) -> set:
                raw = re.findall(r"\b[a-z]{3,}\b", text)
                clean = set()
                for w in raw:
                    if w not in stop_words:
                        clean.add(synonyms.get(w, w))
                return clean

            words_ans = canonicalize(student_ans)
            words_ref = canonicalize(ref_ans)
            common = words_ans & words_ref
            ratio = len(common) / max(len(words_ref), 1) if words_ref else 0.5
            word_count = len(student_ans.split())
            is_school = "school" in prompt.lower() or "school" in (system_prompt or "").lower()

            if word_count < 3:
                correctness, depth, clarity = 2.0, 2.0, 4.0
                is_correct = False
                concept_match = "Needs Review"
                feedback = "Answer was too brief. Try to explain the concept in your own words."
                missing = "Core definitions and explanations were missing."
            elif len(common) == 0:
                # No overlapping conceptual words at all — nonsense or off-topic answer
                correctness, depth, clarity = 1.0, 1.0, 2.0
                is_correct = False
                concept_match = "Needs Review"
                feedback = "Your answer did not match the question topic or reference concepts."
                missing = "Core principles from the reference answer."
            elif ratio >= 0.4 or (is_school and ratio >= 0.3):
                correctness = min(9.5, 7.5 + ratio * 2.0)
                depth = min(9.0, 7.0 + min(1.5, word_count / 30.0))
                clarity = 8.5
                is_correct = True
                concept_match = "Full Match"
                feedback = "Good explanation of the core concept."
                missing = "" if ratio > 0.6 else "Minor details could be expanded."
            elif ratio >= 0.2:
                correctness = min(7.5, 5.5 + ratio * 3.0)
                depth, clarity = 6.0, 7.0
                is_correct = True
                concept_match = "Partial Match"
                feedback = "Partial understanding shown; some key points can be added."
                missing = "Some key technical terms from the definition."
            else:
                correctness = min(4.0, 2.0 + ratio * 3.0)
                depth, clarity = 3.5, 5.0
                is_correct = False
                concept_match = "Needs Review"
                feedback = "Needs review. Your answer did not convey the core meaning expected for this question."
                missing = "Core scientific concepts from the reference answer."

            overall = round(correctness * 0.5 + depth * 0.3 + clarity * 0.2, 1)
            model_ans = (
                clean_ref
                if clean_ref and len(clean_ref) > 5
                else "The complete textbook definition explaining principles, causes, and effects."
            )
            return {
                "is_correct": is_correct,
                "concept_match": concept_match,
                "correctness_score": round(correctness, 1),
                "depth_score": round(depth, 1),
                "clarity_score": round(clarity, 1),
                "overall_score": overall,
                "feedback": feedback,
                "missing_concepts": missing,
                "model_answer": model_ans,
            }

        # Report generation
        if "Report" in (system_prompt or "") or ("overall_score" in prompt and "correctness_score" not in prompt):
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
        if "Question" in (system_prompt or "") or "college" in prompt.lower() or "viva" in prompt.lower() or "interview" in prompt.lower() or "school" in prompt.lower():
            is_school = "school" in prompt.lower() or "young student" in (system_prompt or "").lower()
            is_interview = "interview" in prompt.lower() or "target job role" in prompt.lower() or "candidate" in prompt.lower() or "hiring" in (system_prompt or "").lower()
            
            if is_school:
                topic_m = re.search(r'Topic / Chapter:\s*"([^"]+)"', prompt)
                t_val = topic_m.group(1) if topic_m else "General Science"
                return {
                    "questions": [
                        {
                            "question_text": f"What is the basic definition and purpose of {t_val}?",
                            "topic": f"{t_val} - Definition",
                            "difficulty": "easy",
                            "reference_answer": f"{t_val} explains key processes and fundamental principles in this chapter.",
                            "followup_question": "",
                            "followup_answer": ""
                        },
                        {
                            "question_text": f"Can you give one real-life example or application of {t_val}?",
                            "topic": f"{t_val} - Examples",
                            "difficulty": "easy",
                            "reference_answer": "Real-life examples demonstrate the practical observation of this principle.",
                            "followup_question": "",
                            "followup_answer": ""
                        },
                        {
                            "question_text": f"What are the main parts or key steps involved in {t_val}?",
                            "topic": f"{t_val} - Steps",
                            "difficulty": "medium",
                            "reference_answer": "It consists of sequential components functioning together.",
                            "followup_question": "",
                            "followup_answer": ""
                        }
                    ]
                }

            if is_interview:
                role_m = re.search(r'Target Job Role(?: Applied For)?:\s*"([^"]+)"', prompt)
                role_val = role_m.group(1) if role_m else "Candidate"
                return {
                    "questions": [
                        {
                            "question_text": f"In your past projects as a {role_val}, walk me through a complex problem you solved and your technical approach.",
                            "topic": f"{role_val} - Project Experience",
                            "difficulty": "medium",
                            "reference_answer": "Clear problem statement, structured solution architecture, metrics, and lessons learned.",
                            "followup_question": "Why did you choose that specific approach instead of alternative solutions?",
                            "followup_answer": "Evaluation of trade-offs, constraints, and operational efficiency."
                        },
                        {
                            "question_text": f"As a {role_val}, how do you ensure high performance, reliability, and code quality in your deliverable?",
                            "topic": f"{role_val} - Best Practices",
                            "difficulty": "medium",
                            "reference_answer": "Automated testing, modular code design, profiling, and continuous integration.",
                            "followup_question": "What metrics do you monitor to catch regressions before they hit production?",
                            "followup_answer": "Latency, error rates, resource utilization, and unit/integration test coverage."
                        },
                        {
                            "question_text": f"Can you describe a challenging bug or outage you investigated in a {role_val} project and how you diagnosed it?",
                            "topic": f"{role_val} - Debugging & Diagnostics",
                            "difficulty": "hard",
                            "reference_answer": "Log inspection, reproducing the issue, isolating the root cause, and applying a robust regression test.",
                            "followup_question": "What safeguards did you implement to prevent this failure from recurring?",
                            "followup_answer": "Enhanced alerting, automated guardrails, and post-mortem documentation."
                        },
                        {
                            "question_text": f"How do you handle architectural trade-offs between delivery speed and technical debt in {role_val} initiatives?",
                            "topic": f"{role_val} - Engineering Strategy",
                            "difficulty": "hard",
                            "reference_answer": "Pragmatic prioritization, well-documented design choices, and planned refactoring cycles.",
                            "followup_question": "How do you align technical priorities with product and stakeholder expectations?",
                            "followup_answer": "Quantifying technical debt impact in terms of reliability, velocity, and user experience."
                        }
                    ]
                }

            is_college = "college" in prompt.lower() or "practical" in prompt.lower() or "university" in (system_prompt or "").lower()
            if is_college:
                # Extract topic from prompt if possible
                topic_match = re.search(r'Title / Topic:\s*"([^"]+)"', prompt)
                topic_val = topic_match.group(1) if topic_match else "College Subject"
                return {
                    "questions": [
                        {
                            "question_text": f"What is the fundamental working principle and primary objective of {topic_val}?",
                            "topic": f"{topic_val} - Core Principles",
                            "difficulty": "easy",
                            "reference_answer": f"{topic_val} provides the core mechanism to resolve system constraints efficiently.",
                            "followup_question": "What is the governing mathematical or theoretical law supporting this?",
                            "followup_answer": "The core governing equations and foundational theoretical formulation."
                        },
                        {
                            "question_text": f"How is {topic_val} initialized and what are its key parameters?",
                            "topic": f"{topic_val} - Initialization",
                            "difficulty": "easy",
                            "reference_answer": "Initialization sets up memory structures, environment flags, and boundary variables.",
                            "followup_question": "What happens if boundary parameters are improperly configured?",
                            "followup_answer": "Throws configuration exception or causes unstable state convergence."
                        },
                        {
                            "question_text": f"Explain the step-by-step procedure or algorithm executed in {topic_val}.",
                            "topic": f"{topic_val} - Procedure",
                            "difficulty": "medium",
                            "reference_answer": "The execution flows from validation, step-wise state transformation, to terminal verification.",
                            "followup_question": "What is the computational complexity of this procedure?",
                            "followup_answer": "Optimal polynomial time with bounded space overhead."
                        },
                        {
                            "question_text": f"What are the critical components or sub-modules involved in {topic_val} and how do they interact?",
                            "topic": f"{topic_val} - Architecture",
                            "difficulty": "medium",
                            "reference_answer": "Sub-modules communicate over defined interfaces passing validated state structures.",
                            "followup_question": "How is synchronization maintained between asynchronous sub-modules?",
                            "followup_answer": "Using semaphores, mutex locks, or event loops."
                        },
                        {
                            "question_text": f"Compare {topic_val} with an alternative approach or previous standard.",
                            "topic": f"{topic_val} - Comparative Analysis",
                            "difficulty": "medium",
                            "reference_answer": "It provides superior throughput and reliability compared to older synchronous architectures.",
                            "followup_question": "Under what constraint would you choose the simpler legacy method?",
                            "followup_answer": "When minimal hardware footprint or extreme simplicity is strictly demanded."
                        },
                        {
                            "question_text": f"How do you calibrate or measure accuracy, error, and performance in {topic_val}?",
                            "topic": f"{topic_val} - Measurement",
                            "difficulty": "medium",
                            "reference_answer": "Quantified through latency percentiles, error rates, and standard benchmark suites.",
                            "followup_question": "What are the common sources of experimental or runtime error?",
                            "followup_answer": "Drift, noise, packet loss, or unhandled race conditions."
                        },
                        {
                            "question_text": f"How does {topic_val} handle edge cases and abnormal exception states?",
                            "topic": f"{topic_val} - Exception Handling",
                            "difficulty": "hard",
                            "reference_answer": "Defensive guards and transactional rollbacks maintain state integrity.",
                            "followup_question": "How do you recover if a catastrophic cascade occurs?",
                            "followup_answer": "Circuit breakers isolate the failure and trigger self-healing failovers."
                        },
                        {
                            "question_text": f"What are the major trade-offs between performance, scalability, and complexity in {topic_val}?",
                            "topic": f"{topic_val} - Trade-offs",
                            "difficulty": "hard",
                            "reference_answer": "Scaling throughput increases concurrency complexity and memory footprint.",
                            "followup_question": "How do you isolate a memory leak or bottleneck in production?",
                            "followup_answer": "Through profiling graphs, heap dumps, and distributed tracing."
                        },
                        {
                            "question_text": f"Describe a real-world industrial or engineering application where {topic_val} is deployed.",
                            "topic": f"{topic_val} - Practical Application",
                            "difficulty": "hard",
                            "reference_answer": "Widely deployed in distributed cloud systems, real-time operating kernels, and financial networks.",
                            "followup_question": "What modifications are needed when scaling from prototype to production?",
                            "followup_answer": "Load balancing, fault tolerant replicas, and telemetry logging."
                        },
                        {
                            "question_text": f"What are the recent modern advancements or future research directions in {topic_val}?",
                            "topic": f"{topic_val} - Modern Trends",
                            "difficulty": "hard",
                            "reference_answer": "Current trends incorporate hardware acceleration, AI optimization, and formal verification.",
                            "followup_question": "What is the key open challenge currently under investigation?",
                            "followup_answer": "Low-latency consensus and verifiable security across decentralized topologies."
                        }
                    ]
                }
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
        # Mock fallback provider is always registered for offline/testing/graceful degradation
        self._pool["mock"] = SmartRuleFallbackProvider()

        # NOTE: last_call_meta is intentionally per-call (set in complete()),
        # not a shared global — callers must pass it through or read it immediately.
        self.last_call_meta: Optional[CallMeta] = None

        available = list(self._pool.keys())
        logger.info(f"LLMRouter initialised. Available providers: {available}")
        logger.info(
            f"Task routing — question_generation:{settings.QUESTION_GEN_PROVIDER} | "
            f"live_turn:{settings.LIVE_PROVIDER} | "
            f"evaluation:{settings.EVALUATION_PROVIDER} | "
            f"report:{settings.REPORT_PROVIDER}"
        )

        # Emit a clear WARNING for each task whose preferred provider has no key.
        # This surfaces misconfigured deployments at startup rather than at runtime.
        key_map = {
            "gemini": settings.GEMINI_API_KEY,
            "groq": settings.GROQ_API_KEY,
            "openai": settings.OPENAI_API_KEY,
            "mock": "__always_available__",
        }
        for task_name, provider_name in [
            ("question_generation", settings.QUESTION_GEN_PROVIDER),
            ("live_turn", settings.LIVE_PROVIDER),
            ("evaluation", settings.EVALUATION_PROVIDER),
            ("report", settings.REPORT_PROVIDER),
        ]:
            pname = (provider_name or "").lower()
            if pname not in key_map:
                continue
            if pname != "mock" and not key_map.get(pname):
                logger.warning(
                    f"[LLMRouter] Task '{task_name}' prefers provider '{pname}' "
                    f"but {pname.upper()}_API_KEY is not set — "
                    f"requests for this task will fall back to the next available provider."
                )

    def _provider_for_task(self, task: str) -> Optional[LLMProvider]:
        preferred = TASK_PROVIDER_MAP.get(task, "mock")
        if preferred in self._pool:
            return self._pool[preferred]
        if "mock" in self._pool:
            return self._pool["mock"]
        if self._pool:
            return next(iter(self._pool.values()))
        return None

    def _fallback_chain(self, task: str) -> List[LLMProvider]:
        primary = self._provider_for_task(task)
        primary_name = getattr(primary, "name", None)
        chain: List[LLMProvider] = []
        for name, prov in self._pool.items():
            if name != primary_name and name != "mock":
                chain.append(prov)
        if "mock" in self._pool and primary_name != "mock":
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

        candidates = [p for p in ([primary] + fallbacks) if p is not None]
        if not candidates:
            raise RuntimeError(f"No LLM provider available for task '{task}'. Check configured API keys.")

        for provider in candidates:
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
