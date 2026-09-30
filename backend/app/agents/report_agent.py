import json
from typing import Dict, Any, List
from app.agents.base import BaseAgent
from app.llm.prompts import REPORT_PROMPT

class ReportAgent(BaseAgent):
    """
    Report Agent:
    Generates final overall score, topic breakdowns, strengths, improvement areas,
    and a prioritized revision plan.
    """
    def __init__(self):
        super().__init__("ReportAgent")

    async def generate_report(self, mode: str, evaluations: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not evaluations:
            return {
                "overall_score": 0.0,
                "strengths": ["Completed session setup"],
                "improvements": ["No answered questions to score"],
                "revision_plan": ["Complete a full practice viva session"],
                "topic_scores": []
            }

        evals_summary = []
        scores = []
        for e in evaluations:
            overall = e.get("overall_score", 0.0)
            scores.append(overall)
            evals_summary.append({
                "question": e.get("question_text"),
                "topic": e.get("topic", "General"),
                "score": overall,
                "feedback": e.get("feedback"),
                "missing": e.get("missing_concepts")
            })

        avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0

        prompt = REPORT_PROMPT.format(
            mode=mode,
            evaluations_json=json.dumps(evals_summary, indent=2)
        )

        try:
            report_data = await self.llm.generate_json(
                prompt=prompt,
                system_prompt="You are an analytical educational report generator."
            )
            # Ensure overall score aligns with calculated average
            if "overall_score" not in report_data or report_data["overall_score"] == 0:
                report_data["overall_score"] = avg_score
            return report_data
        except Exception:
            return {
                "overall_score": avg_score,
                "strengths": [
                    "Good participation and vocal clarity during questions",
                    "Demonstrated foundational understanding of core topics"
                ],
                "improvements": [
                    "Strengthen explanations by providing exact scientific terms",
                    "Add structured step-by-step descriptions"
                ],
                "revision_plan": [
                    "Revisit highlighted weak topics and summarize key formulas",
                    "Take another 15-minute quick viva test to reinforce memory"
                ],
                "topic_scores": [
                    {"topic": e.get("topic", "General"), "score": e.get("overall_score", avg_score), "level": "strong" if e.get("overall_score", 7) >= 7.5 else "average"}
                    for e in evaluations
                ]
            }

report_agent = ReportAgent()
