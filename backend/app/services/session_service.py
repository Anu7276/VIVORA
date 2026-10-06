import logging
import datetime
from typing import Dict, Any, List, Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session as DBSession
from app.db.models import Session, Question, Answer, Evaluation, Report, TopicScore, Document
from app.agents.orchestrator import orchestrator
from app.services.mode_strategy import ModeStrategy

logger = logging.getLogger("vivora.session_service")

class SessionService:
    @staticmethod
    async def create_session(
        db: DBSession,
        mode: str = "school",
        title: str = "Science Viva",
        content_text: str = "",
        document_id: Optional[str] = None,
        question_source: Optional[str] = None,
        time_limit_min: Optional[int] = None,
        user_id: Optional[str] = None,
        job_role: Optional[str] = None,
        tech_stack: Optional[str] = None,
        experience_level: Optional[str] = None,
        language: str = "en-IN"
    ) -> Session:
        cfg = ModeStrategy.get_config(mode)
        q_source = question_source or cfg.question_source_default
        time_limit = time_limit_min or cfg.time_limit_min

        # 1. Resolve Document
        doc: Optional[Document] = None
        newly_created_doc = False
        if document_id:
            doc = db.query(Document).filter(Document.id == document_id).first()
            if not doc or (user_id and doc.user_id and doc.user_id != user_id):
                raise HTTPException(status_code=404, detail="Document not found")
            if doc.content:
                content_text = doc.content
            if doc.title and (not title or title in (
                "Science Viva",
                "Science Viva Practice",
                "Operating Systems: Process Synchronization & Deadlocks",
                "Class 10 Biology: Life Processes",
                "College Viva Voce",
                "School Viva Practice",
                "General"
            )):
                title = doc.title

        # If job role provided for interview mode, personalize title and content
        if mode == "interview":
            target_role = job_role or "Software Engineer"
            if not title or title in ("Science Viva", "Science Viva Practice", "Full Stack Software Engineer Interview", "System Design Mock Interview", "System Design & Technical Architecture Viva"):
                title = f"{target_role} Interview"
            profile_context = f"Target Job Role: {target_role}\nExperience Level: {experience_level or 'Mid-Level'}" + (f"\nTech Stack: {tech_stack}" if tech_stack else "")
            if content_text:
                content_text = f"{profile_context}\n\nCandidate Resume / Background Context:\n{content_text}"
            else:
                content_text = profile_context

        if not doc:
            doc_type_val = "resume" if mode == "interview" else ("questions" if mode == "school" else "syllabus")
            doc = Document(
                user_id=user_id,
                title=title,
                doc_type=doc_type_val,
                content=content_text
            )
            db.add(doc)
            db.commit()
            db.refresh(doc)
            newly_created_doc = True

        session: Optional[Session] = None
        try:
            # 2. Ingest into RAG and ensure chunks are persisted to DB if not already indexed
            from app.db.models import DocumentChunk
            chunk_count = db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).count()
            if chunk_count == 0 and content_text:
                await orchestrator.ingest_material(
                    tenant_id=doc.id,
                    title=doc.title,
                    text=content_text,
                    doc_type=doc.doc_type,
                    db=db
                )

            intake_res = orchestrator.intake._extract_explicit_questions(content_text)
            
            # 3. Create Session
            session = Session(
                user_id=user_id,
                document_id=doc.id,
                mode=mode,
                language=language,
                question_source=q_source,
                time_limit_min=time_limit,
                status="created",
                started_at=None
            )
            db.add(session)
            db.commit()
            db.refresh(session)

            # 4. Populate questions:
            questions_data = intake_res
            if not questions_data or (mode in ("college", "interview") and q_source != "fixed"):
                if mode == "college":
                    try:
                        questions_data = await orchestrator.initialize_questions(
                            mode="college",
                            question_source="generated",
                            uploaded_questions=[],
                            tenant_id=doc.id,
                            topic=title,
                            context_text=content_text,
                            count=10
                        )
                    except Exception as e:
                        logger.error(f"College question generation error: {e}", exc_info=True)
                        questions_data = []
                elif mode == "interview":
                    try:
                        questions_data = await orchestrator.initialize_questions(
                            mode="interview",
                            question_source="generated",
                            uploaded_questions=[],
                            tenant_id=doc.id,
                            topic=job_role or title,
                            context_text=content_text,
                            count=6,
                            job_role=job_role or title,
                            tech_stack=tech_stack,
                            experience_level=experience_level
                        )
                    except Exception as e:
                        logger.error(f"Interview question generation error: {e}", exc_info=True)
                        questions_data = []
                elif mode == "school":
                    if (content_text and len(content_text.strip()) > 10) or title:
                        try:
                            questions_data = await orchestrator.initialize_questions(
                                mode="school",
                                question_source="generated",
                                uploaded_questions=[],
                                tenant_id=doc.id,
                                topic=title or "General",
                                context_text=content_text,
                                count=5
                            )
                        except Exception as e:
                            logger.error(f"School question generation error: {e}", exc_info=True)
                            questions_data = []

            if not questions_data:
                if mode in ("college", "interview"):
                    raise HTTPException(
                        status_code=503,
                        detail="Question generation failed: AI provider is unavailable. Please try again."
                    )
                else:
                    raise HTTPException(
                        status_code=422,
                        detail="No explicit questions found and insufficient text provided to generate questions. Please upload a structured question set or syllabus content."
                    )

            for idx, q in enumerate(questions_data):
                q_model = Question(
                    session_id=session.id,
                    order_no=idx + 1,
                    question_text=q["question_text"],
                    topic=q.get("topic", "General"),
                    difficulty=q.get("difficulty", "medium"),
                    origin=q.get("origin", "generated" if mode in ("college", "interview") else "uploaded"),
                    reference_answer=q.get("reference_answer", ""),
                    followup_question=q.get("followup_question", ""),
                    followup_answer=q.get("followup_answer", "")
                )
                db.add(q_model)

            db.commit()
            db.refresh(session)
            return session

        except Exception as e:
            db.rollback()
            # Clean up orphan session and orphan document
            if session and session.id:
                try:
                    db.delete(session)
                    db.commit()
                except Exception:
                    pass
            if newly_created_doc and doc and doc.id:
                try:
                    db.delete(doc)
                    db.commit()
                except Exception:
                    pass
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(status_code=500, detail="Failed to initialize session.")

    @staticmethod
    def get_session(db: DBSession, session_id: str, eager: bool = False) -> Optional[Session]:
        if not eager:
            return db.query(Session).filter(Session.id == session_id).first()
        from sqlalchemy.orm import selectinload
        return (
            db.query(Session)
            .options(
                selectinload(Session.questions)
                .selectinload(Question.answers)
                .selectinload(Answer.evaluation)
            )
            .filter(Session.id == session_id)
            .first()
        )

    @staticmethod
    def record_answer_and_eval(
        db: DBSession,
        question_id: str,
        transcript: str,
        duration_sec: int,
        filler_count: int,
        evaluation_data: Dict[str, Any]
    ) -> Answer:
        now_utc = datetime.datetime.now(datetime.timezone.utc)
        try:
            answer = Answer(
                question_id=question_id,
                transcript=transcript,
                duration_sec=duration_sec,
                filler_word_count=filler_count,
                answered_at=now_utc
            )
            db.add(answer)
            db.flush()

            eval_record = Evaluation(
                answer_id=answer.id,
                scored=evaluation_data.get("scored", True),
                correctness_score=evaluation_data.get("correctness_score"),
                depth_score=evaluation_data.get("depth_score"),
                clarity_score=evaluation_data.get("clarity_score"),
                overall_score=evaluation_data.get("overall_score"),
                feedback=evaluation_data.get("feedback", ""),
                missing_concepts=evaluation_data.get("missing_concepts", ""),
                model_answer=evaluation_data.get("model_answer", ""),
                provider=evaluation_data.get("_provider", "mock")
            )
            db.add(eval_record)
            db.commit()
            db.refresh(answer)
            return answer
        except Exception:
            db.rollback()
            raise

    @staticmethod
    def get_session_evaluations(db: DBSession, session_id: str) -> List[Dict[str, Any]]:
        questions = db.query(Question).filter(Question.session_id == session_id).order_by(Question.order_no, Question.id).all()
        evaluations = []
        for q in questions:
            if not q.answers and q.parent_question_id is None:
                evaluations.append({
                    "question_id": q.id,
                    "order_no": q.order_no,
                    "question_text": q.question_text,
                    "topic": q.topic or "General",
                    "reference_answer": q.reference_answer or "",
                    "scored": True,
                    "correctness_score": 0.0,
                    "depth_score": 0.0,
                    "clarity_score": 0.0,
                    "overall_score": 0.0,
                    "feedback": "Question was skipped or unanswered.",
                    "missing_concepts": "No response provided.",
                    "model_answer": q.reference_answer or "",
                    "_is_mock": False,
                    "is_skipped": True,
                })
            else:
                for ans in q.answers:
                    if ans.evaluation:
                        ev = ans.evaluation
                        evaluations.append({
                            "question_id": q.id,
                            "order_no": q.order_no,
                            "question_text": q.question_text,
                            "topic": q.topic or "General",
                            "reference_answer": q.reference_answer or "",
                            "scored": getattr(ev, "scored", True),
                            "correctness_score": ev.correctness_score,
                            "depth_score": ev.depth_score,
                            "clarity_score": ev.clarity_score,
                            "overall_score": ev.overall_score,
                            "feedback": ev.feedback or "",
                            "missing_concepts": ev.missing_concepts or "",
                            "model_answer": ev.model_answer or "",
                            "_is_mock": (ev.provider == "mock")
                        })
                    else:
                        evaluations.append({
                            "question_id": q.id,
                            "order_no": q.order_no,
                            "question_text": q.question_text,
                            "topic": q.topic or "General",
                            "reference_answer": q.reference_answer or "",
                            "scored": False,
                            "correctness_score": 0.0,
                            "depth_score": 0.0,
                            "clarity_score": 0.0,
                            "overall_score": 0.0,
                            "feedback": "Evaluation unavailable for this answer.",
                            "missing_concepts": "",
                            "model_answer": q.reference_answer or "",
                            "_is_mock": False,
                        })
        return evaluations

    @staticmethod
    def complete_session_report(db: DBSession, session_id: str, report_data: Dict[str, Any]) -> Report:
        existing_report = db.query(Report).filter(Report.session_id == session_id).first()
        if existing_report:
            return existing_report

        now_utc = datetime.datetime.now(datetime.timezone.utc)
        session = db.query(Session).filter(Session.id == session_id).first()
        if session:
            session.status = "completed"
            session.ended_at = now_utc

        report = Report(
            session_id=session_id,
            overall_score=report_data.get("overall_score", 0.0),
            status=report_data.get("status", "complete"),
            strengths="\n".join(report_data.get("strengths", [])) if isinstance(report_data.get("strengths"), list) else str(report_data.get("strengths", "")),
            improvements="\n".join(report_data.get("improvements", [])) if isinstance(report_data.get("improvements"), list) else str(report_data.get("improvements", "")),
            revision_plan="\n".join(report_data.get("revision_plan", [])) if isinstance(report_data.get("revision_plan"), list) else str(report_data.get("revision_plan", "")),
            communication_feedback=report_data.get("communication_feedback", ""),
            scoring_note=report_data.get("scoring_note", ""),
            generated_at=now_utc
        )
        db.add(report)
        db.commit()
        db.refresh(report)

        # Add topic scores
        for ts in report_data.get("topic_scores", []):
            score_rec = TopicScore(
                report_id=report.id,
                topic=ts.get("topic", "General"),
                score=float(ts.get("score", 0.0)),
                level=ts.get("level", "average")
            )
            db.add(score_rec)

        db.commit()
        return report

    @staticmethod
    def persist_question_cursor(db: DBSession, session_id: str, question_no: int) -> None:
        """Persist the current question index so the session can resume after a disconnect."""
        session = db.query(Session).filter(Session.id == session_id).first()
        if session:
            session.current_question_no = question_no
            db.commit()

    @staticmethod
    def set_awaiting_followup(db: DBSession, session_id: str, awaiting: bool, followup_id: Optional[str] = None) -> None:
        session = db.query(Session).filter(Session.id == session_id).first()
        if session:
            session.awaiting_followup = awaiting
            session.active_followup_id = followup_id
            db.commit()

session_service = SessionService()
