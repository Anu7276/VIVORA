from typing import Dict, Any
from app.agents.base import BaseAgent
from app.llm.prompts import DOUBT_PROMPT
from app.voice.tts_stream import tts_router

class DoubtAgent(BaseAgent):
    """
    Doubt Agent:
    Activated when a student asks a doubt ("Can you explain why...", "I don't understand...").
    Retrieves grounded context from uploaded material and explains clearly.
    """
    def __init__(self):
        super().__init__("DoubtAgent")
        self.tts = tts_router

    async def answer_doubt(self, tenant_id: str, doubt_query: str, mode: str = "school") -> Dict[str, Any]:
        context = self.rag.get_context_string(tenant_id, query=doubt_query, top_k=3)
        prompt = DOUBT_PROMPT.format(
            student_doubt=doubt_query,
            context=context or "General textbook knowledge"
        )

        try:
            explanation = await self.llm.generate_text(
                prompt=prompt,
                system_prompt="You are an encouraging and knowledgeable teacher helping a student."
            )
        except Exception:
            explanation = f"That's a great question about '{doubt_query}'. In short, it relates to the foundational principles in your syllabus."

        tts_event = await self.tts.synthesize(
            text=explanation,
            voice_settings={"mode": mode, "lang": "en-IN"}
        )

        return {
            "doubt_query": doubt_query,
            "explanation": explanation,
            "tts_payload": tts_event
        }

doubt_agent = DoubtAgent()
