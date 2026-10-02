from typing import List, Dict, Any
import re

class Chunker:
    """
    Splits syllabus, textbook chapters, or question lists into clean chunks.
    Guarantees:
    - Never slices inside words (strictly whole-word / sentence boundaries).
    - Preserves overlap without mid-word splits.
    - Topic tags extracted from real headings.
    """
    def __init__(self, chunk_size: int = 500, overlap: int = 50):
        self.chunk_size = chunk_size
        self.overlap = overlap

    def chunk_text(self, text: str, default_topic: str = "General") -> List[Dict[str, Any]]:
        cleaned = (text or "").strip()
        if not cleaned:
            return []

        # Split on real headings or double newlines
        sections = re.split(r'(?i)(?=(?:^|\n)(?:chapter|unit|topic|section|\d+\.)\s*[:\w])', cleaned)
        
        chunks: List[Dict[str, Any]] = []
        chunk_idx = 0

        for section in sections:
            sec = section.strip()
            if not sec:
                continue

            # Identify topic tag only from real headings
            header_match = re.match(
                r'^(?:(?:chapter|unit|topic|section)\s*[:\w\d\-\.]*|\d+\.)\s*([^\n\:\.]+)',
                sec,
                re.IGNORECASE
            )
            topic_tag = header_match.group(1).strip() if header_match else default_topic
            if len(topic_tag) > 60:
                topic_tag = topic_tag[:60]

            words = sec.split()
            if not words:
                continue

            # If section fits in chunk_size, make it a single chunk
            if len(sec) <= self.chunk_size:
                chunks.append({
                    "chunk_index": chunk_idx,
                    "content": sec,
                    "topic_tag": topic_tag
                })
                chunk_idx += 1
            else:
                # Word-based sliding window: guarantees zero word truncation
                w_start = 0
                while w_start < len(words):
                    curr_words: List[str] = []
                    curr_len = 0
                    w_end = w_start
                    while w_end < len(words):
                        w = words[w_end]
                        added_len = len(w) + (1 if curr_words else 0)
                        if curr_len + added_len > self.chunk_size and curr_words:
                            break
                        curr_words.append(w)
                        curr_len += added_len
                        w_end += 1

                    chunk_str = " ".join(curr_words).strip()
                    if chunk_str:
                        chunks.append({
                            "chunk_index": chunk_idx,
                            "content": chunk_str,
                            "topic_tag": topic_tag
                        })
                        chunk_idx += 1

                    if w_end >= len(words):
                        break

                    # Overlap: step back whole words until overlap character threshold is reached
                    overlap_chars = 0
                    step_back = 0
                    while step_back < len(curr_words) - 1:
                        wb = curr_words[-(step_back + 1)]
                        overlap_chars += len(wb) + 1
                        step_back += 1
                        if overlap_chars >= self.overlap:
                            break

                    w_start = max(w_start + 1, w_end - step_back)

        return chunks
