import uuid
import secrets
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.database import Base

def gen_uuid() -> str:
    return str(uuid.uuid4())

def gen_session_token() -> str:
    """Generate a cryptographically random 32-byte (64-hex-char) session token."""
    return secrets.token_hex(32)

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False, default="Student")
    email = Column(String, unique=True, index=True, nullable=True)
    role = Column(String, default="school")  # school | college | candidate | admin
    language = Column(String, default="en-IN")
    is_minor = Column(Boolean, default=True)
    date_of_birth = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    documents = relationship("Document", back_populates="user", cascade="all, delete-orphan")
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")
    parent_consents = relationship("ParentConsent", back_populates="user", cascade="all, delete-orphan")

class ParentConsent(Base):
    __tablename__ = "parent_consents"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    parent_email = Column(String, nullable=False)
    verified = Column(Boolean, default=False)
    consent_date = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="parent_consents")

class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    title = Column(String, nullable=False)
    doc_type = Column(String, default="questions")  # syllabus | topic | questions | textbook | resume
    content = Column(Text, nullable=True)           # Raw text / questions
    ingest_status = Column(String, default="done")  # pending | processing | done | failed
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="documents")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")
    sessions = relationship("Session", back_populates="document")

class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(String, primary_key=True, default=gen_uuid)
    document_id = Column(String, ForeignKey("documents.id"))
    chunk_index = Column(Integer, default=0)
    content = Column(Text, nullable=False)
    vector_id = Column(String, nullable=True)
    topic_tag = Column(String, nullable=True)

    document = relationship("Document", back_populates="chunks")

class Session(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    document_id = Column(String, ForeignKey("documents.id"), nullable=True)
    mode = Column(String, default="school")  # school | college | interview
    question_source = Column(String, default="fixed")  # fixed | generated
    time_limit_min = Column(Integer, default=15)
    time_used_sec = Column(Integer, default=0)
    current_question_no = Column(Integer, default=0)  # Cursor for session resume after disconnect
    status = Column(String, default="created")  # created | live | completed | abandoned
    # Per-session secret token — returned at session creation, required on GET report and DELETE data.
    # This is a temporary access-control measure until proper auth (JWT/OAuth) is implemented.
    session_token = Column(String, nullable=True, default=gen_session_token)
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="sessions")
    document = relationship("Document", back_populates="sessions")
    questions = relationship("Question", back_populates="session", cascade="all, delete-orphan", order_by="Question.order_no")
    report = relationship("Report", back_populates="session", uselist=False, cascade="all, delete-orphan")

class Question(Base):
    __tablename__ = "questions"

    id = Column(String, primary_key=True, default=gen_uuid)
    session_id = Column(String, ForeignKey("sessions.id"))
    parent_question_id = Column(String, ForeignKey("questions.id"), nullable=True)
    order_no = Column(Integer, default=1)
    question_text = Column(Text, nullable=False)
    topic = Column(String, default="General")
    difficulty = Column(String, default="medium")  # easy | medium | hard
    origin = Column(String, default="uploaded")    # uploaded | generated | follow_up
    reference_answer = Column(Text, nullable=True)

    session = relationship("Session", back_populates="questions")
    answers = relationship("Answer", back_populates="question", cascade="all, delete-orphan")
    follow_ups = relationship("Question", backref="parent_question", remote_side=[id])

class Answer(Base):
    __tablename__ = "answers"

    id = Column(String, primary_key=True, default=gen_uuid)
    question_id = Column(String, ForeignKey("questions.id"))
    transcript = Column(Text, nullable=False)  # Audio is NEVER stored, only transcript
    duration_sec = Column(Integer, default=0)
    filler_word_count = Column(Integer, default=0)
    answered_at = Column(DateTime, default=datetime.utcnow)

    question = relationship("Question", back_populates="answers")
    evaluation = relationship("Evaluation", back_populates="answer", uselist=False, cascade="all, delete-orphan")

class Evaluation(Base):
    __tablename__ = "evaluations"

    id = Column(String, primary_key=True, default=gen_uuid)
    answer_id = Column(String, ForeignKey("answers.id"))
    correctness_score = Column(Float, default=0.0)  # 0 to 10
    depth_score = Column(Float, default=0.0)        # 0 to 10
    clarity_score = Column(Float, default=0.0)      # 0 to 10
    overall_score = Column(Float, default=0.0)      # 0 to 10
    feedback = Column(Text, nullable=True)
    missing_concepts = Column(Text, nullable=True)
    model_answer = Column(Text, nullable=True)
    provider = Column(String, default="mock")  # gemini | groq | openai | mock

    answer = relationship("Answer", back_populates="evaluation")

class Report(Base):
    __tablename__ = "reports"

    id = Column(String, primary_key=True, default=gen_uuid)
    session_id = Column(String, ForeignKey("sessions.id"))
    overall_score = Column(Float, default=0.0)
    strengths = Column(Text, nullable=True)
    improvements = Column(Text, nullable=True)
    revision_plan = Column(Text, nullable=True)
    communication_feedback = Column(Text, nullable=True)
    scoring_note = Column(Text, nullable=True)  # Note on mock fallback / provisional scoring
    pdf_url = Column(String, nullable=True)
    generated_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("Session", back_populates="report")
    topic_scores = relationship("TopicScore", back_populates="report", cascade="all, delete-orphan")

class TopicScore(Base):
    __tablename__ = "topic_scores"

    id = Column(String, primary_key=True, default=gen_uuid)
    report_id = Column(String, ForeignKey("reports.id"))
    topic = Column(String, nullable=False)
    score = Column(Float, default=0.0)
    level = Column(String, default="average")  # strong | average | weak

    report = relationship("Report", back_populates="topic_scores")

class LLMUsageLog(Base):
    """Records every LLM call: task, provider chosen, latency, and fallback status."""
    __tablename__ = "llm_usage_logs"

    id = Column(String, primary_key=True, default=gen_uuid)
    session_id = Column(String, nullable=True)          # Which session triggered this call
    task = Column(String, nullable=False)               # question_generation | live_turn | evaluation | report
    provider = Column(String, nullable=False)           # gemini | groq | openai | mock
    is_fallback = Column(Boolean, default=False)        # True when primary provider failed/timed out
    prompt_tokens = Column(Integer, default=0)          # Approximate prompt length in chars (not real tokens)
    latency_ms = Column(Integer, default=0)             # Wall-clock time for the LLM call
    success = Column(Boolean, default=True)
    error_type = Column(String, nullable=True)          # "rate_limit" | "timeout" | "api_error" | None
    created_at = Column(DateTime, default=datetime.utcnow)

