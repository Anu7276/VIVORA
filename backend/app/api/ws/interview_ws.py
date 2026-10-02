import json
import asyncio
import logging
import time
import re
from datetime import datetime
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError
from sqlalchemy.orm import Session as DBSession

from app.db.database import SessionLocal
from app.db.models import Session as SessionModel, Question, Answer, Evaluation, Report
from app.services.session_service import session_service
from app.agents.orchestrator import orchestrator
from app.voice.vad import VoiceActivityDetector
from app.core.auth import verify_access_token
from app.schemas.ws_messages import (
    SttPartialMessage,
    SubmitAnswerMessage,
    RepeatQuestionMessage,
    SkipQuestionMessage,
    AskDoubtMessage,
    EndSessionMessage,
)

logger = logging.getLogger("vivora.ws")
router = APIRouter()

FILLER_REGEX = re.compile(r"\b(um|uh|like|you know|basically|actually)\b", re.IGNORECASE)


@router.websocket("/ws/session/{session_id}")
async def interview_websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()
    db: DBSession = SessionLocal()

    try:
        session = session_service.get_session(db, session_id)
        if not session:
            await websocket.send_json({
                "type": "error",
                "code": "SESSION_NOT_FOUND",
                "message": "Session not found"
            })
            await websocket.close(code=4004)
            return

        # ─── 1. Authenticate Handshake within 5 seconds ───────────────────
        try:
            raw_auth = await asyncio.wait_for(websocket.receive_text(), timeout=5.0)
            auth_data = json.loads(raw_auth)
        except asyncio.TimeoutError:
            await websocket.send_json({
                "type": "error",
                "code": "AUTH_TIMEOUT",
                "message": "Authentication timed out. Must send {type: 'auth', token: '...'} within 5s."
            })
            await websocket.close(code=4001)
            return
        except Exception:
            await websocket.send_json({
                "type": "error",
                "code": "AUTH_FAILED",
                "message": "Malformed authentication message."
            })
            await websocket.close(code=4002)
            return

        if not isinstance(auth_data, dict) or auth_data.get("type") != "auth" or not auth_data.get("token"):
            await websocket.send_json({
                "type": "error",
                "code": "AUTH_REQUIRED",
                "message": "Authentication required. First message must be {type: 'auth', token: '...'}"
            })
            await websocket.close(code=4003)
            return

        payload = verify_access_token(auth_data["token"])
        if not payload:
            await websocket.send_json({
                "type": "error",
                "code": "INVALID_TOKEN",
                "message": "Invalid or expired access token."
            })
            await websocket.close(code=4001)
            return

        auth_user_id = payload.get("sub")
        if session.user_id and session.user_id != auth_user_id:
            await websocket.send_json({
                "type": "error",
                "code": "FORBIDDEN",
                "message": "Access denied to this session."
            })
            await websocket.close(code=4003)
            return

        await websocket.send_json({"type": "auth_ok"})

        # ─── 2. Session Initialization & Timer Setup ─────────────────────
        mode = session.mode or "school"
        vad = VoiceActivityDetector(mode=mode)

        now_utc = datetime.utcnow()
        if session.started_at is None:
            session.started_at = now_utc
            session.status = "live"
            db.commit()
            db.refresh(session)

        # Server-authoritative timer
        time_limit_sec = float((session.time_limit_min or 30) * 60)
        elapsed_sec = (datetime.utcnow() - session.started_at).total_seconds()
        session.time_used_sec = max(session.time_used_sec or 0, int(elapsed_sec))
        db.commit()

        # Questions (main questions without parent_question_id)
        questions = db.query(Question).filter(
            Question.session_id == session_id,
            Question.parent_question_id.is_(None)
        ).order_by(Question.order_no, Question.id).all()

        current_q_idx = getattr(session, "current_question_no", 0) or 0
        question_sent_at = time.time()

        # If already completed or report exists, return idempotent report
        existing_report = db.query(Report).filter(Report.session_id == session_id).first()
        if existing_report or session.status == "completed":
            if not existing_report:
                # Build report from DB evaluations
                db_evals = session_service.get_session_evaluations(db, session_id)
                report_data = await orchestrator.generate_final_report(mode=mode, evaluations=db_evals)
                existing_report = session_service.complete_session_report(db, session_id, report_data)

            await websocket.send_json({
                "type": "session_completed",
                "report_id": existing_report.id,
                "report": {
                    "overall_score": existing_report.overall_score,
                    "strengths": existing_report.strengths.split("\n") if existing_report.strengths else [],
                    "improvements": existing_report.improvements.split("\n") if existing_report.improvements else [],
                    "revision_plan": existing_report.revision_plan.split("\n") if existing_report.revision_plan else [],
                    "communication_feedback": existing_report.communication_feedback or "",
                    "scoring_note": existing_report.scoring_note or "",
                },
                "scoring_note": existing_report.scoring_note or "",
                "mock_scored_count": 0,
            })
            return

        async def send_current_turn():
            nonlocal current_q_idx, question_sent_at

            # If awaiting follow-up, resume on follow-up
            if session.awaiting_followup and session.active_followup_id:
                active_fu = db.query(Question).filter(Question.id == session.active_followup_id).first()
                if active_fu:
                    fu_speech = await orchestrator.prepare_interviewer_turn(
                        question={
                            "id": active_fu.id,
                            "order_no": active_fu.order_no,
                            "question_text": active_fu.question_text,
                            "topic": active_fu.topic,
                            "difficulty": active_fu.difficulty
                        },
                        mode=mode
                    )
                    question_sent_at = time.time()
                    await websocket.send_json({
                        "type": "followup_question",
                        "question": {
                            "id": active_fu.id,
                            "order_no": active_fu.order_no,
                            "question_text": active_fu.question_text,
                            "topic": active_fu.topic,
                            "difficulty": active_fu.difficulty
                        },
                        "speech": fu_speech
                    })
                    return

            if current_q_idx >= len(questions):
                # All questions finished -> Generate final report from DB
                await websocket.send_json({
                    "type": "session_completing",
                    "message": "All questions answered. Compiling final analytical report..."
                })
                db_evals = session_service.get_session_evaluations(db, session_id)
                report_data = await orchestrator.generate_final_report(
                    mode=mode,
                    evaluations=db_evals
                )
                report_record = session_service.complete_session_report(
                    db=db,
                    session_id=session_id,
                    report_data=report_data
                )
                await websocket.send_json({
                    "type": "session_completed",
                    "report_id": report_record.id,
                    "report": report_data,
                    "scoring_note": report_data.get("scoring_note", ""),
                    "mock_scored_count": report_data.get("mock_scored_count", 0),
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

            question_sent_at = time.time()
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

        # Send initial (or resumed) question immediately
        await send_current_turn()

        # ─── 3. Message Processing Loop ──────────────────────────────────
        while True:
            # Check elapsed time
            now_elapsed = (datetime.utcnow() - session.started_at).total_seconds()
            session.time_used_sec = max(session.time_used_sec or 0, int(now_elapsed))
            db.commit()

            remaining = time_limit_sec - now_elapsed
            if remaining <= 0:
                await websocket.send_json({
                    "type": "session_timeout",
                    "message": f"Time limit of {session.time_limit_min} minutes reached. Compiling your report..."
                })
                current_q_idx = len(questions)
                session.awaiting_followup = False
                session.active_followup_id = None
                db.commit()
                await send_current_turn()
                break

            try:
                raw_msg = await asyncio.wait_for(websocket.receive_text(), timeout=remaining)
            except asyncio.TimeoutError:
                await websocket.send_json({
                    "type": "session_timeout",
                    "message": f"Time limit of {session.time_limit_min} minutes reached. Compiling your report..."
                })
                current_q_idx = len(questions)
                session.awaiting_followup = False
                session.active_followup_id = None
                db.commit()
                await send_current_turn()
                break

            try:
                data = json.loads(raw_msg)
            except Exception:
                await websocket.send_json({
                    "type": "error",
                    "code": "MALFORMED_JSON",
                    "message": "Malformed JSON frame received."
                })
                continue

            if not isinstance(data, dict):
                await websocket.send_json({
                    "type": "error",
                    "code": "INVALID_FRAME",
                    "message": "Frame must be a JSON object."
                })
                continue

            msg_type = data.get("type")

            # Route message handlers safely
            try:
                if msg_type == "stt_partial":
                    stt_msg = SttPartialMessage(**data)
                    await websocket.send_json({
                        "type": "stt_partial",
                        "transcript": stt_msg.transcript or ""
                    })

                elif msg_type == "submit_answer":
                    sub_msg = SubmitAnswerMessage(**data)

                    # Compute honest server metrics
                    duration_sec = max(1, int(time.time() - question_sent_at)) if question_sent_at else 5
                    raw_transcript = (sub_msg.transcript or "").strip()
                    filler_count = len(FILLER_REGEX.findall(raw_transcript))

                    await websocket.send_json({
                        "type": "evaluating",
                        "message": "Analyzing spoken answer..."
                    })

                    if session.awaiting_followup and session.active_followup_id:
                        # Follow-up evaluation turn
                        target_q = db.query(Question).filter(Question.id == session.active_followup_id).first()
                        if not target_q:
                            target_q = questions[current_q_idx]

                        if not raw_transcript:
                            stored_transcript = "no answer"
                            eval_data = {
                                "correctness_score": 0.0,
                                "depth_score": 0.0,
                                "clarity_score": 0.0,
                                "overall_score": 0.0,
                                "feedback": "No answer provided.",
                                "missing_concepts": "Answer was empty.",
                                "model_answer": target_q.reference_answer or "",
                                "_is_mock": False
                            }
                        else:
                            stored_transcript = raw_transcript
                            turn_result = await orchestrator.evaluate_turn(
                                tenant_id=session.document_id or session.id,
                                question_text=target_q.question_text,
                                answer_transcript=raw_transcript,
                                reference_answer=target_q.reference_answer or "",
                                mode=mode,
                                planned_followup=None,
                                planned_followup_answer=None
                            )
                            eval_data = turn_result["evaluation"]

                        eval_data["question_text"] = target_q.question_text
                        eval_data["topic"] = target_q.topic
                        eval_data["reference_answer"] = target_q.reference_answer or ""

                        session_service.record_answer_and_eval(
                            db=db,
                            question_id=target_q.id,
                            transcript=stored_transcript,
                            duration_sec=duration_sec,
                            filler_count=filler_count,
                            evaluation_data=eval_data
                        )

                        await websocket.send_json({
                            "type": "evaluation_result",
                            "evaluation": eval_data
                        })

                        # Complete follow-up turn and advance main cursor
                        session.awaiting_followup = False
                        session.active_followup_id = None
                        current_q_idx += 1
                        session.current_question_no = current_q_idx
                        db.commit()

                        await send_current_turn()

                    else:
                        # Main question turn
                        target_q = questions[current_q_idx]

                        if not raw_transcript:
                            stored_transcript = "no answer"
                            eval_data = {
                                "correctness_score": 0.0,
                                "depth_score": 0.0,
                                "clarity_score": 0.0,
                                "overall_score": 0.0,
                                "feedback": "No answer provided.",
                                "missing_concepts": "Answer was empty.",
                                "model_answer": target_q.reference_answer or "",
                                "_is_mock": False
                            }
                            turn_result = {"evaluation": eval_data, "follow_up": None}
                        else:
                            stored_transcript = raw_transcript
                            turn_result = await orchestrator.evaluate_turn(
                                tenant_id=session.document_id or session.id,
                                question_text=target_q.question_text,
                                answer_transcript=raw_transcript,
                                reference_answer=target_q.reference_answer or "",
                                mode=mode,
                                planned_followup=getattr(target_q, "followup_question", None),
                                planned_followup_answer=getattr(target_q, "followup_answer", None)
                            )
                            eval_data = turn_result["evaluation"]

                        eval_data["question_text"] = target_q.question_text
                        eval_data["topic"] = target_q.topic
                        eval_data["reference_answer"] = target_q.reference_answer or ""

                        session_service.record_answer_and_eval(
                            db=db,
                            question_id=target_q.id,
                            transcript=stored_transcript,
                            duration_sec=duration_sec,
                            filler_count=filler_count,
                            evaluation_data=eval_data
                        )

                        await websocket.send_json({
                            "type": "evaluation_result",
                            "evaluation": eval_data
                        })

                        follow_up = turn_result.get("follow_up")
                        # Rule: At most one follow-up per main question
                        if follow_up and not session.awaiting_followup:
                            fu_question = Question(
                                session_id=session.id,
                                parent_question_id=target_q.id,
                                order_no=target_q.order_no,
                                question_text=follow_up["question_text"],
                                topic=target_q.topic,
                                difficulty="hard",
                                origin="follow_up",
                                reference_answer=follow_up.get("reference_answer") or getattr(target_q, "followup_answer", "") or ""
                            )
                            db.add(fu_question)
                            db.commit()
                            db.refresh(fu_question)

                            session.awaiting_followup = True
                            session.active_followup_id = fu_question.id
                            db.commit()

                            speech = await orchestrator.prepare_interviewer_turn(
                                question={
                                    "id": fu_question.id,
                                    "order_no": target_q.order_no,
                                    "question_text": follow_up["question_text"],
                                    "topic": target_q.topic,
                                    "difficulty": "hard"
                                },
                                mode=mode
                            )
                            question_sent_at = time.time()
                            await websocket.send_json({
                                "type": "followup_question",
                                "question": {
                                    "id": fu_question.id,
                                    "order_no": target_q.order_no,
                                    "question_text": follow_up["question_text"],
                                    "topic": target_q.topic,
                                    "difficulty": "hard"
                                },
                                "speech": speech
                            })
                        else:
                            current_q_idx += 1
                            session.current_question_no = current_q_idx
                            session.awaiting_followup = False
                            session.active_followup_id = None
                            db.commit()
                            await send_current_turn()

                elif msg_type == "repeat_question":
                    _ = RepeatQuestionMessage(**data)
                    if session.awaiting_followup and session.active_followup_id:
                        active_q = db.query(Question).filter(Question.id == session.active_followup_id).first()
                    else:
                        active_q = questions[current_q_idx]

                    q_speech = await orchestrator.prepare_interviewer_turn(
                        question={
                            "id": active_q.id,
                            "order_no": current_q_idx + 1,
                            "question_text": active_q.question_text,
                            "topic": active_q.topic,
                            "difficulty": active_q.difficulty
                        },
                        mode=mode
                    )
                    await websocket.send_json({
                        "type": "question_repeated",
                        "speech": q_speech
                    })

                elif msg_type == "skip_question":
                    _ = SkipQuestionMessage(**data)
                    session.awaiting_followup = False
                    session.active_followup_id = None
                    current_q_idx += 1
                    session.current_question_no = current_q_idx
                    db.commit()
                    await send_current_turn()

                elif msg_type == "ask_doubt":
                    doubt_msg = AskDoubtMessage(**data)
                    doubt_res = await orchestrator.handle_doubt(
                        tenant_id=session.document_id or session.id,
                        doubt_query=doubt_msg.doubt,
                        mode=mode
                    )
                    await websocket.send_json({
                        "type": "doubt_answered",
                        "doubt": doubt_res
                    })

                elif msg_type == "end_session":
                    _ = EndSessionMessage(**data)
                    current_q_idx = len(questions)
                    session.awaiting_followup = False
                    session.active_followup_id = None
                    db.commit()
                    await send_current_turn()
                    break

                else:
                    await websocket.send_json({
                        "type": "error",
                        "code": "UNKNOWN_MESSAGE_TYPE",
                        "message": f"Unknown message type '{msg_type}'"
                    })

            except (ValidationError, ValueError) as val_err:
                await websocket.send_json({
                    "type": "error",
                    "code": "VALIDATION_ERROR",
                    "message": str(val_err)
                })
            except Exception as e:
                logger.error(f"Error handling message {msg_type}: {e}", exc_info=True)
                await websocket.send_json({
                    "type": "error",
                    "code": "HANDLER_ERROR",
                    "message": "Error processing your request."
                })

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for session {session_id}")
    except Exception as e:
        logger.error(f"WebSocket unhandled error for session {session_id}: {e}", exc_info=True)
    finally:
        db.close()
