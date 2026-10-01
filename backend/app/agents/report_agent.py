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
        mock_scored_count = 0
        for e in evaluations:
            overall = e.get("overall_score", 0.0)
            scores.append(overall)
            if e.get("_is_mock", False):
                mock_scored_count += 1
            evals_summary.append({
                "question": e.get("question_text"),
                "topic": e.get("topic", "General"),
                "score": overall,
                "feedback": e.get("feedback"),
                "missing": e.get("missing_concepts"),
                "ai_scored": not e.get("_is_mock", False),
            })

        avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0

        # Build a scoring quality note for the report
        if mock_scored_count == 0:
            scoring_note = "All evaluations AI-scored."
        elif mock_scored_count == len(evaluations):
            scoring_note = (
                "⚠️ Scores are rule-based estimates only (AI providers were unavailable). "
                "Treat scores as approximate indicators, not certified grades."
            )
        else:
            scoring_note = (
                f"⚠️ {mock_scored_count} of {len(evaluations)} evaluation(s) used "
                f"rule-based scoring (AI provider was unavailable for those turns)."
            )

        prompt = REPORT_PROMPT.format(
            mode=mode,
            evaluations_json=json.dumps(evals_summary, indent=2)
        )

        try:
            report_data = await self.llm.complete(
                task="report",
                prompt=prompt,
                system_prompt="You are an analytical educational report generator.",
                as_json=True,
            )
            report_data.pop("_provider", None)
            report_data.pop("_is_mock", None)
            if "overall_score" not in report_data or report_data["overall_score"] == 0:
                report_data["overall_score"] = avg_score
            report_data["mock_scored_count"] = mock_scored_count
            report_data["scoring_note"] = scoring_note
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
                    {
                        "topic": e.get("topic", "General"),
                        "score": e.get("overall_score", avg_score),
                        "level": "strong" if e.get("overall_score", 7) >= 7.5 else "average"
                    }
                    for e in evaluations
                ],
                "mock_scored_count": mock_scored_count,
                "scoring_note": scoring_note,
            }

report_agent = ReportAgent()
