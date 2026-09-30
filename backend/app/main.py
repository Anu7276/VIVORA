import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.database import Base, engine
from app.api.routes import upload, session, report
from app.api.ws import interview_ws

# Initialize database tables
Base.metadata.create_all(bind=engine)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("vivora")

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
        "llm_provider": settings.LLM_PROVIDER,
        "stt_provider": settings.STT_PROVIDER,
        "tts_provider": settings.TTS_PROVIDER
    }

@app.get("/health")
def health():
    return {"status": "healthy"}
