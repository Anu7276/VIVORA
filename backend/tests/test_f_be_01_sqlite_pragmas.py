import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from app.db.database import engine, SessionLocal
from app.db.models import DocumentChunk

def test_sqlite_pragmas_configured():
    with engine.connect() as conn:
        fk = conn.execute(text("PRAGMA foreign_keys;")).scalar()
        assert fk == 1, f"Expected PRAGMA foreign_keys=1, got {fk}"

        journal_mode = conn.execute(text("PRAGMA journal_mode;")).scalar()
        assert journal_mode.lower() == "wal", f"Expected PRAGMA journal_mode='wal', got {journal_mode}"

        busy_timeout = conn.execute(text("PRAGMA busy_timeout;")).scalar()
        assert busy_timeout == 5000, f"Expected PRAGMA busy_timeout=5000, got {busy_timeout}"

        sync = conn.execute(text("PRAGMA synchronous;")).scalar()
        assert sync == 1, f"Expected PRAGMA synchronous=1 (NORMAL), got {sync}"

def test_foreign_key_enforcement():
    db = SessionLocal()
    try:
        # Attempt to insert a DocumentChunk with an invalid document_id
        chunk = DocumentChunk(
            document_id="non-existent-doc-id-12345",
            chunk_index=0,
            content="test content"
        )
        db.add(chunk)
        with pytest.raises(IntegrityError):
            db.commit()
    finally:
        db.rollback()
        db.close()
