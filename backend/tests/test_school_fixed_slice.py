import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import asyncio
from app.db.database import SessionLocal, Base, engine
from app.services.session_service import session_service
from app.agents.orchestrator import orchestrator

def test_school_fixed_slice():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        sample_questions_text = """
Q1: What is photosynthesis and which organelle carries it out?
Ans: Photosynthesis is the process by which green plants make food using sunlight, carbon dioxide, and water. It occurs in chloroplasts.

Q2: State Newton's First Law of Motion with an example.
Ans: An object remains at rest or in uniform motion unless acted upon by an external unbalanced force.
        """

        print("[1/5] Ingesting material & creating session...")
        session = asyncio.run(session_service.create_session(
            db=db,
            mode="school",
            title="Class 10 Physics & Biology Viva",
            content_text=sample_questions_text,
            question_source="fixed"
        ))
        assert session.id is not None
        assert len(session.questions) == 2
        print(f"  [OK] Session created: {session.id} with {len(session.questions)} fixed questions")

        print("[2/5] Preparing Interviewer turn...")
        q1 = session.questions[0]
        q_speech = asyncio.run(orchestrator.prepare_interviewer_turn(
            question={
                "id": q1.id,
                "order_no": 1,
                "question_text": q1.question_text,
                "topic": q1.topic,
                "difficulty": q1.difficulty
            },
            mode="school"
        ))
        assert "photosynthesis" in q_speech["speakable_text"].lower()
        print(f"  [OK] Spoken Question prepared: {q_speech['speakable_text']}")

        print("[3/5] Simulating spoken student answer & Evaluator Agent scoring...")
        student_transcript = "Photosynthesis is how green plants convert solar energy into chemical food in chloroplasts."
        turn_result = asyncio.run(orchestrator.evaluate_turn(
            tenant_id=session.document_id or session.id,
            question_text=q1.question_text,
            answer_transcript=student_transcript,
            reference_answer=q1.reference_answer,
            mode="school"
        ))
        eval_data = turn_result["evaluation"]
        assert eval_data["overall_score"] > 0
        print(f"  [OK] Evaluator score: {eval_data['overall_score']}/10, Feedback: {eval_data['feedback']}")

        print("[4/5] Recording answer and evaluation in database (no audio stored)...")
        ans_record = session_service.record_answer_and_eval(
            db=db,
            question_id=q1.id,
            transcript=student_transcript,
            duration_sec=8,
            filler_count=0,
            evaluation_data=eval_data
        )
        assert ans_record.id is not None
        assert ans_record.transcript == student_transcript
        print(f"  [OK] Answer and evaluation saved with transcript only")

        print("[5/5] Generating final analytical report & revision plan...")
        report_data = asyncio.run(orchestrator.generate_final_report(
            mode="school",
            evaluations=[eval_data]
        ))
        report_record = session_service.complete_session_report(
            db=db,
            session_id=session.id,
            report_data=report_data
        )
        assert report_record.id is not None
        assert report_record.overall_score > 0
        print(f"  [OK] Report generated successfully! Overall score: {report_record.overall_score}")
        print("\n=== VERTICAL SLICE TEST PASSED 100% ===")

    finally:
        db.close()

if __name__ == "__main__":
    test_school_fixed_slice()
