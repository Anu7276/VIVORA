from typing import List, Dict, Any, Optional
import re
from app.agents.base import BaseAgent
from app.llm.prompts import (
    QUESTION_GENERATION_PROMPT,
    SCHOOL_QUESTION_GENERATION_PROMPT,
    COLLEGE_QUESTION_GENERATION_PROMPT,
    INTERVIEW_QUESTION_GENERATION_PROMPT
)

class QuestionAgent(BaseAgent):
    def __init__(self):
        super().__init__("QuestionAgent")

    async def get_questions(
        self,
        mode: str,
        question_source: str,
        uploaded_questions: List[Dict[str, Any]],
        tenant_id: str,
        topic: str = "General",
        context_text: str = "",
        count: Optional[int] = None,
        job_role: Optional[str] = None,
        tech_stack: Optional[str] = None,
        experience_level: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Returns questions:
        - If fixed question mode (School viva): uses uploaded questions directly
        - If College viva mode: uses Gemini (QUESTION_GEN_PROVIDER) to generate top 10 conceptual viva questions
          with selective probing follow-up questions
        - If Interview mode: generates questions customized to candidate's Resume and target Job Role
        """
        # Default question count per mode
        if count is None:
            count = 10 if mode == "college" else (5 if mode == "school" else 6)

        if question_source == "fixed" and uploaded_questions:
            result = []
            for idx, q in enumerate(uploaded_questions):
                result.append({
                    "order_no": idx + 1,
                    "question_text": q["question_text"],
                    "topic": q.get("topic", topic),
                    "difficulty": q.get("difficulty", "medium"),
                    "origin": "uploaded",
                    "reference_answer": q.get("reference_answer", ""),
                    "followup_question": "",
                    "followup_answer": ""
                })
            return result

        # Generated Mode (School / College / Interview)
        rag_context = self.rag.get_context_string(tenant_id, query=topic, top_k=5)
        combined_context = (context_text.strip() + "\n" + (rag_context or "")).strip() or f"Content for {topic}"

        if mode == "school":
            prompt = SCHOOL_QUESTION_GENERATION_PROMPT.format(
                topic=topic or "School Chapter Viva",
                context=combined_context[:3000],
                count=count
            )
            system_prompt = "You are a warm, encouraging School Viva Examiner for students."
        elif mode == "college":
            prompt = COLLEGE_QUESTION_GENERATION_PROMPT.format(
                topic=topic or "College Subject Viva",
                context=combined_context[:3000],
                count=count
            )
            system_prompt = "You are a senior university professor and college viva examiner."
        elif mode == "interview":
            role = job_role or topic or "Software Engineer"
            level = experience_level or "Mid-Level"
            prompt = INTERVIEW_QUESTION_GENERATION_PROMPT.format(
                job_role=role,
                experience_level=level,
                context=combined_context[:4000],
                count=count
            )
            system_prompt = f"You are an expert hiring interviewer evaluating a candidate for the {role} position based on their resume."
        else:
            prompt = QUESTION_GENERATION_PROMPT.format(
                mode=mode,
                topic=topic,
                context=combined_context[:2000],
                difficulty="adaptive",
                count=count
            )
            system_prompt = "You are an expert technical viva examiner."

        try:
            # Calls Gemini (task: question_generation) once at session start
            data = await self.llm.complete(
                task="question_generation",
                prompt=prompt,
                system_prompt=system_prompt,
                as_json=True,
            )
            generated = data.get("questions", [])
            result = []
            default_topic = topic or (job_role if mode == "interview" else "General")
            for idx, q in enumerate(generated):
                q_text = q.get("question_text", "").strip()
                if not q_text or len(q_text) < 10 or q_text.upper() in ("N/A", "NONE", "NULL", "UNDEFINED"):
                    continue
                ref_ans = q.get("reference_answer", "").strip()
                if not ref_ans or ref_ans.upper() in ("N/A", "NONE", "NULL"):
                    ref_ans = f"Comprehensive technical concepts and principles regarding {q.get('topic', default_topic)}."
                fu_q = q.get("followup_question", "").strip()
                if fu_q.upper() in ("N/A", "NONE", "NULL"):
                    fu_q = ""
                fu_ans = q.get("followup_answer", "").strip()
                if fu_ans.upper() in ("N/A", "NONE", "NULL"):
                    fu_ans = ""

                if mode in ("college", "interview"):
                    if not fu_q or len(fu_q) < 5:
                        fu_q = f"Can you elaborate on how this applies to core constraints in {q.get('topic', default_topic)}?"
                    if not fu_ans or len(fu_ans) < 5:
                        fu_ans = f"Comprehensive principles and theoretical formulations regarding {q.get('topic', default_topic)}."

                result.append({
                    "order_no": idx + 1,
                    "question_text": q_text,
                    "topic": q.get("topic", default_topic),
                    "difficulty": q.get("difficulty", "medium"),
                    "origin": "generated",
                    "reference_answer": ref_ans,
                    "followup_question": fu_q,
                    "followup_answer": fu_ans
                })

            if mode == "college" and count and len(result) < count:
                fallback_pool = self._get_college_fallback_questions(topic, count)
                existing_texts = {r["question_text"].lower() for r in result}
                for fb in fallback_pool:
                    if len(result) >= count:
                        break
                    if fb["question_text"].lower() not in existing_texts:
                        fb_copy = dict(fb)
                        fb_copy["order_no"] = len(result) + 1
                        result.append(fb_copy)

            if mode == "interview" and count and len(result) < count:
                fallback_pool = self._get_interview_fallback_questions(
                    job_role=job_role or topic or "Software Engineer",
                    tech_stack=tech_stack or "Full Stack",
                    experience_level=experience_level or "Senior",
                    count=count
                )
                existing_texts = {r["question_text"].lower() for r in result}
                for fb in fallback_pool:
                    if len(result) >= count:
                        break
                    if fb["question_text"].lower() not in existing_texts:
                        fb_copy = dict(fb)
                        fb_copy["order_no"] = len(result) + 1
                        result.append(fb_copy)

            if result:
                return result
        except Exception as e:
            if mode in ("college", "interview"):
                raise RuntimeError(f"Question generation failed for {mode} mode: {e}") from e

        # If generation returned empty questions for college/interview, fail visibly
        if mode in ("college", "interview"):
            raise RuntimeError(f"Question generation returned no valid questions for {mode} mode.")

        return self._get_college_fallback_questions(topic, count)

    def _clean_display_topic(self, raw_topic: str) -> str:
        if not raw_topic:
            return "this subject"
        clean = re.sub(r"\.[a-zA-Z0-9]+$", "", raw_topic)
        clean = re.sub(r"[_\-]+", " ", clean)
        cleaned_words = [
            w for w in clean.split()
            if w.lower() not in {"assignment", "assignments", "answer", "answers", "solution", "solutions", "notes", "manual", "doc", "pdf", "file", "unit", "chapter"}
        ]
        if cleaned_words:
            return " ".join(cleaned_words)
        return clean.strip() or "this subject"

    def _get_college_fallback_questions(self, topic: str, count: int = 10) -> List[Dict[str, Any]]:
        """Provides a structured set of top 10 viva questions with follow-ups for college subjects."""
        display_topic = self._clean_display_topic(topic)
        templates = [
            (
                f"What is the fundamental working principle and primary objective of {display_topic}?",
                "Fundamentals",
                "easy",
                f"{display_topic} provides the foundational mechanism and design framework to solve core domain constraints efficiently.",
                f"Can you state the primary mathematical or theoretical law supporting this?",
                "The core theoretical law and governing equations."
            ),
            (
                f"How is {display_topic} initialized and what are the essential setup parameters?",
                "Architecture",
                "easy",
                f"Initialization requires configuring state variables, memory buffers, and initial boundary parameters.",
                f"What happens if these initial parameters are improperly configured?",
                "The system fails to converge or throws invalid state exceptions."
            ),
            (
                f"Explain the step-by-step procedure or algorithm executed in {display_topic}.",
                "Process & Algorithm",
                "medium",
                f"The procedure begins with input ingestion, executes transformation phases in sequence, and outputs verified state.",
                f"What is the time and space complexity of this procedure?",
                "Polynomial time or optimal O(n log n) with bounded working memory."
            ),
            (
                f"What are the critical components or sub-modules involved in {display_topic} and how do they interact?",
                "Components",
                "medium",
                f"Core components interact through defined interfaces, passing synchronized data structures and control flags.",
                f"How is synchronization maintained between asynchronous sub-modules?",
                "Using semaphores, mutex locks, or event-driven message channels."
            ),
            (
                f"What is the primary difference between {display_topic} and its leading alternative approach?",
                "Comparative Analysis",
                "medium",
                f"{display_topic} prioritizes efficiency and lower latency, whereas alternate methods prioritize simplicity or lower hardware cost.",
                f"Under what specific scenario would you choose the alternative over {display_topic}?",
                "When resource constraints or throughput requirements dictate a simpler design."
            ),
            (
                f"How do you calibrate or measure accuracy, error, and performance in {display_topic}?",
                "Measurement & Calibration",
                "medium",
                f"Performance is measured via throughput, error variance, signal-to-noise ratio, or formal benchmark metrics.",
                f"What are the most frequent experimental or numerical sources of error?",
                "Quantization noise, sensor drift, precision loss, or unhandled race conditions."
            ),
            (
                f"How does {display_topic} handle edge cases, unexpected inputs, or abnormal exceptions?",
                "Exception Handling",
                "hard",
                f"Robust validation checks, exception guards, and rollback mechanisms ensure fault tolerance and graceful degradation.",
                f"Can you walk through what occurs during a partial failure cascade?",
                "The failure isolation boundaries trap the fault and trigger self-healing failovers."
            ),
            (
                f"What are the major trade-offs between performance, scalability, and complexity in {display_topic}?",
                "Trade-off Analysis",
                "hard",
                f"Increasing throughput typically increases memory footprint and algorithmic complexity.",
                f"How do you profile and detect performance bottlenecks in real time?",
                "Using tracing instrumentation, flame graphs, and latency percentiles."
            ),
            (
                f"Describe a real-world industrial or engineering application where {display_topic} is deployed.",
                "Applications",
                "hard",
                f"Widely utilized in high-throughput enterprise systems, embedded controllers, and distributed cloud services.",
                f"What modifications are necessary when scaling from a lab prototype to production?",
                "Implementing distributed load balancing, monitoring metrics, and hardened security."
            ),
            (
                f"What are the latest modern advancements or future research directions related to {display_topic}?",
                "Advanced Topics",
                "hard",
                f"Recent trends incorporate hardware acceleration, AI-driven parameter tuning, and formal verification methods.",
                f"What is the most challenging unresolved problem in this domain today?",
                "Achieving consistent low-latency consensus across untrusted asynchronous nodes."
            )
        ]

        result = []
        for idx in range(min(count, len(templates))):
            q_text, subtopic, diff, ref_ans, fu_q, fu_ans = templates[idx]
            result.append({
                "order_no": idx + 1,
                "question_text": q_text,
                "topic": f"{topic} - {subtopic}",
                "difficulty": diff,
                "origin": "generated",
                "reference_answer": ref_ans,
                "followup_question": fu_q,
                "followup_answer": fu_ans
            })
        return result

    def _get_interview_fallback_questions(
        self,
        job_role: str,
        tech_stack: str,
        experience_level: str = "Mid-Level",
        count: int = 6
    ) -> List[Dict[str, Any]]:
        """Provides a structured set of customized technical interview questions tailored to the candidate's job role and tech stack."""
        templates = [
            (
                f"In your {job_role} projects using {tech_stack}, how do you structure client and server state synchronization and avoid unnecessary re-renders or hydration mismatches?",
                "Architecture & State Management",
                "medium",
                f"State should be partitioned into server cache (e.g. React Query/RTK Query) and UI state. Hydration mismatches are avoided by ensuring initial render matches server HTML.",
                "How do you profile and eliminate performance bottlenecks or memory leaks in this setup?",
                "Using Chrome DevTools Performance tab, heap snapshots, and React Profiler."
            ),
            (
                f"Explain how your backend runtime in {tech_stack} handles asynchronous concurrency, non-blocking I/O, and CPU-intensive operations.",
                "Concurrency & Runtime",
                "medium",
                "Non-blocking I/O delegates network/file tasks to the thread pool or kernel, keeping the event loop unblocked. CPU tasks must be offloaded to worker threads.",
                "What occurs when the event loop or thread pool becomes saturated under heavy traffic?",
                "Latency spikes sharply and incoming requests queue up until connection timeouts occur."
            ),
            (
                f"When working with your database layer in {tech_stack}, how do you optimize slow queries, choose index types, and manage transaction isolation?",
                "Database & Transactions",
                "hard",
                "Index selectivity, B-tree composite indexes, avoiding N+1 queries, and using Read Committed vs Serializable isolation depending on race condition tolerance.",
                "How do you detect and recover from deadlock conditions between concurrent transactions?",
                "Transaction retry loops with exponential backoff and lock order consistency."
            ),
            (
                f"How do you design and secure API communication (REST, GraphQL, or gRPC) in {tech_stack} for idempotency, rate limiting, and caching?",
                "API Design & Caching",
                "medium",
                "Idempotency keys on state-mutating requests, token bucket or sliding window rate limiting in Redis, and HTTP cache headers like ETag.",
                "How do you mitigate the thundering herd problem when a popular cached resource expires?",
                "Probabilistic early expiration (XFetch) or mutex locks on cache repopulation."
            ),
            (
                f"Walk me through your resilience pattern for handling downstream service failures or network latency spikes in a {job_role} application.",
                "Resilience & Scalability",
                "hard",
                "Implementing circuit breakers, fallback responses, timeout bounds, and dead-letter queues to maintain partial availability.",
                "How do you maintain data consistency across distributed services if one node fails mid-operation?",
                "Using the Saga pattern (orchestrated or choreographed) with compensating transactions."
            ),
            (
                f"How do you enforce authentication, token revocation, and secure secret storage across your {tech_stack} deployment pipeline?",
                "Security & Production Engineering",
                "hard",
                "Short-lived access tokens, refresh tokens with rotation and revocation lists, HTTPS/HSTS, CSRF tokens, and secret managers like AWS Secrets Manager or Vault.",
                "What is your immediate incident response if an active JWT secret is leaked?",
                "Immediately rotate the signing key in secret manager and invalidate all active session tokens."
            ),
            (
                f"For a {job_role}, how do you establish automated testing, CI/CD pipelines, and zero-downtime blue/green or canary releases?",
                "CI/CD & Deployment",
                "medium",
                "Automated test gates (unit, integration, e2e), containerized Docker builds, and Kubernetes rolling updates or traffic shifting with Canary deployments.",
                "What automated metrics would trigger an automatic rollback during a canary release?",
                "Error rate exceeding 1% or p99 latency spiking above predefined SLO thresholds."
            )
        ]

        result = []
        for idx in range(min(count, len(templates))):
            q_text, subtopic, diff, ref_ans, fu_q, fu_ans = templates[idx]
            result.append({
                "order_no": idx + 1,
                "question_text": q_text,
                "topic": f"{job_role} - {subtopic}",
                "difficulty": diff,
                "origin": "generated",
                "reference_answer": ref_ans,
                "followup_question": fu_q,
                "followup_answer": fu_ans
            })
        return result

question_agent = QuestionAgent()
