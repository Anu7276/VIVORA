from typing import Dict, Any
from app.agents.base import BaseAgent
from app.llm.prompts import DOUBT_PROMPT
from app.voice.tts_stream import tts_router


class DoubtAgent(BaseAgent):
    """
    Doubt Agent:
    Activated when a student asks a doubt ("Can you explain why...", "I don't understand...").
    Retrieves grounded context from uploaded material and explains clearly.
    Enforces topic boundary restrictions and never returns canned text on failure.
    """
    def __init__(self):
        super().__init__("DoubtAgent")
        self.tts = tts_router

    async def answer_doubt(self, tenant_id: str, doubt_query: str, mode: str = "school") -> Dict[str, Any]:
        context = self.rag.get_context_string(tenant_id, query=doubt_query, top_k=3)

        delimited_doubt = f"<student_doubt>\n{doubt_query[:500]}\n</student_doubt>"
        delimited_context = f"<subject_context>\n{(context or 'General textbook subject knowledge')[:3000]}\n</subject_context>"

        prompt = DOUBT_PROMPT.format(
            student_doubt=delimited_doubt,
            context=delimited_context
        )

        if mode == "school":
            system_prompt = (
                "You are an encouraging, patient teacher for a school student. "
                "Answer doubts strictly restricted to the provided subject matter and syllabus. "
                "Politely refuse off-topic, harmful, or unrelated requests with: "
                "'I can only help with questions related to your syllabus topic.' "
                "Keep the tone age-appropriate, simple, and encouraging."
            )
        else:
            system_prompt = (
                "You are an expert technical interviewer and academic instructor. "
                "Answer doubts strictly grounded in the subject matter. "
                "Refuse off-topic or out-of-scope queries politely."
            )

        explanation = await self.llm.complete(
            task="live_turn",
            prompt=prompt,
            system_prompt=system_prompt,
        )
        if not explanation or not explanation.strip():
            raise RuntimeError("Failed to generate doubt explanation.")

        clean_explanation = explanation.strip()

        tts_event = await self.tts.synthesize(
            text=clean_explanation,
            voice_settings={"mode": mode, "lang": "en-IN"}
        )

        return {
            "doubt_query": doubt_query,
            "explanation": clean_explanation,
            "tts_payload": tts_event
        }


doubt_agent = DoubtAgent()
