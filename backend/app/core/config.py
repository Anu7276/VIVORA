from pydantic_settings import BaseSettings
from typing import Optional
import os

class Settings(BaseSettings):
    PROJECT_NAME: str = "VIVORA - AI Viva & Interview Simulator"
    API_V1_STR: str = "/api"
    DATABASE_URL: str = "sqlite:///./vivora.db"
    
    # LLM Provider Configuration (gemini, groq, openai, mock)
    LLM_PROVIDER: str = "mock"
    GEMINI_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    
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
