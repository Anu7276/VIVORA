from typing import Dict, Any, List, Optional
from app.services.mode_strategy import ModeStrategy
from app.agents.intake_agent import intake_agent
from app.agents.question_agent import question_agent
from app.agents.interviewer_agent import interviewer_agent
from app.agents.evaluator_agent import evaluator_agent
from app.agents.doubt_agent import doubt_agent
from app.agents.followup_agent import followup_agent
from app.agents.report_agent import report_agent

class Orchestrator:
    """
    Central Orchestrator:
    Reads mode and session parameters, activating the needed agents only on demand.
    Ensures seamless execution across School Fixed, College Deep, and Interview Adaptive modes.
    """
    def __init__(self):
        self.intake = intake_agent
        self.question = question_agent
        self.interviewer = interviewer_agent
        self.evaluator = evaluator_agent
        self.doubt = doubt_agent
        self.followup = followup_agent
        self.report = report_agent

    async def ingest_material(self, tenant_id: str, title: str, text: str, doc_type: str = "questions") -> Dict[str, Any]:
        return await self.intake.process_document(
            tenant_id=tenant_id,
            title=title,
            text=text,
            doc_type=doc_type
        )

    async def initialize_questions(
        self,
        mode: str,
        question_source: str,
        uploaded_questions: List[Dict[str, Any]],
        tenant_id: str,
        topic: str = "General",
        context_text: str = "",
        count: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        return await self.question.get_questions(
            mode=mode,
            question_source=question_source,
            uploaded_questions=uploaded_questions,
            tenant_id=tenant_id,
            topic=topic,
            context_text=context_text,
            count=count
        )

    async def prepare_interviewer_turn(self, question: Dict[str, Any], mode: str) -> Dict[str, Any]:
        return await self.interviewer.prepare_speech(question=question, mode=mode)

    async def evaluate_turn(
        self,
        tenant_id: str,
        question_text: str,
        answer_transcript: str,
        reference_answer: str,
        mode: str,
        planned_followup: Optional[str] = None,
        planned_followup_answer: Optional[str] = None
    ) -> Dict[str, Any]:
        cfg = ModeStrategy.get_config(mode)
        
        # 1. Score answer with Evaluator Agent
        eval_result = await self.evaluator.evaluate_answer(
            tenant_id=tenant_id,
            question_text=question_text,
            answer_transcript=answer_transcript,
            reference_answer=reference_answer,
            mode=mode
        )

        follow_up_question = None
        # 2. If College or Interview mode, trigger Follow-up Agent
        if cfg.allow_followups and eval_result.get("overall_score", 0) < 8.5:
            if planned_followup and len(planned_followup.strip()) > 5:
                follow_up_question = {
                    "question_text": planned_followup.strip(),
                    "difficulty": "hard",
                    "origin": "follow_up",
                    "reference_answer": planned_followup_answer or f"Follow-up context for {question_text}"
                }
            else:
                follow_up_question = await self.followup.generate_followup(
                    question_text=question_text,
                    answer_transcript=answer_transcript,
                    missing_concepts=eval_result.get("missing_concepts", "")
                )

        return {
            "evaluation": eval_result,
            "follow_up": follow_up_question
        }

    async def handle_doubt(self, tenant_id: str, doubt_query: str, mode: str) -> Dict[str, Any]:
        return await self.doubt.answer_doubt(
            tenant_id=tenant_id,
            doubt_query=doubt_query,
            mode=mode
        )

    async def generate_final_report(self, mode: str, evaluations: List[Dict[str, Any]]) -> Dict[str, Any]:
        return await self.report.generate_report(mode=mode, evaluations=evaluations)

orchestrator = Orchestrator()
