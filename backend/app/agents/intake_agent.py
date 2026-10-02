import json
import re
from typing import Dict, Any, List, Optional
from app.agents.base import BaseAgent
from app.llm.prompts import INTAKE_SYSTEM_PROMPT
from app.llm.guardrails import Guardrails
from app.rag.chunker import Chunker
from app.rag.embedder import embedder
from app.rag.vector_store import vector_store

class IntakeAgent(BaseAgent):
    def __init__(self):
        super().__init__("IntakeAgent")
        self.chunker = Chunker()

    async def process_document(
        self,
        tenant_id: str,
        title: str,
        text: str,
        doc_type: str = "questions",
        db: Optional[Any] = None
    ) -> Dict[str, Any]:
        """
        Parses uploaded text, generates chunks, persists them to DocumentChunk table,
        indexes them in restart-safe BM25 / Vector DB, and extracts topics / fixed question lists.
        """
        from app.db.database import SessionLocal
        from app.db.models import DocumentChunk
        from app.rag.retriever import rag_retriever

        chunks = self.chunker.chunk_text(text, default_topic=title)

        # Ingest into DB and Vector DB
        chunk_records = []
        should_close_db = False
        active_db = db
        if active_db is None:
            active_db = SessionLocal()
            should_close_db = True

        try:
            for c in chunks:
                sanitized = Guardrails.sanitize_input(c["content"])
                c["content"] = sanitized
                db_chunk = DocumentChunk(
                    document_id=tenant_id,
                    chunk_index=c["chunk_index"],
                    content=sanitized,
                    topic_tag=c["topic_tag"]
                )
                active_db.add(db_chunk)

                emb = embedder.get_embedding(sanitized)
                v_id = vector_store.insert(
                    tenant_id=tenant_id,
                    content=sanitized,
                    embedding=emb,
                    metadata={"topic_tag": c["topic_tag"], "title": title}
                )
                c["vector_id"] = v_id
                chunk_records.append(c)

            active_db.commit()
            # Invalidate any cached index for this tenant to force reload with fresh DB chunks
            rag_retriever.clear_cache(tenant_id)
        finally:
            if should_close_db:
                active_db.close()

        # Parse fixed questions or topics
        fixed_questions = self._extract_explicit_questions(text)

        # If LLM is available and text is not structured questions, we can extract topics
        topics = list(set([c["topic_tag"] for c in chunks])) if chunks else [title]

        return {
            "title": title,
            "doc_type": doc_type,
            "topics": topics,
            "chunks": chunk_records,
            "explicit_questions": fixed_questions
        }

    def _extract_explicit_questions(self, text: str) -> List[Dict[str, Any]]:
        """
        Fast, robust parser for question and answer pairs.
        Supports:
          1. JSON arrays of Q&A objects: [{"question": "...", "answer": "..."}]
          2. Text formats:
             Q1: What is photosynthesis?
             Ans: Photosynthesis is the process by which green plants make food...
             
             1. State Newton's third law.
             Answer: For every action, there is an equal and opposite reaction.
          3. Multi-line answers and varied prefixes (Q:, Question, Ans:, Answer, A:).
        """
        stripped = (text or "").strip()
        if not stripped:
            return []

        # 1. Try parsing JSON directly
        if stripped.startswith("[") and stripped.endswith("]"):
            try:
                data = json.loads(stripped)
                if isinstance(data, list):
                    parsed_from_json = []
                    for item in data:
                        if isinstance(item, dict):
                            q_text = item.get("question") or item.get("question_text") or item.get("q")
                            a_text = item.get("answer") or item.get("reference_answer") or item.get("a") or item.get("ans")
                            if q_text:
                                parsed_from_json.append({
                                    "question_text": str(q_text).strip(),
                                    "topic": str(item.get("topic") or "School Viva"),
                                    "difficulty": str(item.get("difficulty") or "easy"),
                                    "reference_answer": str(a_text).strip() if a_text else f"Standard textbook answer for: {q_text}"
                                })
                    if parsed_from_json:
                        return parsed_from_json
            except Exception:
                pass

        # 2. Text line parser with multi-line answer support
        lines = [l.strip() for l in stripped.split('\n') if l.strip()]
        questions: List[Dict[str, Any]] = []

        q_pattern = re.compile(
            r'^(?:(?:Question|Q)\s*\d*[:\.\)]|\d+[\.\)]|\-\s*(?:Q|Question):|\*\s*(?:Q|Question)?:?)\s*(.+)$',
            re.IGNORECASE
        )
        ans_pattern = re.compile(
            r'^(?:(?:Answer|Ans|Model\s*Answer|Expected\s*Answer|Key|A)\s*\d*[:\.\)]|\-\s*(?:A|Ans|Answer):)\s*(.*)$',
            re.IGNORECASE
        )

        current_q: Optional[Dict[str, Any]] = None
        in_answer_block = False

        for line in lines:
            # Check if this line is a new question
            q_match = q_pattern.match(line)
            is_lone_question = (
                not q_match
                and line.endswith('?')
                and not ans_pattern.match(line)
                and (not current_q or in_answer_block)
            )

            if q_match or is_lone_question:
                q_text = q_match.group(1).strip() if q_match else line
                ref_ans = None

                # Inline answer format: "Q: ... Ans: ..."
                if any(delim in q_text.lower() for delim in ("ans:", "answer:", " a:")):
                    parts = re.split(r'(?:ans:|answer:|\ba:)\s*', q_text, flags=re.IGNORECASE)
                    if len(parts) > 1:
                        q_text = parts[0].strip()
                        ref_ans = parts[1].strip()

                current_q = {
                    "question_text": q_text,
                    "topic": "School Viva",
                    "difficulty": "easy",
                    "reference_answer": ref_ans or ""
                }
                questions.append(current_q)
                in_answer_block = bool(ref_ans)
                continue

            # Check if this line is an answer indicator
            ans_match = ans_pattern.match(line)
            if current_q and ans_match:
                ans_text = ans_match.group(1).strip()
                if current_q["reference_answer"]:
                    current_q["reference_answer"] += " " + ans_text
                else:
                    current_q["reference_answer"] = ans_text
                in_answer_block = True
                continue

            # If we are inside an answer block and it's not a new question, append as continuation of answer
            if current_q and in_answer_block:
                current_q["reference_answer"] = (current_q["reference_answer"] + " " + line).strip()
                continue

        # Fill default reference answers if any question had none provided
        for q in questions:
            if not q.get("reference_answer"):
                q["reference_answer"] = f"Complete textbook explanation for: {q['question_text']}"

        # If no explicit markers found, fallback to sentence or question splits
        if not questions and len(lines) > 0:
            for l in lines:
                if len(l) > 10 and ('?' in l or len(l.split()) > 3):
                    questions.append({
                        "question_text": l,
                        "topic": "School Viva",
                        "difficulty": "easy",
                        "reference_answer": f"Standard textbook answer explaining {l}"
                    })

        return questions

intake_agent = IntakeAgent()
