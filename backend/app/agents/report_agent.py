import json
import logging
from typing import Dict, Any, List, Optional
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

    async def generate_report(
        self,
        mode: str,
        evaluations: List[Dict[str, Any]],
        total_planned_questions: Optional[int] = None
    ) -> Dict[str, Any]:
        total_evals = len(evaluations)
        total_planned = total_planned_questions or total_evals

        if total_planned == 0:
            return {
                "overall_score": 0.0,
                "status": "incomplete",
                "strengths": [],
                "improvements": ["No answered questions to score"],
                "revision_plan": ["Complete a full practice viva session"],
                "topic_scores": [],
                "scoring_note": "No answers were submitted.",
                "mock_scored_count": 0,
            }

        # Filter legitimately answered answers (excluding skipped / empty answers)
        answered_evals = [
            e for e in evaluations
            if e.get("scored", True) is not False 
            and e.get("overall_score") is not None
            and not e.get("is_skipped", False)
            and e.get("feedback") != "Question was skipped or unanswered."
            and e.get("feedback") != "No answer provided."
        ]
        answered_count = len(answered_evals)

        # Scored answers include answered questions (skipped count as 0.0)
        scored_evals = [
            e for e in evaluations
            if e.get("scored", True) is not False and e.get("overall_score") is not None
        ]
        score_sum = sum(float(e["overall_score"]) for e in scored_evals)

        # Overall score = sum of scores / total planned questions (skipped/unanswered count as 0)
        avg_score = round(score_sum / max(total_planned, 1), 1)

        # Status: If fewer than 50% of planned questions were answered, mark "incomplete"
        is_incomplete = answered_count < (total_planned / 2.0)
        report_status = "incomplete" if is_incomplete else "complete"

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

        if is_incomplete:
            scoring_note = (
                f"⚠️ Incomplete session: Only {answered_count} of {total_planned} planned questions were answered. "
                "Unanswered questions count as 0 in the overall score."
            )
            if mock_scored_count > 0:
                scoring_note += f" Rule-based fallback used{mock_suffix} (provisional scores)."
        elif mock_scored_count > 0:
            scoring_note = (
                f"⚠️ {mock_scored_count} of {total_evals} turns{mock_suffix} were scored using rule-based fallback (provisional scores)."
            )
        else:
            scoring_note = "All evaluations AI-scored."

        # Communication score and metrics for Interview mode
        comm_metrics = None
        if mode == "interview":
            comm_metrics = self._compute_communication_metrics(evaluations)

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

            if comm_metrics:
                report_data["communication_score"] = comm_metrics["communication_score"]
                report_data["communication_breakdown"] = comm_metrics["communication_breakdown"]
                report_data["communication_feedback"] = comm_metrics["communication_breakdown"]["explanation"]

            # Clean internal meta keys
            report_data.pop("_provider", None)
            report_data.pop("_is_mock", None)
            return report_data

        except Exception as e:
            logger.warning(f"Report LLM generation failed: {e}. Returning numeric summary only.")
            res = {
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
            if comm_metrics:
                res["communication_score"] = comm_metrics["communication_score"]
                res["communication_breakdown"] = comm_metrics["communication_breakdown"]
                res["communication_feedback"] = comm_metrics["communication_breakdown"]["explanation"]
            return res

    @staticmethod
    def _compute_communication_metrics(evaluations: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Computes server-authoritative communication metrics for candidate interviews:
        - Filler words per 100 words
        - Speaking pace (words per minute)
        - Answer length appropriateness
        - Structure heuristic (transitions, argumentation)
        """
        total_words = 0
        total_fillers = 0
        total_duration = 0.0
        structure_hits = 0
        evaluated_turns = 0

        structure_keywords = {
            "firstly", "secondly", "thirdly", "furthermore", "moreover", "in addition",
            "for example", "for instance", "such as", "because", "therefore", "as a result",
            "however", "on the other hand", "trade-off", "tradeoff", "alternatively", "in conclusion"
        }

        for e in evaluations:
            transcript = e.get("student_transcript") or e.get("transcript") or ""
            words = transcript.lower().split()
            w_count = len(words)
            if w_count == 0:
                continue

            evaluated_turns += 1
            total_words += w_count
            duration = float(e.get("duration_sec") or 0)
            total_duration += duration
            fillers = int(e.get("filler_count") or 0)
            total_fillers += fillers

            for kw in structure_keywords:
                if kw in transcript.lower():
                    structure_hits += 1
                    break

        if total_words == 0:
            return {
                "communication_score": 0.0,
                "communication_breakdown": {
                    "filler_rate_per_100_words": 0.0,
                    "speaking_pace_wpm": 0.0,
                    "length_appropriateness_score": 0.0,
                    "structure_score": 0.0,
                    "explanation": "No spoken words were recorded to evaluate communication."
                }
            }

        # 1. Filler rate per 100 words (0..10 score)
        filler_rate = round((total_fillers / total_words) * 100.0, 1)
        if filler_rate <= 1.0:
            filler_score = 10.0
        elif filler_rate <= 3.0:
            filler_score = 8.5
        elif filler_rate <= 5.0:
            filler_score = 6.5
        elif filler_rate <= 8.0:
            filler_score = 4.5
        else:
            filler_score = 2.0

        # 2. Speaking pace: words per minute
        duration_min = (total_duration / 60.0) if total_duration > 0 else 0.5
        wpm = round(total_words / duration_min, 1) if duration_min > 0 else 0.0
        if 110 <= wpm <= 160:
            pace_score = 10.0
        elif 90 <= wpm <= 180:
            pace_score = 8.0
        elif 70 <= wpm <= 200:
            pace_score = 6.0
        else:
            pace_score = 4.0

        # 3. Answer length appropriateness
        avg_words_per_ans = total_words / max(evaluated_turns, 1)
        if 40 <= avg_words_per_ans <= 150:
            length_score = 10.0
        elif 25 <= avg_words_per_ans <= 250:
            length_score = 7.5
        else:
            length_score = 5.0

        # 4. Structure heuristic
        struct_ratio = (structure_hits / max(evaluated_turns, 1))
        structure_score = round(min(10.0, struct_ratio * 10.0 + 3.0), 1)

        # Composite communication score
        comm_score = round(
            filler_score * 0.3 + pace_score * 0.25 + length_score * 0.25 + structure_score * 0.2,
            1
        )

        explanation = (
            f"Communication Score {comm_score}/10 based on: "
            f"Filler Rate: {filler_rate} fillers/100 words ({filler_score}/10); "
            f"Pace: {wpm} WPM ({pace_score}/10); "
            f"Average Length: {round(avg_words_per_ans, 1)} words/answer ({length_score}/10); "
            f"Structured Argumentation: {round(struct_ratio * 100, 1)}% of answers ({structure_score}/10)."
        )

        return {
            "communication_score": comm_score,
            "communication_breakdown": {
                "filler_rate_per_100_words": filler_rate,
                "speaking_pace_wpm": wpm,
                "length_appropriateness_score": length_score,
                "structure_score": structure_score,
                "explanation": explanation
            }
        }


report_agent = ReportAgent()
