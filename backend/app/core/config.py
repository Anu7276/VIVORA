from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, List

class Settings(BaseSettings):
    PROJECT_NAME: str = "VIVORA - AI Viva & Interview Simulator"
    API_V1_STR: str = "/api"
    DATABASE_URL: str = "sqlite:///./vivora.db"

    # ── Environment ───────────────────────────────────────────────────────────
    # "development" enables /docs, /openapi.json and the / info route.
    # Anything else (production, staging, …) disables them.
    ENV: str = "development"

    # ── Security ──────────────────────────────────────────────────────────────
    # If not set, a random key is generated at startup (not suitable for multi-replica).
    JWT_SECRET_KEY: Optional[str] = None
    # Dev email sender logs the link; production requires SMTP config.
    EMAIL_FROM: str = "noreply@vivora.ai"
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None   # never logged
    FRONTEND_URL: str = "http://localhost:3000"

    # ── LLM Provider Override (e.g. 'mock' for testing) ──────────────────────
    LLM_PROVIDER: Optional[str] = None

    # ── API Keys ─────────────────────────────────────────────────────────────
    GEMINI_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None

    # ── Model names (override per deployment) ─────────────────────────────────
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GROQ_MODEL: str = "llama-3.1-8b-instant"
    OPENAI_MODEL: str = "gpt-4o-mini"

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

    # Voice Providers (browser for STT; browser or elevenlabs for TTS)
    STT_PROVIDER: str = "browser"
    TTS_PROVIDER: str = "browser"
    ELEVENLABS_API_KEY: Optional[str] = None

    # Session defaults
    DEFAULT_TIME_LIMIT_MIN: int = 15
    MAX_TIME_LIMIT_MIN: int = 30

    # ── Scoring Weights ───────────────────────────────────────────────────────
    SCORE_WEIGHT_CORRECTNESS: float = 0.5
    SCORE_WEIGHT_DEPTH: float = 0.3
    SCORE_WEIGHT_CLARITY: float = 0.2

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ]

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
