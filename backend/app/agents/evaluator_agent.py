from typing import Dict, Any
from app.agents.base import BaseAgent
from app.llm.prompts import EVALUATOR_RUBRIC_PROMPT

class EvaluatorAgent(BaseAgent):
    """
    Evaluator Agent:
    Scores each spoken answer on Correctness, Depth, and Clarity using a rubric and RAG reference context.
    Tolerates STT errors, filler words, and conversational hesitations.
    """
    def __init__(self):
        super().__init__("EvaluatorAgent")

    async def evaluate_answer(
        self,
        tenant_id: str,
        question_text: str,
        answer_transcript: str,
        reference_answer: str = "",
        mode: str = "school"
    ) -> Dict[str, Any]:
        # Fetch RAG context if reference_answer is sparse
        rag_context = self.rag.get_context_string(tenant_id, query=question_text, top_k=2)
        effective_reference = reference_answer or rag_context or f"Textbook explanation of {question_text}"

        prompt = EVALUATOR_RUBRIC_PROMPT.format(
            mode=mode,
            question_text=question_text,
            answer_transcript=answer_transcript or "(No answer spoken)",
            reference_answer=effective_reference
        )

        try:
            eval_res = await self.llm.complete(
                task="evaluation",
                prompt=prompt,
                system_prompt="You are an expert, encouraging viva examination evaluator.",
                as_json=True,
            )
            is_mock = eval_res.pop("_is_mock", False)
            provider = eval_res.pop("_provider", "unknown")
            return {
                "correctness_score": float(eval_res.get("correctness_score", 7.0)),
                "depth_score": float(eval_res.get("depth_score", 7.0)),
                "clarity_score": float(eval_res.get("clarity_score", 7.5)),
                "overall_score": float(eval_res.get("overall_score", 7.2)),
                "feedback": eval_res.get("feedback", "Good effort!"),
                "missing_concepts": eval_res.get("missing_concepts", ""),
                "model_answer": eval_res.get("model_answer", effective_reference),
                "_provider": provider,
                "_is_mock": is_mock,
            }
        except Exception as e:
            return {
                "correctness_score": 7.0,
                "depth_score": 6.5,
                "clarity_score": 7.5,
                "overall_score": 7.0,
                "feedback": "Answer recorded successfully. Good conceptual understanding.",
                "missing_concepts": "Detailed technical terms",
                "model_answer": effective_reference,
                "_provider": "mock",
                "_is_mock": True,
            }

evaluator_agent = EvaluatorAgent()
