import sys
import os
import io
import time
import pytest
from starlette.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.rag.parser import document_parser

def _build_test_pdf(text: str = "Operating Systems and Distributed Consensus Viva Notes") -> bytes:
    """Constructs a valid in-memory PDF byte string containing readable text for pypdf."""
    stream_content = f"BT /F1 12 Tf 50 700 Td ({text}) Tj ET".encode("latin1")
    length = len(stream_content)
    pdf_str = f"""%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj
4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
5 0 obj << /Length {length} >>
stream
{stream_content.decode('latin1')}
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000318 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
420
%%EOF"""
    return pdf_str.encode("latin1")


def _get_auth_header(client: TestClient) -> dict:
    """Helper to create an active adult test user and return Authorization headers."""
    email = f"pdf_tester_{int(time.time() * 1000)}@vivora.ai"
    client.post("/api/auth/signup", json={
        "name": "PDF Test User",
        "email": email,
        "password": "Password123!",
        "date_of_birth": "1998-05-15"
    })
    login_resp = client.post("/api/auth/login", json={
        "email": email,
        "password": "Password123!"
    })
    token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_pdf_parser_direct():
    """Verify document_parser extracts text from valid PDF bytes."""
    pdf_bytes = _build_test_pdf("Raft Consensus Algorithm Leader Election")
    res = document_parser.parse_pdf_bytes(pdf_bytes)
    assert res["success"] is True
    assert res["num_pages"] == 1
    assert "Raft Consensus Algorithm" in res["text"]


def test_pdf_upload_endpoint_authenticated():
    """Verify POST /api/upload/file successfully accepts and parses a PDF."""
    client = TestClient(app)
    headers = _get_auth_header(client)
    pdf_bytes = _build_test_pdf("Chapter 4: Distributed Deadlock Detection")

    resp = client.post(
        "/api/upload/file",
        files={"file": ("Practicle - 4 creating (2).pdf", pdf_bytes, "application/pdf")},
        data={"doc_type": "syllabus", "title": "Practicle - 4 creating (2)"},
        headers=headers,
    )
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert "document_id" in data
    assert data["num_pages"] == 1
    assert "Distributed Deadlock" in data["extracted_text"]


def test_pdf_upload_windows_octet_stream_mime():
    """Verify Windows browser edge case where PDF is uploaded with application/octet-stream MIME type."""
    client = TestClient(app)
    headers = _get_auth_header(client)
    pdf_bytes = _build_test_pdf("Network Layer Routing Protocols OSPF BGP")

    resp = client.post(
        "/api/upload/file",
        files={"file": ("Practicle - 4 creating (2).pdf", pdf_bytes, "application/octet-stream")},
        data={"doc_type": "syllabus"},
        headers=headers,
    )
    assert resp.status_code == 200, f"Expected 200 for octet-stream PDF on Windows, got {resp.status_code}: {resp.text}"
    assert "document_id" in resp.json()


def test_pdf_upload_unauthenticated_rejected():
    """Verify unauthenticated requests to /api/upload/file are rejected with 401."""
    client = TestClient(app)
    pdf_bytes = _build_test_pdf("Secret Exam Questions")
    resp = client.post(
        "/api/upload/file",
        files={"file": ("test.pdf", pdf_bytes, "application/pdf")},
    )
    assert resp.status_code == 401


if __name__ == "__main__":
    test_pdf_parser_direct()
    print("[1/4] test_pdf_parser_direct passed")
    test_pdf_upload_endpoint_authenticated()
    print("[2/4] test_pdf_upload_endpoint_authenticated passed")
    test_pdf_upload_windows_octet_stream_mime()
    print("[3/4] test_pdf_upload_windows_octet_stream_mime passed")
    test_pdf_upload_unauthenticated_rejected()
    print("[4/4] test_pdf_upload_unauthenticated_rejected passed")
    print("=== ALL PDF UPLOAD TESTS PASSED ===")
