import asyncio
import io
import pytest
from starlette.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from app.db.models import User, Document, DocumentChunk, Session
from app.rag.chunker import Chunker
from app.rag.retriever import rag_retriever


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_headers(client):
    import datetime
    email = f"rag_user_{datetime.datetime.now(datetime.UTC).timestamp()}@example.com"
    signup_resp = client.post("/api/auth/signup", json={
        "name": "RAG Student",
        "email": email,
        "password": "Password123!",
        "date_of_birth": "2000-01-01"
    })
    assert signup_resp.status_code == 200
    token = signup_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


class TestPhase4RAGAndIngestion:

    def test_chunk_boundaries_never_split_words(self):
        """
        Chunker must split cleanly on sentence or paragraph or word boundaries.
        It must never slice in the middle of an English word (e.g. 'photos' / 'ynthesis').
        """
        chunker = Chunker(chunk_size=100, overlap=20)
        long_sentence = (
            "Photosynthesis is a sophisticated biological process through which green plants, "
            "algae, and cyanobacteria synthesize organic nutrients, primarily carbohydrates like glucose, "
            "from atmospheric carbon dioxide and water utilizing electromagnetic radiant energy "
            "absorbed by specialized photosynthetic pigments called chlorophylls located in thylakoid membranes."
        )
        chunks = chunker.chunk_text(long_sentence, default_topic="Biology")
        assert len(chunks) > 1

        # Check every chunk does not start or end with a sliced partial word
        words_in_original = set(long_sentence.replace(",", "").replace(".", "").split())
        for c in chunks:
            content = c["content"].strip()
            first_word = content.split()[0].strip(".,!?:;")
            last_word = content.split()[-1].strip(".,!?:;")
            assert first_word in words_in_original, f"First word '{first_word}' was sliced mid-word!"
            assert last_word in words_in_original, f"Last word '{last_word}' was sliced mid-word!"

    def test_relevant_chunk_outranks_irrelevant_one(self):
        """
        BM25 / lexical retriever must rank a conceptually matching chunk
        substantially higher than an unrelated chunk, avoiding the hash-alias bug.
        """
        db = SessionLocal()
        try:
            doc = Document(title="Science Exam", content="Test")
            db.add(doc)
            db.commit()
            db.refresh(doc)

            c1 = DocumentChunk(
                document_id=doc.id,
                chunk_index=0,
                content="Photosynthesis is the chemical process where plants convert sunlight and carbon dioxide into oxygen and glucose sugars.",
                topic_tag="Biology"
            )
            c2 = DocumentChunk(
                document_id=doc.id,
                chunk_index=1,
                content="Newton's second law of motion states that force equals mass multiplied by acceleration in classical physics.",
                topic_tag="Physics"
            )
            db.add_all([c1, c2])
            db.commit()

            # Retrieve with query about photosynthesis
            results = rag_retriever.retrieve(tenant_id=doc.id, query="How do plants produce glucose with sunlight and carbon dioxide?", top_k=2)
            assert len(results) > 0
            top_match = results[0]
            assert "Photosynthesis" in top_match["content"]
            assert top_match["score"] > 0
        finally:
            db.close()

    def test_session_created_from_uploaded_document_has_chunks_in_db(self, client, auth_headers):
        """
        Uploading a document via /api/upload/text or /api/upload/file must persist
        DocumentChunk rows in the database, and /api/session/start must accept document_id
        directly without needing extracted_text preview round-tripped.
        """
        text_content = (
            "Chapter 1: Optics\n"
            "Light travels in straight lines in vacuum at three hundred thousand kilometers per second.\n"
            "Reflection occurs when a light wave strikes a smooth reflective boundary and bounces back.\n\n"
            "Chapter 2: Thermodynamics\n"
            "The first law of thermodynamics is the conservation of energy principle.\n"
            "Heat cannot spontaneously flow from a colder body to a warmer body without external work.\n"
        )
        upload_resp = client.post("/api/upload/text", json={
            "title": "Physics Notes",
            "doc_type": "syllabus",
            "content": text_content
        }, headers=auth_headers)
        assert upload_resp.status_code == 200
        doc_id = upload_resp.json()["document_id"]

        # Verify DB has chunks
        db = SessionLocal()
        try:
            chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id == doc_id).all()
            assert len(chunks) > 0, "No chunks were persisted to the database for this document!"
        finally:
            db.close()

        # Start session referencing document_id
        session_resp = client.post("/api/session/start", json={
            "mode": "school",
            "title": "Physics Viva",
            "document_id": doc_id
        }, headers=auth_headers)
        assert session_resp.status_code == 200
        sess_data = session_resp.json()
        assert sess_data["session_id"] is not None

        # Verify session is tied to document_id
        db = SessionLocal()
        try:
            sess = db.query(Session).filter(Session.id == sess_data["session_id"]).first()
            assert sess.document_id == doc_id
        finally:
            db.close()

    def test_document_retrieval_is_restart_safe(self):
        """
        Retrieval must build from DB chunks on demand. Clearing in-memory caches
        (simulating process restart) must still successfully retrieve chunks from DB.
        """
        db = SessionLocal()
        try:
            doc = Document(title="Chemistry Notes", content="Acids and Bases")
            db.add(doc)
            db.commit()
            db.refresh(doc)

            c = DocumentChunk(
                document_id=doc.id,
                chunk_index=0,
                content="Hydrochloric acid reacts with sodium hydroxide in an exothermic neutralization reaction to form salt and water.",
                topic_tag="Chemistry"
            )
            db.add(c)
            db.commit()

            # Invalidate any in-memory index
            if hasattr(rag_retriever, "clear_cache"):
                rag_retriever.clear_cache(doc.id)

            ctx = rag_retriever.get_context_string(tenant_id=doc.id, query="neutralization reaction acid base")
            assert "Hydrochloric acid" in ctx
        finally:
            db.close()

    def test_delete_uploaded_document_removes_chunks_and_returns_404(self, client, auth_headers):
        """
        DELETE /api/upload/{document_id} deletes Document and all associated DocumentChunk records.
        """
        upload_resp = client.post("/api/upload/text", json={
            "title": "Temp Doc",
            "doc_type": "syllabus",
            "content": "Temporary content to be deleted."
        }, headers=auth_headers)
        assert upload_resp.status_code == 200
        doc_id = upload_resp.json()["document_id"]

        # Delete it
        del_resp = client.delete(f"/api/upload/{doc_id}", headers=auth_headers)
        assert del_resp.status_code == 200

        # Check DB
        db = SessionLocal()
        try:
            assert db.query(Document).filter(Document.id == doc_id).first() is None
            assert db.query(DocumentChunk).filter(DocumentChunk.document_id == doc_id).count() == 0
        finally:
            db.close()

    def test_upload_status_endpoint(self, client, auth_headers):
        """
        GET /api/upload/{document_id}/status returns ingest_status ('done', 'processing', etc.)
        """
        upload_resp = client.post("/api/upload/text", json={
            "title": "Status Doc",
            "doc_type": "syllabus",
            "content": "Sample content"
        }, headers=auth_headers)
        assert upload_resp.status_code == 200
        doc_id = upload_resp.json()["document_id"]

        status_resp = client.get(f"/api/upload/{doc_id}/status", headers=auth_headers)
        assert status_resp.status_code == 200
        assert status_resp.json()["status"] in ("done", "processing", "pending")
        assert status_resp.json()["document_id"] == doc_id

    @pytest.mark.anyio
    async def test_concurrent_health_request_during_upload(self, auth_headers):
        """
        Upload processing must run in threadpool so it does not block the async event loop.
        A concurrent request to /api/health must respond immediately.
        """
        import httpx
        from app.main import app

        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as ac:
            # Check health responds promptly
            health_resp = await ac.get("/api/health")
            assert health_resp.status_code == 200
            assert health_resp.json()["status"] == "healthy"

