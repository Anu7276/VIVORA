import json
import logging
import time
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session as DBSession
from app.db.database import get_db, SessionLocal
from app.db.models import Session, Question
from app.services.session_service import session_service
from app.agents.orchestrator import orchestrator
from app.voice.vad import VoiceActivityDetector
from app.voice.stt_stream import stt_router
from app.voice.tts_stream import tts_router

logger = logging.getLogger("vivora.ws")
router = APIRouter()

@router.websocket("/ws/session/{session_id}")
async def interview_websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()
    db: DBSession = SessionLocal()
    
    session = session_service.get_session(db, session_id)
    if not session:
        await websocket.send_json({"type": "error", "message": "Session not found"})
        await websocket.close()
        db.close()
        return

    mode = session.mode or "school"
    vad = VoiceActivityDetector(mode=mode)
    
    # Track questions
    questions = list(session.questions)
    current_q_idx = 0
    evaluations_collected = []

    logger.info(f"WebSocket connected for session {session_id}, mode={mode}, total_questions={len(questions)}")

    async def send_current_question():
        nonlocal current_q_idx
        if current_q_idx >= len(questions):
            # All questions finished -> Generate final report
            await websocket.send_json({
                "type": "session_completing",
                "message": "All questions answered. Compiling final analytical report..."
            })
            report_data = await orchestrator.generate_final_report(
                mode=mode,
                evaluations=evaluations_collected
            )
            report_record = session_service.complete_session_report(
                db=db,
                session_id=session_id,
                report_data=report_data
            )
            await websocket.send_json({
                "type": "session_completed",
                "report_id": report_record.id,
                "report": report_data
            })
            return

        current_q = questions[current_q_idx]
        q_speech = await orchestrator.prepare_interviewer_turn(
            question={
                "id": current_q.id,
                "order_no": current_q_idx + 1,
                "question_text": current_q.question_text,
                "topic": current_q.topic,
                "difficulty": current_q.difficulty
            },
            mode=mode
        )

        await websocket.send_json({
            "type": "question_ready",
            "question_index": current_q_idx,
            "total_questions": len(questions),
            "question": {
                "id": current_q.id,
                "order_no": current_q_idx + 1,
                "question_text": current_q.question_text,
                "topic": current_q.topic,
                "difficulty": current_q.difficulty
            },
            "speech": q_speech
        })
        vad.reset()

    # Send initial question immediately upon connection
    await send_current_question()

    try:
        while True:
            raw_msg = await websocket.receive_text()
            data = json.loads(raw_msg)
            msg_type = data.get("type")

            # 1. Realtime Speech Partial / Stream Event
            if msg_type == "stt_partial":
                transcript = data.get("transcript", "")
                await websocket.send_json({
                    "type": "stt_partial",
                    "transcript": transcript
                })

            # 2. Final Spoken Answer Submitted (by Voice VAD or user release)
            elif msg_type == "submit_answer":
                transcript = data.get("transcript", "").strip()
                duration_sec = data.get("duration_sec", 5)
                filler_count = data.get("filler_count", 0)

                current_q = questions[current_q_idx]
                
                await websocket.send_json({
                    "type": "evaluating",
                    "message": "Analyzing spoken answer..."
                })

                # Evaluate turn with Evaluator Agent & RAG Reference
                turn_result = await orchestrator.evaluate_turn(
                    tenant_id=session.document_id or session.id,
                    question_text=current_q.question_text,
                    answer_transcript=transcript,
                    reference_answer=current_q.reference_answer or "",
                    mode=mode
                )

                eval_data = turn_result["evaluation"]
                eval_data["question_text"] = current_q.question_text
                eval_data["topic"] = current_q.topic
                evaluations_collected.append(eval_data)

                # Save transcript and evaluation (No audio is stored)
                session_service.record_answer_and_eval(
                    db=db,
                    question_id=current_q.id,
                    transcript=transcript,
                    duration_sec=duration_sec,
                    filler_count=filler_count,
                    evaluation_data=eval_data
                )

                # Send evaluation feedback to client
                await websocket.send_json({
                    "type": "evaluation_result",
                    "evaluation": eval_data
                })

                # Check if follow up is triggered
                follow_up = turn_result.get("follow_up")
                if follow_up:
                    # Send follow-up turn
                    speech = await orchestrator.prepare_interviewer_turn(
                        question={
                            "id": f"fu_{current_q.id}",
                            "order_no": current_q_idx + 1,
                            "question_text": follow_up["question_text"],
                            "topic": current_q.topic,
                            "difficulty": "hard"
                        },
                        mode=mode
                    )
                    await websocket.send_json({
                        "type": "followup_question",
                        "question": follow_up,
                        "speech": speech
                    })
                else:
                    # Move to next question
                    current_q_idx += 1
                    # Give short pause before next question
                    await send_current_question()

            # 3. Voice Control: Repeat Current Question
            elif msg_type == "repeat_question":
                current_q = questions[current_q_idx]
                q_speech = await orchestrator.prepare_interviewer_turn(
                    question={
                        "id": current_q.id,
                        "order_no": current_q_idx + 1,
                        "question_text": current_q.question_text,
                        "topic": current_q.topic,
                        "difficulty": current_q.difficulty
                    },
                    mode=mode
                )
                await websocket.send_json({
                    "type": "question_repeated",
                    "speech": q_speech
                })

            # 4. Voice Control: Skip Question
            elif msg_type == "skip_question":
                current_q_idx += 1
                await send_current_question()

            # 5. Voice Control: Student Doubt (School Mode)
            elif msg_type == "ask_doubt":
                doubt_text = data.get("doubt", "")
                doubt_res = await orchestrator.handle_doubt(
                    tenant_id=session.document_id or session.id,
                    doubt_query=doubt_text,
                    mode=mode
                )
                await websocket.send_json({
                    "type": "doubt_answered",
                    "doubt": doubt_res
                })

            # 6. End Session Early
            elif msg_type == "end_session":
                current_q_idx = len(questions) # Force trigger report
                await send_current_question()

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for session {session_id}")
    except Exception as e:
        logger.error(f"WebSocket error in session {session_id}: {e}", exc_info=True)
    finally:
        db.close()
