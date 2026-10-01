from typing import List, Dict, Any, Optional
from app.agents.base import BaseAgent
from app.llm.prompts import QUESTION_GENERATION_PROMPT

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
        count: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Returns questions:
        - If fixed question mode (School viva): uses uploaded questions directly
        - If generated question mode: generates topic & difficulty adaptive questions using RAG context
        """
        if question_source == "fixed" and uploaded_questions:
            result = []
            for idx, q in enumerate(uploaded_questions):
                result.append({
                    "order_no": idx + 1,
                    "question_text": q["question_text"],
                    "topic": q.get("topic", topic),
                    "difficulty": q.get("difficulty", "medium"),
                    "origin": "uploaded",
                    "reference_answer": q.get("reference_answer", "")
                })
            return result

        # Generated Mode (College / Interview)
        rag_context = self.rag.get_context_string(tenant_id, query=topic, top_k=3)
        prompt = QUESTION_GENERATION_PROMPT.format(
            mode=mode,
            topic=topic,
            context=rag_context or "General syllabus topics",
            difficulty="adaptive",
            count=count
        )

        try:
            data = await self.llm.complete(
                task="question_generation",
                prompt=prompt,
                system_prompt="You are a viva question generation agent.",
                as_json=True,
            )
            generated = data.get("questions", [])
            result = []
            for idx, q in enumerate(generated):
                result.append({
                    "order_no": idx + 1,
                    "question_text": q.get("question_text", f"Explain the key concepts of {topic}"),
                    "topic": q.get("topic", topic),
                    "difficulty": q.get("difficulty", "medium"),
                    "origin": "generated",
                    "reference_answer": q.get("reference_answer", "")
                })
            return result
        except Exception as e:
            # Fallback default questions
            return [
                {
                    "order_no": 1,
                    "question_text": f"What is the basic definition and purpose of {topic}?",
                    "topic": topic,
                    "difficulty": "easy",
                    "origin": "generated",
                    "reference_answer": f"Standard core definition for {topic}"
                },
                {
                    "order_no": 2,
                    "question_text": f"Can you describe how {topic} works in practice?",
                    "topic": topic,
                    "difficulty": "medium",
                    "origin": "generated",
                    "reference_answer": f"Mechanism and practical workings of {topic}"
                }
            ]

question_agent = QuestionAgent()
