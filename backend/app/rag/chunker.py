from typing import List, Dict, Any
import re

class Chunker:
    """
    Splits syllabus, textbook chapters, or question lists into clean chunks.
    Extracts topic tags and subtopics.
    """
    def __init__(self, chunk_size: int = 500, overlap: int = 50):
        self.chunk_size = chunk_size
        self.overlap = overlap

    def chunk_text(self, text: str, default_topic: str = "General") -> List[Dict[str, Any]]:
        cleaned = re.sub(r'\s+', ' ', text).strip()
        if not cleaned:
            return []

        # Detect topic headers if any (e.g. Chapter 1:, Topic:, Unit:)
        sections = re.split(r'(?i)(?=(?:chapter|unit|topic|section|\n\d+\.)\s*:?)', cleaned)
        
        chunks: List[Dict[str, Any]] = []
        chunk_idx = 0

        for section in sections:
            sec = section.strip()
            if not sec:
                continue

            # Identify topic tag from section start
            header_match = re.match(r'^(?:chapter|unit|topic|section|\d+\.)\s*([^:\.\n]+)', sec, re.IGNORECASE)
            topic_tag = header_match.group(1).strip() if header_match else default_topic

            # If section is small enough, make it a single chunk
            if len(sec) <= self.chunk_size:
                chunks.append({
                    "chunk_index": chunk_idx,
                    "content": sec,
                    "topic_tag": topic_tag
                })
                chunk_idx += 1
            else:
                # Sliding window chunking
                start = 0
                while start < len(sec):
                    end = min(start + self.chunk_size, len(sec))
                    chunk_content = sec[start:end].strip()
                    chunks.append({
                        "chunk_index": chunk_idx,
                        "content": chunk_content,
                        "topic_tag": topic_tag
                    })
                    chunk_idx += 1
                    if end == len(sec):
                        break
                    start += (self.chunk_size - self.overlap)

        return chunks
