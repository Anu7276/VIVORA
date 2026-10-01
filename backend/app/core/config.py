from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "VIVORA - AI Viva & Interview Simulator"
    API_V1_STR: str = "/api"
    DATABASE_URL: str = "sqlite:///./vivora.db"

    # ── API Keys ─────────────────────────────────────────────────────────────
    GEMINI_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None

    # ── Per-task LLM routing ──────────────────────────────────────────────────
    # Each task picks a preferred provider by name: gemini | groq | openai | mock
    # If the chosen provider has no key, the router falls back automatically.
    #
    #  question_generation  → runs once at session start (deep context, Gemini default)
    #  live_turn            → real-time follow-up / doubt / interviewer (low-latency, Groq default)
    #  evaluation           → score each answer rubric (Groq default, fast)
    #  report               → final session report (richer output, Gemini default)
    QUESTION_GEN_PROVIDER: str = "gemini"
    LIVE_PROVIDER: str = "groq"
    EVALUATION_PROVIDER: str = "groq"
    REPORT_PROVIDER: str = "gemini"

    # Voice Providers (browser, deepgram, whisper, elevenlabs, edgetts)
    STT_PROVIDER: str = "browser"
    TTS_PROVIDER: str = "browser"
    DEEPGRAM_API_KEY: Optional[str] = None
    ELEVENLABS_API_KEY: Optional[str] = None

    # Session defaults
    DEFAULT_TIME_LIMIT_MIN: int = 15
    MAX_TIME_LIMIT_MIN: int = 30

    # CORS
    BACKEND_CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
