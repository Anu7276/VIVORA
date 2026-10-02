import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session as DBSession
from app.db.models import Session, Question, Answer, Evaluation, Report, TopicScore, Document
from app.agents.orchestrator import orchestrator
from app.services.mode_strategy import ModeStrategy

class SessionService:
    @staticmethod
    async def create_session(
        db: DBSession,
        mode: str = "school",
        title: str = "Science Viva",
        content_text: str = "",
        question_source: Optional[str] = None,
        time_limit_min: Optional[int] = None,
        user_id: Optional[str] = None,
        job_role: Optional[str] = None,
        tech_stack: Optional[str] = None,
        experience_level: Optional[str] = None
    ) -> Session:
        cfg = ModeStrategy.get_config(mode)
        q_source = question_source or cfg.question_source_default
        time_limit = time_limit_min or cfg.time_limit_min

        # If job role provided for interview mode, personalize title and content
        if mode == "interview" and job_role:
            if not title or title in ("Science Viva", "Science Viva Practice", "Full Stack Software Engineer Interview"):
                title = f"{job_role} Technical Interview"
            profile_context = f"Job Role: {job_role}\nTech Stack: {tech_stack or 'Full-Stack'}\nExperience Level: {experience_level or 'Mid-Level'}"
            if content_text:
                content_text = f"{profile_context}\n\nCandidate / Role Context:\n{content_text}"
            else:
                content_text = profile_context

        # 1. Create Document
        doc = Document(
            user_id=user_id,
            title=title,
            doc_type="questions" if q_source == "fixed" else "syllabus",
            content=content_text
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)

        # 2. Ingest into RAG via Orchestrator Intake Agent
        intake_res = orchestrator.intake._extract_explicit_questions(content_text)
        
        # 3. Create Session
        session = Session(
            user_id=user_id,
            document_id=doc.id,
            mode=mode,
            question_source=q_source,
            time_limit_min=time_limit,
            status="created",
            started_at=None
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        # 4. Populate questions:
        # - School mode: uses uploaded/parsed fixed Q&A pairs
        # - College mode: calls Gemini (QUESTION_GEN_PROVIDER) to collect TOP 10 viva questions
        # - Interview mode: calls Gemini to generate customized technical questions tailored to
        #   candidate's Job Role and Tech Stack
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
                except Exception:
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
                except Exception:
                    questions_data = []

            if not questions_data:
                if mode == "school":
                    questions_data = [
                        {
                            "question_text": "What is photosynthesis and where does it occur in plant cells?",
                            "topic": "Biology",
                            "difficulty": "easy",
                            "reference_answer": "Photosynthesis is the process by which green plants make food using sunlight, water, and CO2, occurring in chloroplasts."
                        },
                        {
                            "question_text": "State Newton's Third Law of Motion and give one real-life example.",
                            "topic": "Physics",
                            "difficulty": "easy",
                            "reference_answer": "For every action, there is an equal and opposite reaction. Example: A rocket propulsion or pushing against a wall."
                        },
                        {
                            "question_text": "What is the difference between an acid and a base in terms of pH?",
                            "topic": "Chemistry",
                            "difficulty": "easy",
                            "reference_answer": "Acids have a pH less than 7 and release H+ ions, while bases have a pH greater than 7 and release OH- ions."
                        }
                    ]
                elif mode == "interview":
                    questions_data = orchestrator.question._get_interview_fallback_questions(
                        job_role=job_role or title,
                        tech_stack=tech_stack or "React, Node.js, PostgreSQL, Docker",
                        experience_level=experience_level or "Mid-Level",
                        count=6
                    )
                else:
                    questions_data = [
                        {
                            "question_text": f"Explain the core architectural principles of {title}.",
                            "topic": title,
                            "difficulty": "medium",
                            "reference_answer": f"Core principles and mechanisms of {title}.",
                            "followup_question": "What is the governing theoretical model?",
                            "followup_answer": "Mathematical foundation and governing equations."
                        },
                        {
                            "question_text": f"How do you handle edge cases and failure modes in {title}?",
                            "topic": title,
                            "difficulty": "hard",
                            "reference_answer": f"Resilience patterns and recovery strategies for {title}.",
                            "followup_question": "What is the computational complexity of the recovery?",
                            "followup_answer": "Bounded execution time."
                        }
                    ]

        for idx, q in enumerate(questions_data):
            q_model = Question(
                session_id=session.id,
                order_no=idx + 1,
                question_text=q["question_text"],
                topic=q.get("topic", "General"),
                difficulty=q.get("difficulty", "medium"),
                origin=q.get("origin", "generated" if mode == "college" else "uploaded"),
                reference_answer=q.get("reference_answer", ""),
                followup_question=q.get("followup_question", ""),
                followup_answer=q.get("followup_answer", "")
            )
            db.add(q_model)

        db.commit()
        db.refresh(session)
        return session

    @staticmethod
    def get_session(db: DBSession, session_id: str) -> Optional[Session]:
        return db.query(Session).filter(Session.id == session_id).first()

    @staticmethod
    def record_answer_and_eval(
        db: DBSession,
        question_id: str,
        transcript: str,
        duration_sec: int,
        filler_count: int,
        evaluation_data: Dict[str, Any]
    ) -> Answer:
        # Create Answer record (Audio is never stored)
        answer = Answer(
            question_id=question_id,
            transcript=transcript,
            duration_sec=duration_sec,
            filler_word_count=filler_count,
            answered_at=datetime.datetime.utcnow()
        )
        db.add(answer)
        db.commit()
        db.refresh(answer)

        # Create Evaluation record
        eval_record = Evaluation(
            answer_id=answer.id,
            correctness_score=evaluation_data.get("correctness_score", 0.0),
            depth_score=evaluation_data.get("depth_score", 0.0),
            clarity_score=evaluation_data.get("clarity_score", 0.0),
            overall_score=evaluation_data.get("overall_score", 0.0),
            feedback=evaluation_data.get("feedback", ""),
            missing_concepts=evaluation_data.get("missing_concepts", ""),
            model_answer=evaluation_data.get("model_answer", ""),
            provider=evaluation_data.get("_provider", "mock")
        )
        db.add(eval_record)
        db.commit()
        return answer

    @staticmethod
    def get_session_evaluations(db: DBSession, session_id: str) -> List[Dict[str, Any]]:
        questions = db.query(Question).filter(Question.session_id == session_id).order_by(Question.order_no, Question.id).all()
        evaluations = []
        for q in questions:
            for ans in q.answers:
                if ans.evaluation:
                    ev = ans.evaluation
                    evaluations.append({
                        "question_id": q.id,
                        "order_no": q.order_no,
                        "question_text": q.question_text,
                        "topic": q.topic or "General",
                        "reference_answer": q.reference_answer or "",
                        "correctness_score": ev.correctness_score,
                        "depth_score": ev.depth_score,
                        "clarity_score": ev.clarity_score,
                        "overall_score": ev.overall_score,
                        "feedback": ev.feedback or "",
                        "missing_concepts": ev.missing_concepts or "",
                        "model_answer": ev.model_answer or "",
                        "_is_mock": (ev.provider == "mock")
                    })
        return evaluations

    @staticmethod
    def complete_session_report(db: DBSession, session_id: str, report_data: Dict[str, Any]) -> Report:
        existing_report = db.query(Report).filter(Report.session_id == session_id).first()
        if existing_report:
            return existing_report

        session = db.query(Session).filter(Session.id == session_id).first()
        if session:
            session.status = "completed"
            session.ended_at = datetime.datetime.utcnow()

        report = Report(
            session_id=session_id,
            overall_score=report_data.get("overall_score", 0.0),
            strengths="\n".join(report_data.get("strengths", [])) if isinstance(report_data.get("strengths"), list) else str(report_data.get("strengths", "")),
            improvements="\n".join(report_data.get("improvements", [])) if isinstance(report_data.get("improvements"), list) else str(report_data.get("improvements", "")),
            revision_plan="\n".join(report_data.get("revision_plan", [])) if isinstance(report_data.get("revision_plan"), list) else str(report_data.get("revision_plan", "")),
            communication_feedback=report_data.get("communication_feedback", ""),
            scoring_note=report_data.get("scoring_note", "")
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
