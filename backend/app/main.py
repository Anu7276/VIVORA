import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.database import Base, engine
from app.api.routes import upload, session, report
from app.api.ws import interview_ws

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("vivora")

def validate_provider_configuration():
    """
    Validates all configured providers at application startup.
    Fails immediately if any provider is unknown, unimplemented, or missing required keys
    (unless fallback is explicitly permitted).
    """
    stt = (settings.STT_PROVIDER or "browser").lower()
    if stt == "whisper":
        raise ValueError(
            "Startup validation failed: STT_PROVIDER=whisper is planned but not yet implemented. "
            "Use STT_PROVIDER=browser (default) or STT_PROVIDER=deepgram."
        )
    if stt not in ("browser", "deepgram"):
        raise ValueError(
            f"Startup validation failed: Unknown STT provider '{stt}'. Supported providers: browser, deepgram."
        )
    if stt == "deepgram" and not settings.DEEPGRAM_API_KEY and not settings.ALLOW_STT_FALLBACK:
        raise ValueError(
            "Startup validation failed: STT_PROVIDER is set to 'deepgram' but DEEPGRAM_API_KEY is missing "
            "and ALLOW_STT_FALLBACK is False. Set DEEPGRAM_API_KEY or set ALLOW_STT_FALLBACK=true to allow fallback."
        )

    tts = (settings.TTS_PROVIDER or "browser").lower()
    if tts not in ("browser", "elevenlabs"):
        raise ValueError(
            f"Startup validation failed: Unknown TTS provider '{tts}'. Supported providers: browser, elevenlabs."
        )

    valid_llm_providers = {"gemini", "groq", "openai", "mock"}
    for task_name, provider_name in [
        ("question_generation", settings.QUESTION_GEN_PROVIDER),
        ("live_turn", settings.LIVE_PROVIDER),
        ("evaluation", settings.EVALUATION_PROVIDER),
        ("report", settings.REPORT_PROVIDER),
    ]:
        if (provider_name or "").lower() not in valid_llm_providers:
            raise ValueError(
                f"Startup validation failed: Unknown LLM provider '{provider_name}' for task '{task_name}'. "
                f"Valid providers are: {', '.join(sorted(valid_llm_providers))}."
            )

# Run startup validation
validate_provider_configuration()

# Initialize database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins in development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(upload.router, prefix=f"{settings.API_V1_STR}/upload", tags=["Upload & Ingestion"])
app.include_router(session.router, prefix=f"{settings.API_V1_STR}/session", tags=["Session & Questions"])
app.include_router(report.router, prefix=f"{settings.API_V1_STR}/report", tags=["Report & Analytics"])
app.include_router(interview_ws.router, tags=["Realtime Voice WebSocket"])

@app.get("/")
def root():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "docs": "/docs",
        "llm_routing": {
            "question_generation": settings.QUESTION_GEN_PROVIDER,
            "live_turn": settings.LIVE_PROVIDER,
            "evaluation": settings.EVALUATION_PROVIDER,
            "report": settings.REPORT_PROVIDER,
        },
        "stt_provider": settings.STT_PROVIDER,
        "tts_provider": settings.TTS_PROVIDER,
    }

@app.get("/health")
def health():
    return {"status": "healthy"}
