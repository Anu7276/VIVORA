from typing import List, Dict, Any, Optional
from app.agents.base import BaseAgent
from app.llm.prompts import QUESTION_GENERATION_PROMPT, COLLEGE_QUESTION_GENERATION_PROMPT

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
        count: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Returns questions:
        - If fixed question mode (School viva): uses uploaded questions directly
        - If College viva mode: uses Gemini (QUESTION_GEN_PROVIDER) to collect top 10 questions
          along with expected answers and probing follow-up questions
        - If Interview mode: generates adaptive scenario & technical questions
        """
        # Default question count per mode
        if count is None:
            count = 10 if mode == "college" else 5

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
                    "followup_question": q.get("followup_question", ""),
                    "followup_answer": q.get("followup_answer", "")
                })
            return result

        # Generated Mode (College / Interview)
        rag_context = self.rag.get_context_string(tenant_id, query=topic, top_k=5)
        combined_context = (context_text.strip() + "\n" + (rag_context or "")).strip() or f"Syllabus topics for {topic}"

        if mode == "college":
            prompt = COLLEGE_QUESTION_GENERATION_PROMPT.format(
                topic=topic,
                context=combined_context[:3000],
                count=count
            )
        else:
            prompt = QUESTION_GENERATION_PROMPT.format(
                mode=mode,
                topic=topic,
                context=combined_context[:2000],
                difficulty="adaptive",
                count=count
            )

        try:
            # Calls Gemini (task: question_generation) once at session start
            data = await self.llm.complete(
                task="question_generation",
                prompt=prompt,
                system_prompt="You are a senior university professor and college viva examiner.",
                as_json=True,
            )
            generated = data.get("questions", [])
            result = []
            for idx, q in enumerate(generated):
                q_text = q.get("question_text", "").strip()
                if not q_text:
                    continue
                result.append({
                    "order_no": idx + 1,
                    "question_text": q_text,
                    "topic": q.get("topic", topic),
                    "difficulty": q.get("difficulty", "medium"),
                    "origin": "generated",
                    "reference_answer": q.get("reference_answer", f"Standard model answer for {q_text}"),
                    "followup_question": q.get("followup_question", f"Why is that principle important in practical systems?"),
                    "followup_answer": q.get("followup_answer", f"Detailed practical mechanism and reasoning.")
                })
            if result:
                return result
        except Exception as e:
            pass

        # Fallback default questions for College Viva (Top 10 practical & theoretical questions)
        return self._get_college_fallback_questions(topic, count)

    def _get_college_fallback_questions(self, topic: str, count: int = 10) -> List[Dict[str, Any]]:
        """Provides a structured set of top 10 viva questions with follow-ups for college subjects."""
        templates = [
            (
                f"What is the fundamental working principle and primary objective of {topic}?",
                "Fundamentals",
                "easy",
                f"{topic} provides the foundational mechanism and design framework to solve core domain constraints efficiently.",
                f"Can you state the primary mathematical or theoretical law supporting this?",
                "The core theoretical law and governing equations."
            ),
            (
                f"How is {topic} initialized and what are the essential setup parameters?",
                "Architecture",
                "easy",
                f"Initialization requires configuring state variables, memory buffers, and initial boundary parameters.",
                f"What happens if these initial parameters are improperly configured?",
                "The system fails to converge or throws invalid state exceptions."
            ),
            (
                f"Explain the step-by-step procedure or algorithm executed in {topic}.",
                "Process & Algorithm",
                "medium",
                f"The procedure begins with input ingestion, executes transformation phases in sequence, and outputs verified state.",
                f"What is the time and space complexity of this procedure?",
                "Polynomial time or optimal O(n log n) with bounded working memory."
            ),
            (
                f"What are the critical components or sub-modules involved in {topic} and how do they interact?",
                "Components",
                "medium",
                f"Core components interact through defined interfaces, passing synchronized data structures and control flags.",
                f"How is synchronization maintained between asynchronous sub-modules?",
                "Using semaphores, mutex locks, or event-driven message channels."
            ),
            (
                f"What is the primary difference between {topic} and its leading alternative approach?",
                "Comparative Analysis",
                "medium",
                f"{topic} prioritizes efficiency and lower latency, whereas alternate methods prioritize simplicity or lower hardware cost.",
                f"Under what specific scenario would you choose the alternative over {topic}?",
                "When resource constraints or throughput requirements dictate a simpler design."
            ),
            (
                f"How do you calibrate or measure accuracy, error, and performance in {topic}?",
                "Measurement & Calibration",
                "medium",
                f"Performance is measured via throughput, error variance, signal-to-noise ratio, or formal benchmark metrics.",
                f"What are the most frequent experimental or numerical sources of error?",
                "Quantization noise, sensor drift, precision loss, or unhandled race conditions."
            ),
            (
                f"How does {topic} handle edge cases, unexpected inputs, or abnormal exceptions?",
                "Exception Handling",
                "hard",
                f"Robust validation checks, exception guards, and rollback mechanisms ensure fault tolerance and graceful degradation.",
                f"Can you walk through what occurs during a partial failure cascade?",
                "The failure isolation boundaries trap the fault and trigger self-healing failovers."
            ),
            (
                f"What are the major trade-offs between performance, scalability, and complexity in {topic}?",
                "Trade-off Analysis",
                "hard",
                f"Increasing throughput typically increases memory footprint and algorithmic complexity.",
                f"How do you profile and detect performance bottlenecks in real time?",
                "Using tracing instrumentation, flame graphs, and latency percentiles."
            ),
            (
                f"Describe a real-world industrial or engineering application where {topic} is deployed.",
                "Applications",
                "hard",
                f"Widely utilized in high-throughput enterprise systems, embedded controllers, and distributed cloud services.",
                f"What modifications are necessary when scaling from a lab prototype to production?",
                "Implementing distributed load balancing, monitoring metrics, and hardened security."
            ),
            (
                f"What are the latest modern advancements or future research directions related to {topic}?",
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

question_agent = QuestionAgent()
