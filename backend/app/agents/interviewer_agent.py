from typing import Dict, Any
from app.agents.base import BaseAgent
from app.voice.tts_stream import tts_router

class InterviewerAgent(BaseAgent):
    """
    Interviewer Agent:
    - Runs the live conversation turn, asking one short speakable question at a time.
    - Adjusts tone and pacing to match student mode (warm/encouraging for School, balanced for College, sharp for Interview).
    """
    def __init__(self):
        super().__init__("InterviewerAgent")
        self.tts = tts_router

    async def prepare_speech(self, question: Dict[str, Any], mode: str = "school") -> Dict[str, Any]:
        question_text = question["question_text"]
        order_no = question.get("order_no", 1)

        # Conversational speakable prefix based on mode
        if mode == "school":
            speakable_text = f"Question number {order_no}. {question_text}"
        elif mode == "college":
            speakable_text = f"Moving on to question {order_no}. {question_text}"
        else:
            speakable_text = f"Question {order_no}: {question_text}"

        tts_event = await self.tts.synthesize(
            text=speakable_text,
            voice_settings={"mode": mode, "lang": "en-IN"}
        )

        return {
            "order_no": order_no,
            "question_id": question.get("id"),
            "question_text": question_text,
            "speakable_text": speakable_text,
            "tts_payload": tts_event,
            "topic": question.get("topic", "General"),
            "difficulty": question.get("difficulty", "medium")
        }

interviewer_agent = InterviewerAgent()
