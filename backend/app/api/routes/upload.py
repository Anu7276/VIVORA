from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session as DBSession
from typing import Optional
from app.db.database import get_db
from app.db.models import Document
from app.agents.orchestrator import orchestrator
from app.rag.parser import document_parser
from pydantic import BaseModel

router = APIRouter()

class TextUploadRequest(BaseModel):
    title: str
    doc_type: str = "questions"  # syllabus | topic | questions | textbook | resume
    content: str
    user_id: Optional[str] = None

@router.post("/text")
async def upload_text_material(req: TextUploadRequest, db: DBSession = Depends(get_db)):
    """Ingests raw text (syllabus, chapter, question list) into RAG Vector DB and database."""
    doc = Document(
        title=req.title,
        doc_type=req.doc_type,
        content=req.content,
        user_id=req.user_id,
        ingest_status="processing"
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    try:
        res = await orchestrator.ingest_material(
            tenant_id=doc.id,
            title=req.title,
            text=req.content,
            doc_type=req.doc_type
        )
        doc.ingest_status = "done"
        db.commit()
        return {
            "document_id": doc.id,
            "title": doc.title,
            "topics": res.get("topics", []),
            "questions_detected": len(res.get("explicit_questions", [])),
            "explicit_questions": res.get("explicit_questions", []),
            "chunks_count": len(res.get("chunks", []))
        }
    except Exception as e:
        doc.ingest_status = "failed"
        db.commit()
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")

@router.post("/file")
async def upload_file_material(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    doc_type: str = Form("questions"),
    db: DBSession = Depends(get_db)
):
    """
    Parses PDF, Markdown, or text files and extracts text & questions into RAG Vector DB.
    """
    content_bytes = await file.read()
    filename = file.filename or "Uploaded Document"
    doc_title = title or filename

    # Check if PDF
    if filename.lower().endswith(".pdf") or file.content_type == "application/pdf":
        parse_result = document_parser.parse_pdf_bytes(content_bytes)
        if not parse_result["success"] or not parse_result["text"]:
            raise HTTPException(status_code=400, detail=f"Could not extract text from PDF: {parse_result.get('error', 'Empty or unreadable PDF')}")
        content_text = parse_result["text"]
        num_pages = parse_result["num_pages"]
    else:
        # Fallback text decoding
        try:
            content_text = content_bytes.decode("utf-8", errors="ignore")
        except Exception:
            raise HTTPException(status_code=400, detail="Could not decode file text")
        num_pages = 1

    doc = Document(
        title=doc_title,
        doc_type=doc_type,
        content=content_text,
        ingest_status="processing"
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    res = await orchestrator.ingest_material(
        tenant_id=doc.id,
        title=doc_title,
        text=content_text,
        doc_type=doc_type
    )
    doc.ingest_status = "done"
    db.commit()

    return {
        "document_id": doc.id,
        "title": doc.title,
        "filename": filename,
        "num_pages": num_pages,
        "extracted_text": content_text[:3000],  # preview of extracted text
        "topics": res.get("topics", []),
        "questions_detected": len(res.get("explicit_questions", [])),
        "explicit_questions": res.get("explicit_questions", []),
        "chunks_count": len(res.get("chunks", []))
    }
