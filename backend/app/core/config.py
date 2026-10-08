from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, List, Any

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

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings,
        env_settings,
        dotenv_settings,
        file_secret_settings,
    ):
        return (init_settings, env_settings, dotenv_settings, file_secret_settings)

    def model_post_init(self, __context: Any) -> None:
        import os
        import secrets
        if not self.JWT_SECRET_KEY or (
            self.ENV != "development"
            and (
                len(self.JWT_SECRET_KEY) < 32
                or self.JWT_SECRET_KEY in {
                    "vivora-insecure-dev-secret-key-change-in-production",
                    "vivora-production-secure-jwt-secret-key-32chars",
                    "secret",
                    "changeme",
                }
            )
        ):
            self.JWT_SECRET_KEY = secrets.token_urlsafe(32)

        if not self.GEMINI_API_KEY:
            self.GEMINI_API_KEY = (
                os.environ.get("GEMINI_API_KEY")
                or os.environ.get("GOOGLE_API_KEY")
                or os.environ.get("GEMINI_KEY")
                or os.environ.get("GOOGLE_GEMINI_API_KEY")
                or os.environ.get("GOOGLE_AI_KEY")
            )
        if not self.GROQ_API_KEY:
            self.GROQ_API_KEY = (
                os.environ.get("GROQ_API_KEY")
                or os.environ.get("GROQ_KEY")
                or os.environ.get("GROQ_APIKEY")
            )
        if self.GEMINI_API_KEY and not self.GROQ_API_KEY:
            self.QUESTION_GEN_PROVIDER = "gemini"
            self.LIVE_PROVIDER = "gemini"
            self.EVALUATION_PROVIDER = "gemini"
            self.REPORT_PROVIDER = "gemini"

    # ── Model names (override per deployment) ─────────────────────────────────
    GEMINI_MODEL: str = "gemini-2.0-flash"
    GROQ_MODEL: str = "qwen/qwen3.8-27b"
    OPENAI_MODEL: str = "gpt-4o-mini"

    # ── Per-task LLM routing ──────────────────────────────────────────────────
    # Each task picks a preferred provider by name: gemini | groq | openai | mock
    # If the chosen provider has no key, the router falls back automatically.
    #
    #  question_generation  → runs once at session start (deep context, Groq/Qwen default)
    #  live_turn            → real-time follow-up / doubt / interviewer (low-latency, Groq default)
    #  evaluation           → score each answer rubric (Groq default, fast)
    #  report               → final session report (richer output, Groq default)
    QUESTION_GEN_PROVIDER: str = "groq"
    LIVE_PROVIDER: str = "groq"
    EVALUATION_PROVIDER: str = "groq"
    REPORT_PROVIDER: str = "groq"

    # Voice Providers (browser for STT; browser or elevenlabs for TTS)
    STT_PROVIDER: str = "browser"
    TTS_PROVIDER: str = "browser"
    ELEVENLABS_API_KEY: Optional[str] = None

    # Session defaults
    DEFAULT_TIME_LIMIT_MIN: int = 15
    MAX_TIME_LIMIT_MIN: int = 30
    DAILY_SESSION_LIMIT: int = 5

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
