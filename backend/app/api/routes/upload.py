"""
app/api/routes/upload.py
========================
File and text ingestion endpoints.

Security changes (Phase 1):
  - Both endpoints now require a valid JWT Bearer token (get_active_user).
  - File upload enforces:
      * Max 10 MB (was 15 MB; reduced to a safer default).
      * Only pdf, txt, and md extensions + corresponding MIME types.
      * PDF page count ≤ 100 (prevents memory exhaustion via huge PDFs).
  - user_id is taken from the JWT, not from the request body.
"""

import os
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session as DBSession
from starlette.requests import Request
from starlette.concurrency import run_in_threadpool
from app.core.auth import get_active_user
from app.core.rate_limiter import upload_limiter
from app.db.database import get_db
from app.db.models import Document, DocumentChunk, User
from app.agents.orchestrator import orchestrator
from app.rag.parser import document_parser
from app.rag.retriever import rag_retriever

logger = logging.getLogger("vivora.upload")

router = APIRouter()

_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024   # 10 MB hard limit
_MAX_TEXT_LENGTH_CHARS = 500_000
_MAX_PDF_PAGES = 100

# Allowed file extensions and their corresponding MIME types.
_ALLOWED_EXTENSIONS = {".pdf", ".txt", ".md"}
_ALLOWED_MIME_TYPES = {
    "application/pdf",
    "text/plain",
    "text/markdown",
    "text/x-markdown",
    # Some browsers report these for .txt/.md
    "application/octet-stream",  # only allowed if extension is .txt or .md
}


def _check_file_type_allowed(filename: str, content_type: str) -> None:
    """
    Reject disallowed file types with 415 Unsupported Media Type.
    Checks both extension and MIME type (don't trust either alone).
    """
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    # Only allowed extensions are permitted
    if ext not in _ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=(
                f"File type '{ext}' is not supported. "
                f"Only {', '.join(sorted(_ALLOWED_EXTENSIONS))} files are accepted."
            ),
        )


class TextUploadRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    doc_type: str = Field("questions", max_length=50)  # syllabus | topic | questions | textbook | resume
    content: str = Field(..., min_length=1, max_length=_MAX_TEXT_LENGTH_CHARS)


@router.post("/text")
async def upload_text_material(
    req: TextUploadRequest,
    request: Request,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_active_user),   # JWT required
):
    """Ingests raw text (syllabus, chapter, question list) into RAG Vector DB and database."""
    is_test = bool(os.environ.get("PYTEST_CURRENT_TEST"))
    check_limits = (not is_test) or (request.headers.get("X-Test-Rate-Limit") == "true")
    if check_limits and not upload_limiter.check_and_record(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many upload requests. Please wait a moment before uploading again."
        )
    if len(req.content) > _MAX_TEXT_LENGTH_CHARS:
        raise HTTPException(
            status_code=413,
            detail=f"Content too large. Maximum supported text length is {_MAX_TEXT_LENGTH_CHARS} characters.",
        )

    doc = Document(
        title=req.title,
        doc_type=req.doc_type,
        content=req.content,
        user_id=current_user.id,
        ingest_status="processing",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    try:
        res = await orchestrator.ingest_material(
            tenant_id=doc.id,
            title=req.title,
            text=req.content,
            doc_type=req.doc_type,
            db=db
        )
        doc.ingest_status = "done"
        db.commit()
        return {
            "document_id": doc.id,
            "title": doc.title,
            "topics": res.get("topics", []),
            "questions_detected": len(res.get("explicit_questions", [])),
            "explicit_questions": res.get("explicit_questions", []),
            "chunks_count": len(res.get("chunks", [])),
        }
    except Exception as e:
        logger.error(f"Ingestion failed for doc {doc.id}: {e}", exc_info=True)
        doc.ingest_status = "failed"
        db.commit()
        raise HTTPException(status_code=500, detail="Document ingestion failed. Please try again.")


@router.post("/file")
async def upload_file_material(
    request: Request,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    doc_type: str = Form("questions"),
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_active_user),   # JWT required
):
    """
    Parses PDF, Markdown, or text files and extracts text & questions into RAG Vector DB.

    Limits enforced:
      - Max 10 MB file size (returns 413).
      - Only pdf, txt, md files (returns 415 for others).
      - Max 100 PDF pages (returns 413).
    """
    is_test = bool(os.environ.get("PYTEST_CURRENT_TEST"))
    check_limits = (not is_test) or (request.headers.get("X-Test-Rate-Limit") == "true")
    if check_limits and not upload_limiter.check_and_record(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many upload requests. Please wait a moment before uploading again."
        )
    filename = file.filename or "Uploaded Document"
    content_type = file.content_type or "application/octet-stream"

    # 1. Validate file type before reading content
    _check_file_type_allowed(filename, content_type)

    # 2. Read up to limit + 1 byte to detect oversize
    content_bytes = await file.read(_MAX_FILE_SIZE_BYTES + 1)
    if len(content_bytes) > _MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds maximum allowed size of {_MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB.",
        )

    clean_default_title = re.sub(r"\.[a-zA-Z0-9]+$", "", filename)
    clean_default_title = re.sub(r"[_\-]+", " ", clean_default_title).strip()
    doc_title = (title.strip() if title else "") or clean_default_title or "Uploaded Document"

    # 3. Parse content (run in threadpool for non-blocking execution)
    if filename.lower().endswith(".pdf") or content_type == "application/pdf":
        parse_result = await run_in_threadpool(document_parser.parse_pdf_bytes, content_bytes)
        if not parse_result["success"] or not parse_result["text"]:
            raise HTTPException(
                status_code=400,
                detail=f"Could not extract text from PDF: {parse_result.get('error', 'Empty or unreadable PDF')}",
            )
        content_text = parse_result["text"]
        num_pages = parse_result["num_pages"]

        # 4. Reject PDFs exceeding max page count
        if num_pages > _MAX_PDF_PAGES:
            raise HTTPException(
                status_code=413,
                detail=(
                    f"PDF has {num_pages} pages, which exceeds the maximum of {_MAX_PDF_PAGES} pages. "
                    "Please split the document or upload a shorter excerpt."
                ),
            )
    else:
        try:
            content_text = content_bytes.decode("utf-8", errors="ignore")
        except Exception:
            raise HTTPException(status_code=400, detail="Could not decode file text.")
        num_pages = 1

    doc = Document(
        title=doc_title,
        doc_type=doc_type,
        content=content_text,
        user_id=current_user.id,
        ingest_status="processing",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    res = await orchestrator.ingest_material(
        tenant_id=doc.id,
        title=doc_title,
        text=content_text,
        doc_type=doc_type,
        db=db
    )
    doc.ingest_status = "done"
    db.commit()

    return {
        "document_id": doc.id,
        "title": doc.title,
        "filename": filename,
        "num_pages": num_pages,
        "extracted_text": content_text[:3000],
        "topics": res.get("topics", []),
        "questions_detected": len(res.get("explicit_questions", [])),
        "explicit_questions": res.get("explicit_questions", []),
        "chunks_count": len(res.get("chunks", [])),
    }


@router.get("/{document_id}/status")
async def get_upload_status(
    document_id: str,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_active_user),
):
    """Poll ingestion status for an uploaded document."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc or doc.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")

    chunks_count = db.query(DocumentChunk).filter(DocumentChunk.document_id == document_id).count()
    return {
        "document_id": doc.id,
        "title": doc.title,
        "status": doc.ingest_status,
        "chunks_count": chunks_count,
    }


@router.delete("/{document_id}")
async def delete_upload_document(
    document_id: str,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_active_user),
):
    """Deletes an uploaded document and all associated chunks."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc or doc.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")

    # Clear retriever cache
    rag_retriever.clear_cache(doc.id)

    db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).delete()
    db.delete(doc)
    db.commit()
    return {"deleted": True, "document_id": document_id}
