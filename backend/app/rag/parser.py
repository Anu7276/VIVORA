import io
import logging
from typing import Dict, Any, List
import pypdf

logger = logging.getLogger("vivora.pdf_parser")

class DocumentParser:
    @staticmethod
    def parse_pdf_bytes(pdf_bytes: bytes) -> Dict[str, Any]:
        """
        Extracts plain text, page count, and metadata from PDF bytes.
        """
        try:
            reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
            num_pages = len(reader.pages)
            pages_text = []
            
            for idx, page in enumerate(reader.pages):
                txt = page.extract_text() or ""
                cleaned = txt.strip()
                if cleaned:
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
                "error": str(e)
            }

document_parser = DocumentParser()
