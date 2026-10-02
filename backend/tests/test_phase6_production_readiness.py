import uuid
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import inspect
from app.main import app
from app.db.database import Base, engine
from app.db.models import (
    User,
    ParentConsent,
    Document,
    DocumentChunk,
    Session as DbSession,
    Question,
    Answer,
    Evaluation,
    TopicScore,
    LLMUsageLog,
)
from app.rag.retriever import rag_retriever


@pytest.fixture
def client():
    return TestClient(app)


def test_request_id_middleware_generates_and_echoes_header(client):
    """
    Assert X-Request-ID is generated if absent, and echoed back in response headers.
    Also assert if client supplies X-Request-ID, the exact ID is propagated.
    """
    # 1. No header supplied -> system generates a valid UUID
    resp = client.get("/api/health")
    assert resp.status_code == 200
    req_id = resp.headers.get("X-Request-ID")
    assert req_id is not None
    # Verify it is a valid UUID
    parsed = uuid.UUID(req_id)
    assert str(parsed) == req_id

    # 2. Client supplied X-Request-ID is preserved
    custom_id = "trace-req-test-9999"
    resp2 = client.get("/api/health", headers={"X-Request-ID": custom_id})
    assert resp2.status_code == 200
    assert resp2.headers.get("X-Request-ID") == custom_id


def test_database_foreign_keys_have_indexes():
    """
    Verify foreign keys have indexes for production query performance at scale.
    """
    # Inspect tables
    tables = {
        ParentConsent: ["user_id"],
        Document: ["user_id"],
        DocumentChunk: ["document_id"],
        DbSession: ["user_id", "document_id"],
        Question: ["session_id"],
        Answer: ["question_id"],
        Evaluation: ["answer_id"],
        TopicScore: ["report_id"],
        LLMUsageLog: ["session_id"],
    }

    for model, cols in tables.items():
        for col_name in cols:
            col = getattr(model, col_name)
            assert col.index is True, f"Expected {model.__tablename__}.{col_name} to have index=True"


def test_retriever_cache_invalidation():
    """
    Verify RAGRetriever provides invalidate_cache to ensure deleted documents
    do not linger in BM25 memory cache.
    """
    assert hasattr(rag_retriever, "invalidate_cache"), "rag_retriever must have invalidate_cache method"
    rag_retriever._cache["doc-dummy-123"] = "fake_index"
    rag_retriever.invalidate_cache("doc-dummy-123")
    assert "doc-dummy-123" not in rag_retriever._cache


def test_favicon_asset_exists():
    """
    Ensure frontend/public contains favicon to avoid 404s and Docker build cache failures.
    """
    frontend_public = Path(__file__).resolve().parent.parent.parent / "frontend" / "public"
    assert frontend_public.exists(), "frontend/public directory must exist"
    favicon_files = list(frontend_public.glob("favicon*"))
    assert len(favicon_files) > 0, "frontend/public must contain a favicon asset"


def test_ci_workflow_runs_pytest():
    """
    Verify .github/workflows/ci.yml executes pytest tests rather than only 2 scripts.
    """
    ci_file = Path(__file__).resolve().parent.parent.parent / ".github" / "workflows" / "ci.yml"
    assert ci_file.exists()
    content = ci_file.read_text(encoding="utf-8")
    assert "pytest" in content, "CI workflow must run pytest test suite"
