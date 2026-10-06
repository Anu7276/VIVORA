"""
Test F-AI-03: Skipped Questions Scoring and Incomplete Status
Verifies:
1. Overall score = sum of scores / total planned questions (skipped and unanswered count as 0).
2. If fewer than 50% of planned questions were answered, report status is marked 'incomplete'.
3. A student answering 1 question with 10.0 and skipping 9 does NOT get 100%; they receive 1.0 (10%).
"""

import asyncio
import pytest
from app.agents.report_agent import ReportAgent


def test_skipped_questions_are_penalized_and_marked_incomplete():
    """Answering 1 out of 10 questions with 10.0 must yield 1.0 overall score and 'incomplete' status."""
    agent = ReportAgent()
    evaluations = [
        {"overall_score": 10.0, "scored": True, "topic": "Algorithms", "feedback": "Great answer"}
    ]
    # 10 planned questions, but only 1 answered
    report = asyncio.run(agent.generate_report(
        mode="school",
        evaluations=evaluations,
        total_planned_questions=10
    ))

    assert report["overall_score"] == 1.0, f"Expected 1.0 overall score, got {report['overall_score']}"
    assert report["status"] == "incomplete", f"Expected 'incomplete' status, got {report['status']}"


def test_complete_session_full_answers():
    """Answering all questions yields normal average and 'complete' status."""
    agent = ReportAgent()
    evaluations = [
        {"overall_score": 8.0, "scored": True, "topic": "Physics"},
        {"overall_score": 8.0, "scored": True, "topic": "Physics"},
        {"overall_score": 8.0, "scored": True, "topic": "Chemistry"},
        {"overall_score": 8.0, "scored": True, "topic": "Chemistry"},
    ]
    report = asyncio.run(agent.generate_report(
        mode="school",
        evaluations=evaluations,
        total_planned_questions=4
    ))

    assert report["overall_score"] == 8.0
    assert report["status"] == "complete"
