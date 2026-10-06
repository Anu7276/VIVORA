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
import os
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


TASK_MAX_TOKENS: Dict[str, int] = {
    "live_turn": 250,
    "evaluation": 600,
    "question_generation": 1500,
    "report": 2500,
}

_shared_http_client: Optional[httpx.AsyncClient] = None


def get_shared_http_client() -> httpx.AsyncClient:
    global _shared_http_client
    if _shared_http_client is None or _shared_http_client.is_closed:
        _shared_http_client = httpx.AsyncClient(
            timeout=10.0,
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=50, keepalive_expiry=30.0),
        )
    return _shared_http_client


async def close_shared_http_client() -> None:
    global _shared_http_client
    if _shared_http_client is not None and not _shared_http_client.is_closed:
        await _shared_http_client.aclose()
        _shared_http_client = None


# ─── Abstract base ────────────────────────────────────────────────────────────
class LLMProvider(ABC):
    name: str = "base"

    @abstractmethod
    async def generate_text(self, prompt: str, system_prompt: Optional[str] = None, max_tokens: Optional[int] = None) -> str:
        pass

    @abstractmethod
    async def generate_json(self, prompt: str, system_prompt: Optional[str] = None, max_tokens: Optional[int] = None) -> Dict[str, Any]:
        pass


# ─── Gemini ───────────────────────────────────────────────────────────────────
class GeminiProvider(LLMProvider):
    name = "gemini"

    def __init__(self, api_key: str):
        self.api_key = api_key
        model = settings.GEMINI_MODEL
        if model in ("gemini-2.5-flash", "gemini-flash"):
            model = "gemini-2.0-flash"
        self.model = model

    def _url_for(self, model_name: str) -> str:
        return f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"

    async def generate_text(self, prompt: str, system_prompt: Optional[str] = None, max_tokens: Optional[int] = None) -> str:
        prompt = Guardrails.sanitize_input(prompt)
        payload: Dict[str, Any] = {
            "contents": [{"parts": [{"text": prompt}]}]
        }
        if system_prompt:
            payload["systemInstruction"] = {"parts": [{"text": system_prompt}]}
        gen_cfg: Dict[str, Any] = {}
        if max_tokens:
            gen_cfg["maxOutputTokens"] = max_tokens
        if gen_cfg:
            payload["generationConfig"] = gen_cfg

        headers = {"x-goog-api-key": self.api_key, "Content-Type": "application/json"}
        client = get_shared_http_client()

        models_to_try = [self.model]
        if self.model != "gemini-2.0-flash" and "2.0" not in self.model:
            models_to_try.append("gemini-2.0-flash")
        if "1.5-flash" not in models_to_try:
            models_to_try.append("gemini-1.5-flash")

        last_exc = None
        for m in models_to_try:
            try:
                resp = await client.post(self._url_for(m), headers=headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
                return data["candidates"][0]["content"]["parts"][0]["text"]
            except httpx.HTTPStatusError as exc:
                last_exc = exc
                if exc.response.status_code in (404, 400) and m != models_to_try[-1]:
                    continue
                raise
        if last_exc:
            raise last_exc
        raise RuntimeError("Gemini generate_text call failed")

    async def generate_json(self, prompt: str, system_prompt: Optional[str] = None, max_tokens: Optional[int] = None) -> Dict[str, Any]:
        prompt = Guardrails.sanitize_input(prompt)
        payload: Dict[str, Any] = {
            "contents": [{"parts": [{"text": prompt}]}]
        }
        if system_prompt:
            payload["systemInstruction"] = {"parts": [{"text": system_prompt}]}
        gen_cfg: Dict[str, Any] = {"responseMimeType": "application/json"}
        if max_tokens:
            gen_cfg["maxOutputTokens"] = max_tokens
        payload["generationConfig"] = gen_cfg

        headers = {"x-goog-api-key": self.api_key, "Content-Type": "application/json"}
        client = get_shared_http_client()

        models_to_try = [self.model]
        if self.model != "gemini-2.0-flash" and "2.0" not in self.model:
            models_to_try.append("gemini-2.0-flash")
        if "1.5-flash" not in models_to_try:
            models_to_try.append("gemini-1.5-flash")

        last_exc = None
        for m in models_to_try:
            try:
                resp = await client.post(self._url_for(m), headers=headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                return _extract_json_from_text(text)
            except httpx.HTTPStatusError as exc:
                last_exc = exc
                if exc.response.status_code in (404, 400) and m != models_to_try[-1]:
                    continue
                raise
            except Exception as exc:
                last_exc = exc
                text = await self.generate_text(prompt, system_prompt, max_tokens=max_tokens)
                return _extract_json_from_text(text)
        if last_exc:
            raise last_exc
        raise RuntimeError("Gemini generate_json call failed")


# ─── Groq ─────────────────────────────────────────────────────────────────────
class GroqProvider(LLMProvider):
    name = "groq"

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.groq.com/openai/v1/chat/completions"
        self.model = settings.GROQ_MODEL

    async def generate_text(self, prompt: str, system_prompt: Optional[str] = None, max_tokens: Optional[int] = None) -> str:
        prompt = Guardrails.sanitize_input(prompt)
        messages: List[Dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        payload: Dict[str, Any] = {"model": self.model, "messages": messages}
        if max_tokens:
            payload["max_tokens"] = max_tokens
        client = get_shared_http_client()
        resp = await client.post(
            self.base_url, headers=headers,
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]

    async def generate_json(self, prompt: str, system_prompt: Optional[str] = None, max_tokens: Optional[int] = None) -> Dict[str, Any]:
        prompt = Guardrails.sanitize_input(prompt)
        messages: List[Dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "response_format": {"type": "json_object"}
        }
        if max_tokens:
            payload["max_tokens"] = max_tokens
        client = get_shared_http_client()
        resp = await client.post(
            self.base_url, headers=headers,
            json=payload,
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

    async def generate_text(self, prompt: str, system_prompt: Optional[str] = None, max_tokens: Optional[int] = None) -> str:
        prompt = Guardrails.sanitize_input(prompt)
        messages: List[Dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        payload: Dict[str, Any] = {"model": self.model, "messages": messages}
        if max_tokens:
            payload["max_tokens"] = max_tokens
        client = get_shared_http_client()
        resp = await client.post(
            self.base_url, headers=headers,
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]

    async def generate_json(self, prompt: str, system_prompt: Optional[str] = None, max_tokens: Optional[int] = None) -> Dict[str, Any]:
        text = await self.generate_text(prompt, system_prompt, max_tokens=max_tokens)
        return _extract_json_from_text(text)


# ─── SmartRuleFallbackProvider (mock) ────────────────────────────────────────
class SmartRuleFallbackProvider(LLMProvider):
    """
    Zero-external-cost rule-based fallback.
    Returns deterministic, plausible outputs for every task type.
    NOTE: Outputs from this provider are flagged as NOT AI-scored.
    """
    name = "mock"

    async def generate_text(self, prompt: str, system_prompt: Optional[str] = None, max_tokens: Optional[int] = None) -> str:
        if "Interviewer" in (system_prompt or ""):
            return "Let's move on to the next question. Please speak clearly whenever you are ready."
        return "Good explanation. Let us proceed with the next concept."

    async def generate_json(self, prompt: str, system_prompt: Optional[str] = None, max_tokens: Optional[int] = None) -> Dict[str, Any]:
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
        sys_lower = (system_prompt or "").lower()
        prompt_lower = prompt.lower()
        if "question" in sys_lower or "interview" in sys_lower or "college" in prompt_lower or "viva" in prompt_lower or "interview" in prompt_lower or "school" in prompt_lower or "target job role" in prompt_lower:
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
                        },
                        {
                            "question_text": f"How do you design and architect for concurrency, security, and scalability in a {role_val} ecosystem?",
                            "topic": f"{role_val} - Architecture & Concurrency",
                            "difficulty": "hard",
                            "reference_answer": "Stateless services, horizontal scaling, database connection pooling, idempotent APIs, and token bucket rate limits.",
                            "followup_question": "How do you mitigate race conditions and deadlocks in concurrent state updates?",
                            "followup_answer": "Optimistic concurrency control with version stamps or atomic distributed locks."
                        },
                        {
                            "question_text": f"What testing, monitoring, and continuous deployment strategies do you employ for critical {role_val} services?",
                            "topic": f"{role_val} - Testing & Operations",
                            "difficulty": "medium",
                            "reference_answer": "End-to-end integration tests, synthetic monitoring, canary deployments, and automated rollback triggers.",
                            "followup_question": "How do you evaluate test coverage effectiveness beyond raw percentage metrics?",
                            "followup_answer": "Mutation testing, boundary analysis, and testing against production incident post-mortem scenarios."
                        }
                    ]
                }

            is_college = "college" in prompt.lower() or "practical" in prompt.lower() or "university" in (system_prompt or "").lower() or "syllabus" in prompt.lower()
            if is_college:
                # 1. Clean topic name (remove suffixes like Exam Notes, Assignments, Manual)
                topic_match = re.search(r'Title / Topic:\s*"([^"]+)"', prompt)
                raw_topic = topic_match.group(1) if topic_match else ""
                clean_topic = self._clean_topic_name(raw_topic)

                # 2. Extract context from prompt
                ctx_match = re.search(r'\"\"\"(.*?)\"\"\"', prompt, re.DOTALL)
                ctx = ctx_match.group(1).strip() if ctx_match else ""
                if not ctx:
                    c_match = re.search(r'(?:Reference Context|Lab Context|Notes Context|Questions Context):\s*(.+)', prompt, re.DOTALL)
                    ctx = c_match.group(1).strip() if c_match else ""

                return {
                    "questions": self._build_college_questions(clean_topic, ctx)
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

    def _clean_topic_name(self, raw: str) -> str:
        if not raw:
            return "Computer Science"
        clean = re.sub(r"\.[a-zA-Z0-9]+$", "", raw)
        clean = re.sub(r"[_\-]+", " ", clean)
        words = [
            w for w in clean.split()
            if w.lower() not in {
                "assignment", "assignments", "answer", "answers", "solution", "solutions",
                "notes", "note", "exam", "exams", "test", "tests", "manual", "doc", "pdf",
                "file", "unit", "chapter", "lab", "viva", "voce", "questions", "question",
                "syllabus", "guide", "textbook"
            }
        ]
        cleaned = " ".join(words).strip()
        return cleaned if len(cleaned) >= 2 else (clean.strip() or "Computer Science")

    def _extract_concepts_from_text(self, text: str) -> List[str]:
        if not text:
            return []
        concepts: List[str] = []
        # Multi-word capitalized terms
        cap_terms = re.findall(r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b', text)
        for term in cap_terms:
            t = term.strip()
            if t.lower() not in {"computer science", "university exam", "exam notes", "all rights", "chapter one", "first edition"} and t not in concepts:
                concepts.append(t)
        # Bullet items / numbered items
        bullets = re.findall(r'(?:^|\n)\s*(?:[\*\-\•]|\d+[\.\)])\s*([A-Za-z0-9\s\-]{3,35})(?:\:|\-|\n|$)', text)
        for b in bullets:
            b_clean = b.strip()
            if 3 <= len(b_clean) <= 30 and b_clean.lower() not in {"the", "and", "introduction", "conclusion", "overview", "summary"} and b_clean not in concepts:
                concepts.append(b_clean)
        # Uppercase technical acronyms
        acronyms = re.findall(r'\b([A-Z]{2,6})\b', text)
        for acr in acronyms:
            if acr not in {"THE", "AND", "FOR", "NOT", "PDF", "DOC", "N/A", "URL", "API"} and acr not in concepts:
                concepts.append(acr)
        return concepts[:10]

    def _build_college_questions(self, topic: str, context: str) -> List[Dict[str, Any]]:
        t_low = (topic or "").lower()
        c_low = (context or "").lower()[:1500]

        # ── Domain 1: Java ───────────────────────────────────────────────────
        if "java" in t_low or "java" in c_low:
            return [
                {
                    "question_text": "What are the core principles of Object-Oriented Programming (OOP) in Java, and how is Polymorphism implemented?",
                    "topic": "Java - OOP & Polymorphism",
                    "difficulty": "easy",
                    "reference_answer": "Java OOP relies on Encapsulation, Inheritance, Polymorphism, and Abstraction. Polymorphism is implemented via method overloading (compile-time) and method overriding (runtime).",
                    "followup_question": "How does dynamic method dispatch work in Java at runtime?",
                    "followup_answer": "The JVM uses the virtual method table (vtable) of the runtime object to resolve the method call."
                },
                {
                    "question_text": "What is the difference between an Abstract Class and an Interface in Java, especially after Java 8?",
                    "topic": "Java - Abstract Classes vs Interfaces",
                    "difficulty": "easy",
                    "reference_answer": "Abstract classes can hold state (instance variables) and constructors, whereas interfaces define contracts. Java 8 introduced default and static methods in interfaces.",
                    "followup_question": "When would you prefer an abstract class over an interface in application design?",
                    "followup_answer": "When multiple classes share common non-static state and code logic in an 'is-a' hierarchy."
                },
                {
                    "question_text": "How does memory management work in the Java Virtual Machine (JVM) between Stack and Heap?",
                    "topic": "Java - JVM Memory Management",
                    "difficulty": "medium",
                    "reference_answer": "Stack memory stores local primitive variables and method call frames. Heap memory stores all objects and class instances managed by the Garbage Collector.",
                    "followup_question": "What is the role of the Garbage Collector, and can you force it using System.gc()?",
                    "followup_answer": "Garbage collection automatically reclaims unreferenced heap objects; System.gc() is only a suggestion to the JVM and is not guaranteed to execute immediately."
                },
                {
                    "question_text": "Explain Exception Handling in Java. What is the fundamental difference between Checked and Unchecked exceptions?",
                    "topic": "Java - Exception Handling",
                    "difficulty": "medium",
                    "reference_answer": "Checked exceptions are verified at compile-time and must be caught or declared with throws. Unchecked exceptions (subclasses of RuntimeException) indicate logic or runtime errors.",
                    "followup_question": "Under what specific condition will a finally block NOT execute in Java?",
                    "followup_answer": "If System.exit() is invoked or if a fatal JVM error occurs."
                },
                {
                    "question_text": "How does Multithreading work in Java, and how do you achieve thread synchronization?",
                    "topic": "Java - Multithreading & Concurrency",
                    "difficulty": "medium",
                    "reference_answer": "Threads can be created by implementing Runnable/Callable or extending Thread. Synchronization uses synchronized blocks/methods or locks to prevent race conditions on shared state.",
                    "followup_question": "What is a Deadlock in multithreading, and how can it be avoided?",
                    "followup_answer": "A deadlock occurs when two threads wait indefinitely on locks held by each other. It is avoided by acquiring locks in a strict global ordering."
                },
                {
                    "question_text": "How does HashMap work internally in Java, and what happens during a hash collision?",
                    "topic": "Java - Collections Framework",
                    "difficulty": "medium",
                    "reference_answer": "HashMap stores key-value pairs in bucket arrays indexed by the key's hash code. On collision, entries form a linked list, transforming into a red-black balanced tree when bucket depth exceeds 8.",
                    "followup_question": "What is the contract between equals() and hashCode() methods?",
                    "followup_answer": "If two objects are equal by equals(), they must produce the identical hashCode."
                },
                {
                    "question_text": "Why are String objects immutable in Java, and what is the difference between String, StringBuilder, and StringBuffer?",
                    "topic": "Java - String Handling",
                    "difficulty": "medium",
                    "reference_answer": "Strings are immutable for security, thread-safety, and String Constant Pool caching. StringBuilder is mutable and faster for single-thread use; StringBuffer is thread-safe and synchronized.",
                    "followup_question": "Where does a string literal reside in JVM memory compared to an object created with new?",
                    "followup_answer": "String literals reside in the String Constant Pool inside the heap; 'new' explicitly allocates on the general heap."
                },
                {
                    "question_text": "What is the difference between Method Overloading and Method Overriding in Java?",
                    "topic": "Java - Methods & Polymorphism",
                    "difficulty": "medium",
                    "reference_answer": "Overloading occurs in the same class with identical name but different parameters (static binding). Overriding redefines a superclass method in a subclass with the same signature (dynamic binding).",
                    "followup_question": "Can you override a static method in Java?",
                    "followup_answer": "No, static methods belong to the class and are hidden rather than overridden."
                },
                {
                    "question_text": "Explain the lifecycle and states of a Thread in Java.",
                    "topic": "Java - Thread Lifecycle",
                    "difficulty": "hard",
                    "reference_answer": "Thread states include New, Runnable, Blocked, Waiting, Timed Waiting, and Terminated.",
                    "followup_question": "What is the difference between wait() and sleep() methods?",
                    "followup_answer": "sleep() pauses execution without releasing monitor locks; wait() releases the lock on the monitor until notify() is called."
                },
                {
                    "question_text": "What are Generics in Java, and what is Type Erasure?",
                    "topic": "Java - Generics",
                    "difficulty": "hard",
                    "reference_answer": "Generics provide compile-time type safety. Type erasure removes all generic type arguments during compilation so bytecode remains backward compatible.",
                    "followup_question": "Why can't you instantiate a generic type with new T() in Java?",
                    "followup_answer": "Because the runtime type information T is erased at compile time."
                }
            ]

        # ── Domain 2: DBMS / Database ─────────────────────────────────────────
        if "dbms" in t_low or "database" in t_low or "sql" in t_low or "rdbms" in t_low or "dbms" in c_low:
            return [
                {
                    "question_text": "Explain the ACID properties of database transactions with examples.",
                    "topic": "DBMS - Transaction Management",
                    "difficulty": "easy",
                    "reference_answer": "Atomicity (all or nothing), Consistency (preserves integrity constraints), Isolation (concurrent transactions execute independently), and Durability (committed changes persist).",
                    "followup_question": "What is the purpose of the Write-Ahead Logging (WAL) protocol in maintaining Durability?",
                    "followup_answer": "WAL ensures all state modifications are logged to non-volatile disk before changes are written to the database files."
                },
                {
                    "question_text": "What is Normalization, and what is the difference between 3NF and BCNF?",
                    "topic": "DBMS - Normalization",
                    "difficulty": "easy",
                    "reference_answer": "Normalization organizes data to reduce redundancy and eliminate insertion, update, and deletion anomalies. BCNF strictly requires every determinant to be a super key.",
                    "followup_question": "Can every relational schema be decomposed into BCNF without losing functional dependencies?",
                    "followup_answer": "No, BCNF decomposition guarantees lossless join, but dependency preservation is not always achievable."
                },
                {
                    "question_text": "How do B-Trees and B+ Trees work as database indexes, and why are B+ Trees preferred?",
                    "topic": "DBMS - Indexing",
                    "difficulty": "medium",
                    "reference_answer": "B+ Trees store all actual record pointers in leaf nodes linked sequentially, which allows efficient range scans and higher branching factors in internal nodes.",
                    "followup_question": "What is the difference between a Clustered Index and a Non-Clustered Index?",
                    "followup_answer": "A clustered index defines the physical order of table rows on disk; non-clustered indexes maintain a separate lookup structure."
                },
                {
                    "question_text": "What is the Two-Phase Locking (2PL) protocol, and how does it guarantee serializability?",
                    "topic": "DBMS - Concurrency Control",
                    "difficulty": "medium",
                    "reference_answer": "2PL consists of a growing phase (locks acquired) and a shrinking phase (locks released). Once a lock is released, no new locks can be acquired.",
                    "followup_question": "Does strict 2PL prevent cascading aborts and deadlocks?",
                    "followup_answer": "Strict 2PL prevents cascading aborts by holding exclusive locks until commit, but deadlocks can still occur."
                },
                {
                    "question_text": "Explain the differences between Inner, Left Outer, Right Outer, and Full Outer Joins in SQL.",
                    "topic": "DBMS - SQL Joins",
                    "difficulty": "medium",
                    "reference_answer": "Inner joins return matching records from both tables. Left/Right joins return all records from one table plus matching records from the other. Full outer joins return all rows from both.",
                    "followup_question": "How does an SQL query engine execute a Hash Join vs a Nested Loop Join?",
                    "followup_answer": "Nested loop iterates row-by-row; hash join builds an in-memory hash table on the smaller relation and probes it with the larger relation."
                },
                {
                    "question_text": "What is the difference between a Primary Key, a Unique Key, and a Foreign Key?",
                    "topic": "DBMS - Keys & Constraints",
                    "difficulty": "medium",
                    "reference_answer": "Primary key uniquely identifies a record and rejects NULLs. Unique key enforces uniqueness but permits NULLs. Foreign key establishes referential integrity with another table's primary key.",
                    "followup_question": "What actions can occur on parent delete when a foreign key constraint is configured with ON DELETE CASCADE?",
                    "followup_answer": "All child rows referencing the deleted parent row are automatically deleted."
                },
                {
                    "question_text": "What are Stored Procedures and Triggers, and when should you use each?",
                    "topic": "DBMS - Programmability",
                    "difficulty": "medium",
                    "reference_answer": "Stored procedures are compiled subroutines invoked manually; triggers execute automatically in response to DML events (INSERT, UPDATE, DELETE).",
                    "followup_question": "What are the performance implications of heavily nested triggers?",
                    "followup_answer": "They increase transaction latency, lock durations, and can cause difficult-to-debug cascading side effects."
                },
                {
                    "question_text": "How does a database recover from a system crash using Checkpointing and redo/undo logs?",
                    "topic": "DBMS - Recovery Systems",
                    "difficulty": "hard",
                    "reference_answer": "During recovery, transactions committed after checkpoint are redone from the log, and active uncommitted transactions are undone.",
                    "followup_question": "Why is checkpointing essential for log-based recovery efficiency?",
                    "followup_answer": "It limits the volume of log records that must be scanned and reprocessed during crash recovery."
                },
                {
                    "question_text": "What are database Deadlocks, and what techniques are used for deadlock detection and prevention?",
                    "topic": "DBMS - Deadlock Handling",
                    "difficulty": "hard",
                    "reference_answer": "Deadlocks occur when transactions wait cyclically for locks held by each other. Techniques include wait-for graphs, timeout mechanisms, and timestamp schemes (Wait-Die, Wound-Wait).",
                    "followup_question": "What is the difference between the Wait-Die and Wound-Wait preemption schemes?",
                    "followup_answer": "Wait-Die is non-preemptive (older waits, younger dies); Wound-Wait is preemptive (older wounds younger, younger waits)."
                },
                {
                    "question_text": "Compare Relational Databases with NoSQL Document Databases. What trade-offs govern this architectural choice?",
                    "topic": "DBMS - Architectural Trade-offs",
                    "difficulty": "hard",
                    "reference_answer": "RDBMS guarantees ACID and relational integrity with structured schemas; NoSQL provides flexible schemas, horizontal scalability, and eventual consistency (BASE model).",
                    "followup_question": "Explain the CAP theorem and which two properties distributed databases typically prioritize.",
                    "followup_answer": "Consistency, Availability, and Partition tolerance; networks must tolerate partitions, forcing systems to trade between Consistency (CP) and Availability (AP)."
                }
            ]

        # ── Domain 3: Operating Systems ───────────────────────────────────────
        if "operating" in t_low or "os" in t_low.split() or "operating" in c_low or "deadlock" in c_low or "semaphore" in c_low:
            return [
                {
                    "question_text": "What is the difference between a Process and a Thread, and what resources are shared between threads?",
                    "topic": "OS - Processes & Threads",
                    "difficulty": "easy",
                    "reference_answer": "A process is an executing program with isolated address space. Threads are lightweight execution units within a process sharing heap, global variables, and open files, but having their own stack.",
                    "followup_question": "What overhead occurs during a process context switch compared to a thread context switch?",
                    "followup_answer": "Process context switches invalidate virtual memory TLB caches and switch page tables, causing higher latency."
                },
                {
                    "question_text": "What are the four necessary Coffman conditions for a Deadlock to occur?",
                    "topic": "OS - Deadlock Conditions",
                    "difficulty": "easy",
                    "reference_answer": "Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait.",
                    "followup_question": "How does Banker's Algorithm ensure deadlock avoidance in resource allocation?",
                    "followup_answer": "It tests whether allocating requested resources leaves the system in a safe state where a safe sequence exists to satisfy maximum needs."
                },
                {
                    "question_text": "What is the difference between a Counting Semaphore and a Binary Mutex Lock?",
                    "topic": "OS - Process Synchronization",
                    "difficulty": "medium",
                    "reference_answer": "A mutex is a locking mechanism with ownership restricted to the acquiring thread. A counting semaphore is a signaling mechanism initialized with an integer value allowing concurrent access to N resources.",
                    "followup_question": "What is Priority Inversion and how does Priority Inheritance solve it?",
                    "followup_answer": "When a lower-priority thread holding a lock blocks a high-priority thread, priority inheritance temporarily elevates the lower thread's priority to release the lock."
                },
                {
                    "question_text": "Explain Virtual Memory and how Paging translates logical addresses to physical addresses.",
                    "topic": "OS - Memory Management",
                    "difficulty": "medium",
                    "reference_answer": "Virtual memory maps virtual pages to physical frames via page tables managed by the MMU. The Translation Lookaside Buffer (TLB) caches recent translations.",
                    "followup_question": "What happens inside the kernel when a Page Fault interrupt is triggered?",
                    "followup_answer": "The OS suspends the process, allocates a physical frame, reads the page from disk swap, updates the page table, and restarts the instruction."
                },
                {
                    "question_text": "Compare the Round Robin, First-Come First-Served (FCFS), and Shortest Job First (SJF) CPU scheduling algorithms.",
                    "topic": "OS - CPU Scheduling",
                    "difficulty": "medium",
                    "reference_answer": "FCFS suffers from the convoy effect; SJF provides optimal average waiting time but risks starvation; Round Robin assigns time quantum slices for fair interactive response.",
                    "followup_question": "What happens if the time quantum in Round Robin is configured too short or too long?",
                    "followup_answer": "Too short causes excessive context switching overhead; too long degrades to FCFS with poor responsiveness."
                },
                {
                    "question_text": "Explain the LRU (Least Recently Used) and FIFO Page Replacement algorithms.",
                    "topic": "OS - Page Replacement",
                    "difficulty": "medium",
                    "reference_answer": "FIFO replaces the oldest loaded page, subject to Belady's Anomaly. LRU replaces the page unused for the longest duration, approximating optimal replacement.",
                    "followup_question": "What is Belady's Anomaly and which algorithms are immune to it?",
                    "followup_answer": "When increasing physical frames causes more page faults. Stack algorithms like LRU and Optimal are strictly immune."
                },
                {
                    "question_text": "What is Thrashing in an operating system, and how is the Working Set Model used to prevent it?",
                    "topic": "OS - Virtual Memory Thrashing",
                    "difficulty": "hard",
                    "reference_answer": "Thrashing occurs when the system spends more time servicing page faults than executing instructions. The working set model allocates frames matching each process's active page set.",
                    "followup_question": "How does the OS respond if total demand exceeds available physical memory frames?",
                    "followup_answer": "It suspends lower-priority processes and swaps their entire address spaces to disk to relieve frame pressure."
                },
                {
                    "question_text": "What is the difference between User Mode and Kernel Mode, and how does a System Call transition between them?",
                    "topic": "OS - Kernel Architecture",
                    "difficulty": "hard",
                    "reference_answer": "User mode restricts direct access to hardware and kernel memory. A system call executes a software interrupt or trap instruction, switching CPU privilege to kernel mode.",
                    "followup_question": "Why is dual-mode execution essential for system security and stability?",
                    "followup_answer": "It prevents errant user applications from corrupting kernel structures or halting CPU execution."
                },
                {
                    "question_text": "What mechanisms are used for Inter-Process Communication (IPC), and how do Shared Memory and Message Passing compare?",
                    "topic": "OS - Inter-Process Communication",
                    "difficulty": "hard",
                    "reference_answer": "IPC uses pipes, message queues, sockets, and shared memory. Shared memory is fastest (no kernel copies) but requires explicit synchronization; message passing uses kernel buffers.",
                    "followup_question": "When would you prefer message passing sockets over shared memory?",
                    "followup_answer": "When processes run across distributed networked machines or require kernel-managed isolation."
                },
                {
                    "question_text": "How does an Inode-based file system store file metadata and data block pointers?",
                    "topic": "OS - File Systems",
                    "difficulty": "hard",
                    "reference_answer": "An inode stores file attributes, permissions, size, direct block pointers, and single/double/triple indirect block pointers addressing large file blocks.",
                    "followup_question": "What is the difference between a Hard Link and a Symbolic Link to an inode?",
                    "followup_answer": "A hard link is a directory entry pointing directly to the same inode number; a symbolic link is a separate file storing the path to the target file."
                }
            ]

        # ── Domain 4: Dynamic Concept Extraction from Uploaded Document Context ─
        concepts = self._extract_concepts_from_text(context)
        display_topic = topic or "Core Principles"

        if len(concepts) >= 3:
            c = concepts
            return [
                {
                    "question_text": f"What is the foundational principle of {c[0]} in {display_topic}, and what problem does it address?",
                    "topic": f"{display_topic} - {c[0]}",
                    "difficulty": "easy",
                    "reference_answer": f"{c[0]} provides the foundational mechanism to manage state and solve domain requirements effectively in {display_topic}.",
                    "followup_question": f"How does {c[0]} interact with surrounding components?",
                    "followup_answer": f"{c[0]} interfaces directly with adjacent structures to ensure predictable state propagation."
                },
                {
                    "question_text": f"Explain how {c[1]} is initialized and configured in {display_topic}.",
                    "topic": f"{display_topic} - {c[1]}",
                    "difficulty": "easy",
                    "reference_answer": f"Initialization of {c[1]} establishes memory boundaries, parameter flags, and default state structures.",
                    "followup_question": f"What exceptions or invalid states occur if {c[1]} is improperly set up?",
                    "followup_answer": f"Improper setup throws boundary exceptions or causes non-convergent runtime behavior."
                },
                {
                    "question_text": f"Walk through the step-by-step procedure or algorithmic workflow of {c[2]}.",
                    "topic": f"{display_topic} - {c[2]}",
                    "difficulty": "medium",
                    "reference_answer": f"The workflow progresses from input validation, intermediate state transformation, to terminal verification.",
                    "followup_question": f"What is the algorithmic time and space complexity of {c[2]}?",
                    "followup_answer": f"Bounded polynomial time with O(1) or O(n) space overhead."
                },
                {
                    "question_text": f"What is the key difference between {c[0]} and {c[min(3, len(c)-1)]} in practical implementations?",
                    "topic": f"{display_topic} - Comparative Analysis",
                    "difficulty": "medium",
                    "reference_answer": f"Each component satisfies different trade-offs between throughput, abstraction, and memory footprint.",
                    "followup_question": f"Under what constraints would you select one over the other?",
                    "followup_answer": "When system constraints demand lower latency versus simplified operational overhead."
                },
                {
                    "question_text": f"How does {display_topic} handle error conditions, edge cases, and fault recovery in {c[min(4, len(c)-1)]}?",
                    "topic": f"{display_topic} - Error Handling",
                    "difficulty": "hard",
                    "reference_answer": "Defensive validations, transactional rollbacks, and boundary guards preserve system integrity.",
                    "followup_question": "What fail-safe triggers prevent catastrophic cascading failures?",
                    "followup_answer": "Circuit breakers and graceful degradation isolate failure domains."
                },
                {
                    "question_text": f"What are the major performance trade-offs and scalability bottlenecks encountered in {c[min(5, len(c)-1)]}?",
                    "topic": f"{display_topic} - Performance Trade-offs",
                    "difficulty": "hard",
                    "reference_answer": "Increasing throughput increases memory footprint and synchronization contention.",
                    "followup_question": "How do you profile and isolate runtime bottlenecks in this component?",
                    "followup_answer": "Using diagnostic traces, heap profiling, and latency percentile metrics."
                }
            ]

        # ── Domain 5: Clean Generic Fallback (No Raw Filenames or Templates) ─
        return [
            {
                "question_text": f"What is the core working principle and fundamental objective of {display_topic}?",
                "topic": f"{display_topic} - Fundamentals",
                "difficulty": "easy",
                "reference_answer": f"{display_topic} establishes the foundational architecture and methodologies to resolve core domain requirements efficiently.",
                "followup_question": "Can you state the primary theoretical or practical rule supporting this?",
                "followup_answer": "The foundational rules and governing architectural constraints of the domain."
            },
            {
                "question_text": f"How is {display_topic} structured and what are its primary architectural components?",
                "topic": f"{display_topic} - Architecture",
                "difficulty": "easy",
                "reference_answer": "The architecture comprises modular sub-systems communicating across well-defined interfaces and state contracts.",
                "followup_question": "How is synchronization maintained between interacting sub-systems?",
                "followup_answer": "Through synchronization locks, event channels, or bounded queues."
            },
            {
                "question_text": f"Explain the standard procedural workflow or execution cycle in {display_topic}.",
                "topic": f"{display_topic} - Execution Flow",
                "difficulty": "medium",
                "reference_answer": "The execution cycle begins with validation, executes state transformations, and produces verified terminal output.",
                "followup_question": "What is the typical time and memory overhead of this execution cycle?",
                "followup_answer": "Optimal polynomial time with bounded working memory."
            },
            {
                "question_text": f"How does {display_topic} compare with alternative classical approaches in this domain?",
                "topic": f"{display_topic} - Comparative Analysis",
                "difficulty": "medium",
                "reference_answer": f"{display_topic} provides higher throughput and resilience compared to legacy single-stage approaches.",
                "followup_question": "In what specific scenario would a legacy approach still be justifiable?",
                "followup_answer": "When minimal hardware footprint or absolute simplicity is strictly required."
            },
            {
                "question_text": f"How does {display_topic} handle edge cases, runtime exceptions, and abnormal input states?",
                "topic": f"{display_topic} - Fault Tolerance",
                "difficulty": "hard",
                "reference_answer": "Defensive guards, transactional rollbacks, and isolation boundaries ensure resilient degradation.",
                "followup_question": "How does the system self-heal when a partial failure occurs?",
                "followup_answer": "Fault-isolation barriers isolate the error and restart the failed subsystem."
            },
            {
                "question_text": f"What are the major engineering trade-offs between performance, scalability, and complexity in {display_topic}?",
                "topic": f"{display_topic} - Trade-off Analysis",
                "difficulty": "hard",
                "reference_answer": "Scaling throughput increases concurrency complexity and memory footprint.",
                "followup_question": "How do you detect memory leaks or latency spikes in this ecosystem?",
                "followup_answer": "Through heap profiling, distributed tracing, and metric alerts."
            }
        ]


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

    def __init__(self, cfg=None) -> None:
        cfg = cfg or settings
        self._pool: Dict[str, LLMProvider] = {}
        gemini_key = (
            getattr(cfg, "GEMINI_API_KEY", None)
            or os.environ.get("GEMINI_API_KEY")
            or os.environ.get("GOOGLE_API_KEY")
            or os.environ.get("GEMINI_KEY")
            or os.environ.get("GOOGLE_GEMINI_API_KEY")
            or os.environ.get("GOOGLE_AI_KEY")
        )
        if gemini_key:
            self._pool["gemini"] = GeminiProvider(gemini_key)

        groq_key = (
            getattr(cfg, "GROQ_API_KEY", None)
            or os.environ.get("GROQ_API_KEY")
            or os.environ.get("GROQ_KEY")
            or os.environ.get("GROQ_APIKEY")
        )
        if groq_key:
            self._pool["groq"] = GroqProvider(groq_key)

        openai_key = (
            getattr(cfg, "OPENAI_API_KEY", None)
            or os.environ.get("OPENAI_API_KEY")
            or os.environ.get("OPENAI_KEY")
        )
        if openai_key:
            self._pool["openai"] = OpenAIProvider(openai_key)

        # Mock fallback provider is always registered for offline/testing/graceful degradation
        self._pool["mock"] = SmartRuleFallbackProvider()

        # NOTE: last_call_meta is intentionally per-call (set in complete()),
        # not a shared global — callers must pass it through or read it immediately.
        self.last_call_meta: Optional[CallMeta] = None

        available = list(self._pool.keys())
        logger.disabled = False
        logger.info(f"LLMRouter initialised. Available providers: {available}")
        logger.info(
            f"Task routing — question_generation:{cfg.QUESTION_GEN_PROVIDER} | "
            f"live_turn:{cfg.LIVE_PROVIDER} | "
            f"evaluation:{cfg.EVALUATION_PROVIDER} | "
            f"report:{cfg.REPORT_PROVIDER}"
        )

        # Emit a clear WARNING for each task whose preferred provider has no key.
        # This surfaces misconfigured deployments at startup rather than at runtime.
        key_map = {
            "gemini": gemini_key,
            "groq": groq_key,
            "openai": openai_key,
            "mock": "__always_available__",
        }
        for task_name, provider_name in [
            ("question_generation", cfg.QUESTION_GEN_PROVIDER),
            ("live_turn", cfg.LIVE_PROVIDER),
            ("evaluation", cfg.EVALUATION_PROVIDER),
            ("report", cfg.REPORT_PROVIDER),
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
        # Prefer any available real AI provider before mock rules
        for real_name in ["gemini", "groq", "openai"]:
            if real_name in self._pool:
                return self._pool[real_name]
        for name, p in self._pool.items():
            if name != "mock":
                return p
        if "mock" in self._pool:
            return self._pool["mock"]
        if self._pool:
            return next(iter(self._pool.values()))
        return None

    def _fallback_chain(self, task: str) -> List[LLMProvider]:
        primary = self._provider_for_task(task)
        primary_name = getattr(primary, "name", None)
        chain: List[LLMProvider] = []
        # Explicit priority: If primary is groq, try gemini immediately next
        priority_order = ["gemini", "openai"] if primary_name == "groq" else ["groq", "openai"]
        for p_name in priority_order:
            if p_name in self._pool and p_name != primary_name:
                chain.append(self._pool[p_name])
        for name, prov in self._pool.items():
            if name != primary_name and name != "mock" and prov not in chain:
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
        max_tokens: Optional[int] = None,
    ) -> Any:
        """Call once; on 429 back off 1.5 s and retry once."""
        for attempt in range(2):
            try:
                fn = provider.generate_json if as_json else provider.generate_text
                try:
                    return await fn(prompt, system_prompt, max_tokens=max_tokens)
                except TypeError as te:
                    if "max_tokens" in str(te):
                        return await fn(prompt, system_prompt)
                    raise
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

        task_max_tokens = TASK_MAX_TOKENS.get(task)
        for provider in candidates:
            t0 = time.monotonic()
            error_type: Optional[str] = None
            try:
                result = await self._call_with_retry(
                    provider, prompt, system_prompt, as_json, max_tokens=task_max_tokens
                )
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
