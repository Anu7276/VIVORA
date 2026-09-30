import sys
import os
import io
import pypdf
import httpx

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

def test_pdf_parsing_endpoint():
    # 1. Create in-memory test PDF
    writer = pypdf.PdfWriter()
    page = writer.add_blank_page(width=300, height=300)
    
    # We can write text or test the parser module directly
    from app.rag.parser import document_parser
    
    sample_text_pdf = io.BytesIO()
    # Write empty pdf or verify parser response
    writer.write(sample_text_pdf)
    sample_text_pdf.seek(0)
    
    res = document_parser.parse_pdf_bytes(sample_text_pdf.getvalue())
    assert res["success"] is True
    assert res["num_pages"] == 1
    print(f"  [OK] PDF parser extracted {res['num_pages']} page(s) correctly")

if __name__ == "__main__":
    test_pdf_parsing_endpoint()
    print("=== PDF PARSER TEST PASSED ===")
