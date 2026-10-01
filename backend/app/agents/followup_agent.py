from typing import Dict, Any, Optional
from app.agents.base import BaseAgent
from app.llm.prompts import FOLLOWUP_PROMPT

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

        prompt = FOLLOWUP_PROMPT.format(
            question_text=question_text,
            answer_transcript=answer_transcript,
            missing_concepts=missing_concepts or "underlying mechanism and reason"
        )

        try:
            followup_text = await self.llm.complete(
                task="live_turn",
                prompt=prompt,
                system_prompt="You are a follow-up interviewer probing deeper on technical concepts.",
            )
            return {
                "question_text": followup_text.strip(),
                "difficulty": "hard",
                "origin": "follow_up",
                "reference_answer": f"Detailed technical follow-up context for {question_text}"
            }
        except Exception:
            return {
                "question_text": f"Why is that the case, and how does it behave in edge cases?",
                "difficulty": "hard",
                "origin": "follow_up",
                "reference_answer": "Deeper mechanism"
            }

followup_agent = FollowupAgent()
