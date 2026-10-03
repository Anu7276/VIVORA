import io
import logging
from typing import Dict, Any, List
import pypdf

logger = logging.getLogger("vivora.pdf_parser")

class DocumentParser:
    MAX_PDF_PAGES: int = 100
    MAX_PDF_CHARS: int = 500_000

    @staticmethod
    def parse_pdf_bytes(pdf_bytes: bytes, max_pages: int = MAX_PDF_PAGES) -> Dict[str, Any]:
        """
        Extracts plain text, page count, and metadata from PDF bytes.
        Checks page count before extracting full text to prevent resource exhaustion.
        """
        try:
            reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
            num_pages = len(reader.pages)
            
            # Check page count before performing full extraction
            if num_pages > max_pages:
                return {
                    "text": "",
                    "num_pages": num_pages,
                    "success": False,
                    "error": f"PDF exceeds maximum page limit of {max_pages} pages (found {num_pages})."
                }

            pages_text: List[str] = []
            total_chars = 0
            
            for idx, page in enumerate(reader.pages):
                txt = page.extract_text() or ""
                cleaned = txt.strip()
                if cleaned:
                    total_chars += len(cleaned)
                    if total_chars > DocumentParser.MAX_PDF_CHARS:
                        remaining = DocumentParser.MAX_PDF_CHARS - (total_chars - len(cleaned))
                        if remaining > 0:
                            pages_text.append(f"[Page {idx+1}]\n{cleaned[:remaining]}")
                        break
                    pages_text.append(f"[Page {idx+1}]\n{cleaned}")

            full_text = "\n\n".join(pages_text)
            return {
                "text": full_text,
                "num_pages": num_pages,
                "success": True,
                "character_count": len(full_text)
            }
        except Exception as e:
            logger.error(f"Failed to parse PDF: {e}", exc_info=True)
            return {
                "text": "",
                "num_pages": 0,
                "success": False,
                "error": "Failed to parse PDF document"
            }

document_parser = DocumentParser()
