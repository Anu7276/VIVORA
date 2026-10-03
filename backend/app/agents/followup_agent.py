from typing import Dict, Any, Optional
from app.agents.base import BaseAgent
from app.llm.prompts import FOLLOWUP_PROMPT
from app.llm.guardrails import Guardrails

class FollowupAgent(BaseAgent):
    """
    Follow-up Agent (Active in College and Interview modes):
    Probes deeper with 'why did you say this?', finds gaps, and asks adaptive follow-ups.
    """
    def __init__(self):
        super().__init__("FollowupAgent")

    async def generate_followup(
        self,
        question_text: str,
        answer_transcript: str,
        missing_concepts: str = ""
    ) -> Optional[Dict[str, Any]]:
        if not answer_transcript or len(answer_transcript.split()) < 3:
            return None

        clean_question = Guardrails.sanitize_input(question_text)
        clean_answer = Guardrails.sanitize_input(answer_transcript)

        prompt = FOLLOWUP_PROMPT.format(
            question_text=clean_question,
            answer_transcript=clean_answer,
            missing_concepts=missing_concepts or "underlying mechanism and reason"
        )

        try:
            followup_text = await self.llm.complete(
                task="live_turn",
                prompt=prompt,
                system_prompt="You are a follow-up interviewer probing deeper on technical concepts.",
            )
            if not followup_text or not followup_text.strip():
                return None
            return {
                "question_text": followup_text.strip(),
                "difficulty": "hard",
                "origin": "follow_up",
                "reference_answer": ""  # Leave empty so evaluator uses RAG context
            }
        except Exception:
            return None

followup_agent = FollowupAgent()
