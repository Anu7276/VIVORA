import json
import logging
from typing import Dict, Any, List
from app.agents.base import BaseAgent
from app.llm.prompts import REPORT_PROMPT

logger = logging.getLogger("vivora.report_agent")


class ReportAgent(BaseAgent):
    """
    Report Agent:
    Generates final overall score, topic breakdowns, strengths, improvement areas,
    and a prioritized revision plan.

    Rules (Phase 3):
    - Report overall_score = exact mean of scored answers computed IN CODE (never from the LLM).
    - The LLM may only write strengths/improvements/revision_plan text.
    - If fewer than 50% of answers are scored, say so prominently in scoring_note and mark report partial.
    - If the report LLM fails, return numeric summary with text sections empty and a clear note, not generic praise.
    """
    def __init__(self):
        super().__init__("ReportAgent")

    async def generate_report(self, mode: str, evaluations: List[Dict[str, Any]]) -> Dict[str, Any]:
        total_evals = len(evaluations)
        if total_evals == 0:
            return {
                "overall_score": 0.0,
                "status": "complete",
                "strengths": [],
                "improvements": ["No answered questions to score"],
                "revision_plan": ["Complete a full practice viva session"],
                "topic_scores": [],
                "scoring_note": "No answers were submitted.",
                "mock_scored_count": 0,
            }

        # Filter scored answers
        scored_evals = [
            e for e in evaluations
            if e.get("scored", True) is not False and e.get("overall_score") is not None
        ]
        scored_count = len(scored_evals)

        # Exact arithmetic mean of scored answers computed IN CODE
        if scored_count > 0:
            avg_score = round(sum(float(e["overall_score"]) for e in scored_evals) / scored_count, 1)
        else:
            avg_score = 0.0

        # Check partial status: fewer than 50% of answers scored
        is_partial = scored_count < (total_evals / 2.0)
        report_status = "partial" if is_partial else "complete"

        # Topic scores computed in code
        topic_map: Dict[str, List[float]] = {}
        for e in scored_evals:
            top = e.get("topic") or "General"
            topic_map.setdefault(top, []).append(float(e["overall_score"]))

        topic_scores = []
        for top, sc_list in topic_map.items():
            top_avg = round(sum(sc_list) / len(sc_list), 1)
            topic_scores.append({
                "topic": top,
                "score": top_avg,
                "level": "strong" if top_avg >= 7.5 else ("average" if top_avg >= 5.0 else "needs_improvement")
            })

        # Scoring note
        mock_evals = [e for e in evaluations if e.get("_is_mock", False)]
        mock_scored_count = len(mock_evals)
        mock_labels = [f"Q{e.get('order_no', idx + 1)}" for idx, e in enumerate(evaluations) if e.get("_is_mock", False)]
        mock_suffix = f" for {', '.join(mock_labels)}" if mock_labels else ""

        if is_partial:
            scoring_note = (
                f"⚠️ Partial report: Only {scored_count} of {total_evals} answers could be scored by AI. "
                "Scores may not reflect overall subject mastery."
            )
            if mock_scored_count > 0:
                scoring_note += f" Rule-based fallback used{mock_suffix} (provisional scores)."
        elif mock_scored_count > 0:
            scoring_note = (
                f"⚠️ {mock_scored_count} of {total_evals} turns{mock_suffix} were scored using rule-based fallback (provisional scores)."
            )
        else:
            scoring_note = "All evaluations AI-scored."

        evals_summary = [
            {
                "question": e.get("question_text", ""),
                "topic": e.get("topic", "General"),
                "score": e.get("overall_score"),
                "scored": e.get("scored", True),
                "feedback": e.get("feedback", ""),
                "missing": e.get("missing_concepts", ""),
            }
            for e in evaluations
        ]

        prompt = REPORT_PROMPT.format(
            mode=mode,
            evaluations_json=json.dumps(evals_summary, indent=2)
        )

        try:
            report_data = await self.llm.complete(
                task="report",
                prompt=prompt,
                system_prompt="You are an analytical educational report generator. Output strictly JSON.",
                as_json=True,
            )
            if not isinstance(report_data, dict):
                raise ValueError("LLM report output is not a valid dictionary")

            # Always override overall_score with the exact code-computed mean
            report_data["overall_score"] = avg_score
            report_data["status"] = report_status
            report_data["scoring_note"] = scoring_note
            report_data["mock_scored_count"] = mock_scored_count
            if not report_data.get("topic_scores"):
                report_data["topic_scores"] = topic_scores

            # Clean internal meta keys
            report_data.pop("_provider", None)
            report_data.pop("_is_mock", None)
            return report_data

        except Exception as e:
            logger.warning(f"Report LLM generation failed: {e}. Returning numeric summary only.")
            return {
                "overall_score": avg_score,
                "status": report_status,
                "strengths": [],
                "improvements": [],
                "revision_plan": [],
                "topic_scores": topic_scores,
                "mock_scored_count": mock_scored_count,
                "scoring_note": (
                    f"{scoring_note} (AI report text generation was unavailable)."
                ).strip(),
            }


report_agent = ReportAgent()
