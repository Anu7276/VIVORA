import sys
from pathlib import Path

# Ensure backend root is on sys.path so 'app.*' imports work from anywhere
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import logging
import uuid
import time
from starlette.requests import Request
from starlette.responses import Response
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.database import Base, engine
from app.api.routes import upload, session, report, auth
from app.api.ws import interview_ws

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("vivora")

# Suppress httpx INFO logs so request URLs (which may contain auth tokens in
# other clients' code) are never written to stdout/log aggregators.
logging.getLogger("httpx").setLevel(logging.WARNING)

def validate_provider_configuration():
    """
    Validates all configured providers at application startup.
    Fails immediately if any provider is unknown, unimplemented, or missing required keys
    (unless fallback is explicitly permitted).
    """
    stt = (settings.STT_PROVIDER or "browser").lower()
    if stt != "browser":
        raise ValueError(
            f"Startup validation failed: Unknown or unsupported STT provider '{stt}'. "
            "Supported provider is 'browser' (Web Speech API)."
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
    import os
    from app.core.auth import validate_jwt_secret
    if not os.environ.get("PYTEST_CURRENT_TEST"):
        validate_jwt_secret(getattr(settings, "JWT_SECRET_KEY", None), settings.ENV)

# Run startup validation
validate_provider_configuration()

# Initialize database tables
Base.metadata.create_all(bind=engine)

# Lightweight SQLite migrations for new auth columns added in Phase 1.
# These are no-ops if columns already exist.
try:
    from sqlalchemy import text
    with engine.connect() as _conn:
        # Add password_hash to users
        _existing = {r[1] for r in _conn.execute(text("PRAGMA table_info(users);")).fetchall()}
        if "password_hash" not in _existing:
            _conn.execute(text("ALTER TABLE users ADD COLUMN password_hash TEXT;"))
        if "account_status" not in _existing:
            _conn.execute(text("ALTER TABLE users ADD COLUMN account_status TEXT NOT NULL DEFAULT 'active';"))
        # Add consent_token to parent_consents
        _pc_existing = {r[1] for r in _conn.execute(text("PRAGMA table_info(parent_consents);")).fetchall()}
        if "consent_token" not in _pc_existing:
            _conn.execute(text("ALTER TABLE parent_consents ADD COLUMN consent_token TEXT;"))
        _conn.commit()
except Exception as _mig_exc:
    logger.warning(f"Phase 1 schema migration skipped (may already exist): {_mig_exc}")

# /docs and /openapi.json are only served in development mode.
_is_dev = settings.ENV.lower() == "development"

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    try:
        from app.llm.router import close_shared_http_client
        await close_shared_http_client()
    except Exception:
        pass

app = FastAPI(
    title=settings.PROJECT_NAME,
    # Disable interactive docs outside development to avoid exposing API surface.
    docs_url="/docs" if _is_dev else None,
    redoc_url="/redoc" if _is_dev else None,
    openapi_url=f"{settings.API_V1_STR}/openapi.json" if _is_dev else None,
    lifespan=lifespan,
)

MAX_GLOBAL_BODY_SIZE = 2 * 1024 * 1024  # 2 MB
MAX_UPLOAD_BODY_SIZE = 10 * 1024 * 1024  # 10 MB


@app.middleware("http")
async def body_size_limit_middleware(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            cl = int(content_length)
            is_upload = request.url.path.startswith(f"{settings.API_V1_STR}/upload/file")
            limit = MAX_UPLOAD_BODY_SIZE if is_upload else MAX_GLOBAL_BODY_SIZE
            if cl > limit:
                from starlette.responses import JSONResponse
                return JSONResponse(
                    status_code=413,
                    content={"detail": f"Request body too large. Maximum allowed size is {limit // (1024*1024)} MB."}
                )
        except ValueError:
            pass
    return await call_next(request)


@app.middleware("http")
async def request_id_and_logging_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    request.state.request_id = request_id
    start_time = time.perf_counter()

    response: Response = await call_next(request)

    duration_ms = (time.perf_counter() - start_time) * 1000
    response.headers["X-Request-ID"] = request_id

    # Structured request logging
    logger.info(
        f"[request_id={request_id}] method={request.method} path={request.url.path} "
        f"status={response.status_code} duration_ms={duration_ms:.2f}"
    )
    return response

# CORS configuration — explicit list of origins to avoid wildcard+credentials vulnerability.
# Using '*' with allow_credentials=True is rejected by browsers and is a security flaw.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["Auth"])
app.include_router(upload.router, prefix=f"{settings.API_V1_STR}/upload", tags=["Upload & Ingestion"])
app.include_router(session.router, prefix=f"{settings.API_V1_STR}/session", tags=["Session & Questions"])
app.include_router(report.router, prefix=f"{settings.API_V1_STR}/report", tags=["Report & Analytics"])
app.include_router(interview_ws.router, tags=["Realtime Voice WebSocket"])

if _is_dev:
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
@app.get(f"{settings.API_V1_STR}/health")
def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)

