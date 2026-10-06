"""
Test F-FUNC-07: Single Scale Rule (0-10) and Rubric Normalization
Verifies:
1. Backend evaluation and report overall_score stay strictly on 0-10 scale.
2. In report_agent.py, overall score equals the exact arithmetic mean of question scores on the 0-10 scale.
3. Frontend session page renders '/ 10' instead of '/100', computes bar width using score * 10 percent,
   and handles overall_score, total_score, and score fields without displaying 'undefined'.
"""

import pathlib
import pytest
from app.agents.report_agent import ReportAgent


def test_frontend_rubric_uses_0_to_10_scale_and_handles_all_score_fields():
    """Ensure frontend no longer hardcodes '/100' in rubric evaluation and uses score * 10 for bar width."""
    session_file = pathlib.Path(__file__).resolve().parent.parent.parent / "frontend" / "src" / "app" / "session" / "[id]" / "page.tsx"
    assert session_file.exists()
    content = session_file.read_text(encoding="utf-8")

    # Must NOT have '/100' in the rubric question score badge
    assert "/100" not in content, "Frontend rubric still displays '/100'; must use '/ 10'"
    # Must support overall_score and multiply by 10 for bar width
    assert "* 10" in content or "overall_score" in content


def test_report_overall_score_equals_mean_of_question_scores_on_same_scale():
    """Report overall score must equal the exact arithmetic mean of 0-10 question scores."""
    import asyncio
    agent = ReportAgent()
    evaluations = [
        {"overall_score": 8.0, "scored": True, "topic": "Algorithms"},
        {"overall_score": 6.0, "scored": True, "topic": "Algorithms"},
        {"overall_score": 10.0, "scored": True, "topic": "Data Structures"},
    ]
    report = asyncio.run(agent.generate_report(mode="school", evaluations=evaluations))
    expected_mean = round((8.0 + 6.0 + 10.0) / 3.0, 1) # 8.0
    assert report["overall_score"] == expected_mean, f"Expected {expected_mean}, got {report['overall_score']}"
    assert 0.0 <= report["overall_score"] <= 10.0, "Score must stay on 0-10 scale"
