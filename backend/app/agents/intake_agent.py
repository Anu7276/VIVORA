import re
from typing import Dict, Any, List
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

    async def process_document(self, tenant_id: str, title: str, text: str, doc_type: str = "questions") -> Dict[str, Any]:
        """
        Parses uploaded text, generates chunks, embeds them into Vector DB,
        and extracts topics / fixed question lists.
        """
        chunks = self.chunker.chunk_text(text, default_topic=title)
        
        # Ingest into Vector DB (sanitize each chunk against prompt injection first)
        chunk_records = []
        for c in chunks:
            c["content"] = Guardrails.sanitize_input(c["content"])
            emb = embedder.get_embedding(c["content"])
            v_id = vector_store.insert(
                tenant_id=tenant_id,
                content=c["content"],
                embedding=emb,
                metadata={"topic_tag": c["topic_tag"], "title": title}
            )
            c["vector_id"] = v_id
            chunk_records.append(c)

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
        Fast, robust regex parser for question lists (e.g. 1. What is...? Q1: ...).
        Works immediately for school fixed-question lists.
        """
        lines = [l.strip() for l in text.split('\n') if l.strip()]
        questions = []
        
        q_pattern = re.compile(r'^(?:Q\d*[:\.\)]|\d+[\.\)]|\-\s*Q:|\*\s*)(.+)$', re.IGNORECASE)
        
        current_q = None
        for line in lines:
            match = q_pattern.match(line)
            if match or line.endswith('?'):
                q_text = match.group(1).strip() if match else line
                # Check for answer separator if provided in document (e.g. "Ans: ...")
                ref_ans = None
                if "ans:" in q_text.lower():
                    parts = re.split(r'ans:\s*', q_text, flags=re.IGNORECASE)
                    q_text = parts[0].strip()
                    ref_ans = parts[1].strip() if len(parts) > 1 else None

                current_q = {
                    "question_text": q_text,
                    "topic": "Uploaded Questions",
                    "difficulty": "medium",
                    "reference_answer": ref_ans or f"Complete textbook explanation for: {q_text}"
                }
                questions.append(current_q)
            elif current_q and ("ans:" in line.lower() or "answer:" in line.lower()):
                parts = re.split(r'answer:\s*|ans:\s*', line, flags=re.IGNORECASE)
                if len(parts) > 1:
                    current_q["reference_answer"] = parts[1].strip()

        # If no explicit question markers found, split by lines ending in '?' or sentences
        if not questions and len(lines) > 0:
            for l in lines:
                if len(l) > 15 and ('?' in l or len(l.split()) > 4):
                    questions.append({
                        "question_text": l,
                        "topic": "Uploaded Topic",
                        "difficulty": "easy",
                        "reference_answer": f"Standard textbook answer explaining {l}"
                    })

        return questions

intake_agent = IntakeAgent()
