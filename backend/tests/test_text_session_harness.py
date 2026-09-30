import sys
import os
import pytest
import asyncio

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.database import SessionLocal, Base, engine
from app.services.session_service import session_service
from app.agents.orchestrator import orchestrator

@pytest.fixture(scope="module")
def db():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    yield session
    session.close()

def test_text_session_harness_school_mode(db):
    """
    Text-only test harness that simulates the exact live session loop without a mic.
    Tests fixed question extraction, turn evaluation, transcript persistence, and scorecard generation.
    """
    material = """
Q1: What is cellular respiration?
Ans: Cellular respiration is the metabolic process where cells break down glucose to produce ATP energy and release carbon dioxide.

Q2: What is the unit of electric current?
Ans: The SI unit of electric current is the Ampere (A).
    """

    # 1. Create Session
    session = session_service.create_session(
        db=db,
        mode="school",
        title="Class 10 Biology & Physics",
        content_text=material,
        question_source="fixed"
    )
    assert session is not None
    assert len(session.questions) == 2

    evaluations_collected = []

    # 2. Iterate through questions in text mode
    simulated_answers = [
        "Cellular respiration breaks down food to make ATP energy for cells in mitochondria.",
        "The unit is Ampere."
    ]

    for idx, question in enumerate(session.questions):
        # Step A: Interviewer turn preparation
        speech = asyncio.run(orchestrator.prepare_interviewer_turn(
            question={
                "id": question.id,
                "order_no": idx + 1,
                "question_text": question.question_text,
                "topic": question.topic,
                "difficulty": question.difficulty
            },
            mode="school"
        ))
        assert speech["speakable_text"] is not None

        # Step B: Answer evaluation via Evaluator Agent
        student_ans = simulated_answers[idx]
        turn_eval = asyncio.run(orchestrator.evaluate_turn(
            tenant_id=session.document_id or session.id,
            question_text=question.question_text,
            answer_transcript=student_ans,
            reference_answer=question.reference_answer,
            mode="school"
        ))

        eval_data = turn_eval["evaluation"]
        assert eval_data["overall_score"] > 0
        assert eval_data["feedback"] is not None
        evaluations_collected.append(eval_data)

        # Step C: Record answer (Audio is never stored)
        ans_rec = session_service.record_answer_and_eval(
            db=db,
            question_id=question.id,
            transcript=student_ans,
            duration_sec=6,
            filler_count=0,
            evaluation_data=eval_data
        )
        assert ans_rec.id is not None
        assert ans_rec.transcript == student_ans

    # 3. Report Agent generates scorecard
    report_data = asyncio.run(orchestrator.generate_final_report(
        mode="school",
        evaluations=evaluations_collected
    ))
    report_rec = session_service.complete_session_report(
        db=db,
        session_id=session.id,
        report_data=report_data
    )

    assert report_rec.overall_score > 0
    assert report_rec.strengths is not None
    assert report_rec.revision_plan is not None

if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        test_text_session_harness_school_mode(session)
        print("=== TEXT-ONLY SESSION HARNESS PASSED 100% ===")
    finally:
        session.close()
